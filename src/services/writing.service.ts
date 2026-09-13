import mongoose, { ClientSession, Types } from 'mongoose';
import { createHash } from 'node:crypto';
import { WritingQuestion, WritingExamType } from '../models/WritingQuestion';
import { PracticeSessionResult } from '../models/PracticeSessionResult';
import { PracticeAttempt } from '../models/PracticeAttempt';
import { getOrCreateSystemConfig } from '../models/SystemConfig';
import { DailyStats } from '../models/DailyStats';
import { redis, isRedisAvailable } from '../config/redis';
import { gradeWriting } from './gemini.service';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';
import type { WritingGradeBody, WritingSubmitBody } from '../validators/writing.schema';

/**
 * Writing Practice service (UC-17) — business rules W1..W4 (CAP-01..CAP-05, CAP-07, CAP-08).
 *
 * Ownership (AD-3): đây là nơi duy nhất ghi PracticeSessionResult/PracticeAttempt
 * cho skillType WRITING; WritingQuestion read-only ở đây (write thuộc adminWriting.service).
 * Chấm bài sync trong request (timeout 30s — CON-07), KHÔNG dùng BullMQ.
 */

const MIN_WORD_FACTOR = 0.5; // BR-01: >= 50% wordLimit
const DAILY_GRADE_QUOTA = 20; // AF-06: quota 20 lượt chấm thành công/ngày/user
const SUBMIT_LOCK_TTL_S = 60; // CON-11: Redis lock NX EX 60
const SCORE_PASS_THRESHOLD = 60; // correct <=> scorePercent >= 60 (data-model.md §2)
const VN_TZ_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 cố định — VN không có DST

/** Số từ thực tế — BE tự tính, không tin FE (architecture.md §5.2). */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** YYYY-MM-DD theo giờ VN (UTC+7) — quota reset nửa đêm local (CON-12).
 * Tính thuần theo offset 7h thay vì Intl/toLocaleString để không phụ thuộc TZ
 * cấu hình của server (deploy UTC/máy local đều ra cùng kết quả — VN không DST). */
function getDateKeyVN(): string {
  const vnNow = new Date(Date.now() + VN_TZ_OFFSET_MS);
  return vnNow.toISOString().slice(0, 10);
}

/** Giây còn lại tới 00:00 giờ VN — TTL cho quota counter.
 * diff <= 0 chỉ xảy ra khi đồng hồ lệch/trượt giây ở đúng nửa đêm → fallback 3600. */
function secondsUntilMidnightVN(): number {
  const vnNow = new Date(Date.now() + VN_TZ_OFFSET_MS);
  const vnMidnight = Date.UTC(
    vnNow.getUTCFullYear(),
    vnNow.getUTCMonth(),
    vnNow.getUTCDate() + 1, // 00:00 ngày mai (theo giờ VN)
  );
  const diff = Math.ceil((vnMidnight - (Date.now() + VN_TZ_OFFSET_MS)) / 1000);
  return diff > 0 ? diff : 3600;
}

function quotaKey(userId: string): string {
  return `minlish:writing:quota:${userId}:${getDateKeyVN()}`;
}

function submitLockKey(userId: string, groupId: string): string {
  return `minlish:writing:submit:${userId}:${groupId}`;
}

// ─── W1: Lấy danh sách đề (CAP-01) ─────────────────────────────────────────────

export async function getQuestions(
  userId: string,
  query: { examType: WritingExamType; taskType?: string; limit: number },
) {
  // 1. Query ngân hàng đề theo examType (+ taskType nếu có), sort cố định createdAt
  const filter: Record<string, unknown> = { examType: query.examType, isDeleted: { $ne: true } };
  if (query.taskType) {
    filter.taskType = query.taskType;
  }
  const pool = await WritingQuestion.find(filter).sort({ createdAt: 1 }).lean();

  // 2. Filter bỏ đề user đã Hoàn thành (BR-03 — đề đã nộp không bao giờ trả lại)
  const submitted = await PracticeAttempt.find(
    { userId, skillType: 'WRITING' },
    { refId: 1, _id: 0 },
  ).lean();
  const submittedIds = new Set(submitted.map((a) => String(a.refId)));

  const available = pool.filter((q) => !submittedIds.has(String((q as any)._id)));

  // 3. Slice theo limit — trả metadata, KHÔNG có nội dung chấm (WritingQuestion vốn không có đáp án)
  const questions = available.slice(0, query.limit);

  // 4. Pool rỗng sau filter → mảng rỗng (FE xử lý AF-01)
  return { questions };
}

// ─── W2: Chấm AI từng bài (CAP-02, CAP-08) ─────────────────────────────────────

export async function gradeWritingById(userId: string, body: WritingGradeBody) {
  const startedAt = Date.now();

  // 1. Tra đề — không có / đã soft-delete → 404
  const question = await WritingQuestion.findOne({
    _id: body.questionId,
    isDeleted: { $ne: true },
  }).lean();
  if (!question) {
    throw new AppError('Writing question not found', HttpStatus.NOT_FOUND, ErrorCodes.WRITING_QUESTION_NOT_FOUND);
  }

  // 2. BR-01: BE tính lại wordCount — dưới 50% wordLimit → 400
  const wordCount = countWords(body.userText);
  const minWords = Math.ceil(MIN_WORD_FACTOR * question.wordLimit);
  if (wordCount < minWords) {
    throw new AppError(`Bài viết cần ít nhất ${minWords} từ để nộp.`, HttpStatus.BAD_REQUEST, ErrorCodes.WRITING_TOO_SHORT);
  }

  // 3. BR-03: đề đã có attempt thành công → cấm chấm lại
  const existingAttempt = await PracticeAttempt.findOne({
    userId,
    skillType: 'WRITING',
    refId: body.questionId,
  }).lean();
  if (existingAttempt) {
    throw new AppError('Bạn đã nộp bài cho đề này, không thể nộp lại.', HttpStatus.CONFLICT, ErrorCodes.WRITING_ALREADY_SUBMITTED);
  }

  // 4. Quota ngày: chỉ GET check trước (10 req/phút đã do writingGradeLimiter);
  //    INCR thật chỉ sau khi Gemini thành công (CON-12 — fail không trừ quota)
  if (isRedisAvailable() && redis) {
    const used = await redis.get(quotaKey(userId));
    if (used && Number(used) >= DAILY_GRADE_QUOTA) {
      throw new AppError(
        'Bạn đã đạt giới hạn chấm bài trong ngày.',
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCodes.RATE_LIMIT_EXCEEDED,
      );
    }
  }

  // 5. Đọc rubric từ SystemConfig (CON-09) — thiếu rubric → 502 như Gemini fail
  const config = await getOrCreateSystemConfig();
  const rubric = (config as any).writingRubrics?.[question.examType.toUpperCase()];
  if (!rubric) {
    console.warn(
      `[Writing] SystemConfig.writingRubrics.${question.examType.toUpperCase()} is empty — grading unavailable`,
    );
    throw new AppError(
      'Không thể chấm bài lúc này. Vui lòng thử lại sau.',
      HttpStatus.BAD_GATEWAY,
      ErrorCodes.AI_GRADING_FAILED,
    );
  }

  // 6. Gemini chấm sync, timeout 30s (CON-07) — lỗi/timeout/parse fail → 502, không lưu gì
  let aiResult;
  try {
    aiResult = await gradeWriting({
      prompt: question.prompt,
      instructions: question.instructions,
      taskType: question.taskType,
      examType: question.examType,
      userText: body.userText,
      rubric,
    });
  } catch (err) {
    console.error('[Writing] Gemini grading failed:', (err as Error).message);
    throw new AppError(
      'Không thể chấm bài lúc này. Vui lòng thử lại sau.',
      HttpStatus.BAD_GATEWAY,
      ErrorCodes.AI_GRADING_FAILED,
    );
  }

  // 7. Thành công → INCR quota (chỉ đếm lượt thành công — CON-12)
  if (isRedisAvailable() && redis) {
    try {
      const key = quotaKey(userId);
      const pipeline = redis.multi();
      pipeline.incr(key);
      pipeline.ttl(key);
      const results = await pipeline.exec();
      if (results) {
        const ttl = Number((results[1] as any)?.[1] ?? -1);
        if (ttl === -1) {
          // INCR đầu tiên trong ngày — set TTL tới 00:00 Asia/Ho_Chi_Minh
          await redis.expire(key, secondsUntilMidnightVN());
        }
      }
    } catch (err) {
      // Quota counter fail không được làm hỏng response chấm thành công — log và bỏ qua
      console.error('[Writing] Redis quota INCR error:', err);
    }
  }

  // 8. KHÔNG tạo Result/Attempt (BR-04) — durationMs W2 = thời gian BE xử lý chấm
  return {
    aiResult,
    durationMs: Date.now() - startedAt,
  };
}

// ─── W3: Ghi lô khi Hoàn thành (CAP-03, CAP-04, CAP-07) ────────────────────────

/** Fingerprint = SHA256 hex của canonical JSON (sorted keys) — so khớp khi replay. */
function computeBodyFingerprint(body: WritingSubmitBody): string {
  const canonical = {
    groupId: body.groupId,
    results: [...body.results].sort((a, b) => a.questionId.localeCompare(b.questionId)),
  };
  const json = JSON.stringify(canonical, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    }
    return value;
  });
  return createHash('sha256').update(json, 'utf8').digest('hex');
}

/** Recompute fingerprint từ attempts đã lưu trong DB (không cần field riêng). */
async function computeStoredFingerprint(groupId: string): Promise<string> {
  const attempts = await PracticeAttempt.find(
    { groupId, skillType: 'WRITING' },
    { refId: 1, payload: 1, durationMs: 1, scorePercent: 1, _id: 0 },
  ).lean();

  const canonical = {
    groupId,
    results: attempts
      .sort((a, b) => String(a.refId).localeCompare(String(b.refId)))
      .map((a) => {
        const payload = a.payload as any;
        return {
          questionId: String(a.refId),
          userText: payload?.userText ?? '',
          aiResult: payload?.aiResult ?? {},
          durationMs: a.durationMs ?? 0,
        };
      }),
  };
  const json = JSON.stringify(canonical, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    }
    return value;
  });
  return createHash('sha256').update(json, 'utf8').digest('hex');
}

function bandToScorePercent(bandScale: string, bandScore: number): number {
  // data-model.md §3: TOEIC round(band/5×100), IELTS round(band/9×100)
  const denom = bandScale === 'TOEIC_0_5' ? 5 : 9;
  return Math.round((bandScore / denom) * 100);
}

export async function submitBatch(userId: string, body: WritingSubmitBody) {
  const lockKey = submitLockKey(userId, body.groupId);

  // 1. Redis SET NX EX 60 — bị chiếm → 409 ERR_SUBMIT_IN_PROGRESS (song song)
  let locked = false;
  if (isRedisAvailable() && redis) {
    try {
      locked = (await redis.set(lockKey, '1', 'EX', SUBMIT_LOCK_TTL_S, 'NX')) === 'OK';
    } catch (err) {
      console.error('[Writing] Redis submit lock error:', err);
      locked = true; // Redis down → vẫn xử lý (transaction + unique index vẫn chặn trùng)
    }
    if (!locked) {
      throw new AppError(
        'Submit đang được xử lý. Vui lòng thử lại sau.',
        HttpStatus.CONFLICT,
        ErrorCodes.SUBMIT_IN_PROGRESS,
      );
    }
  }

  try {
    // 2. Result đã tồn tại theo groupId → retry path (CON-11)
    const existingResult = await PracticeSessionResult.findById(body.groupId).lean();
    if (existingResult) {
      if (String((existingResult as any).userId) !== userId) {
        // groupId thuộc user khác → 409
        throw new AppError('groupId conflict', HttpStatus.CONFLICT, ErrorCodes.GROUP_ID_CONFLICT);
      }
      const storedFp = await computeStoredFingerprint(body.groupId);
      const bodyFp = computeBodyFingerprint(body);
      if (storedFp === bodyFp) {
        // Retry y hệt → 200 replay, KHÔNG cập nhật DailyStats (skip side-effect)
        return {
          replayed: true as const,
          data: {
            groupId: body.groupId,
            totalQuestions: (existingResult as any).totalQuestions,
            correctCount: (existingResult as any).correctCount ?? 0,
          },
        };
      }
      throw new AppError('groupId conflict', HttpStatus.CONFLICT, ErrorCodes.GROUP_ID_CONFLICT);
    }

    // 3. Validate cả lô: mọi questionId tồn tại + cùng examType (trộn → 400)
    const questionIds = body.results.map((r) => r.questionId);
    const questions = await WritingQuestion.find({
      _id: { $in: questionIds },
      isDeleted: { $ne: true },
    }).lean();
    const questionMap = new Map(questions.map((q) => [String((q as any)._id), q]));
    if (questionMap.size !== questionIds.length) {
      throw new AppError('results[] chứa questionId không tồn tại', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    }
    const examTypes = new Set(body.results.map((r) => (questionMap.get(r.questionId) as any).examType));
    if (examTypes.size > 1) {
      throw new AppError(
        'Cùng sitting phải cùng examType — trộn TOEIC/IELTS không hợp lệ',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_FAILED,
      );
    }

    // 4. Check unique cả lô: 1 đề đã có attempt → 409 cả lô không ghi (BR-03)
    const dupAttempts = await PracticeAttempt.find(
      { userId, skillType: 'WRITING', refId: { $in: questionIds } },
      { refId: 1, _id: 0 },
    ).lean();
    if (dupAttempts.length > 0) {
      throw new AppError(
        'Bạn đã nộp bài cho đề này, không thể nộp lại.',
        HttpStatus.CONFLICT,
        ErrorCodes.WRITING_ALREADY_SUBMITTED,
      );
    }

    // 5. Tính lại phía server: wordCount, scorePercent
    const prepared = body.results.map((r) => {
      const question = questionMap.get(r.questionId) as any;
      return {
        question,
        result: r,
        wordCount: countWords(r.userText),
        scorePercent: bandToScorePercent(r.aiResult.bandScale, r.aiResult.bandScore),
      };
    });

    const totalQuestions = prepared.length;
    const correctCount = prepared.filter((p) => p.scorePercent >= SCORE_PASS_THRESHOLD).length;
    const totalTimeMs = prepared.reduce((sum, p) => sum + (p.result.durationMs ?? 0), 0);

    // 6. Ghi lô all-or-nothing trong 1 transaction (BR-05)
    //    Yêu cầu replica-set/sharded cluster — standalone Mongo sẽ throw → 500
    const userObjectId = new Types.ObjectId(userId);
    try {
      await mongoose.connection.transaction(async (session: ClientSession) => {
        await PracticeSessionResult.create(
          [
            {
              _id: new Types.ObjectId(body.groupId),
              userId: userObjectId,
              type: 'PRACTICE',
              scope: 'SINGLE',
              status: 'COMPLETED',
              totalQuestions,
              correctCount,
              accuracyPercent: Math.round((correctCount / totalQuestions) * 100),
              totalTimeMs,
              skillsSummary: [{ skillType: 'WRITING', correct: correctCount, total: totalQuestions }],
              completedAt: new Date(),
            },
          ],
          { session },
        );

        await PracticeAttempt.insertMany(
          prepared.map((p) => ({
            userId: userObjectId,
            skillType: 'WRITING',
            refId: new Types.ObjectId(p.result.questionId),
            groupId: new Types.ObjectId(body.groupId),
            scorePercent: p.scorePercent,
            durationMs: p.result.durationMs,
            submittedAt: new Date(),
            payload: {
              examType: p.question.examType,
              taskType: p.question.taskType,
              userText: p.result.userText,
              wordCount: p.wordCount,
              aiResult: p.result.aiResult,
            },
          })),
          { session },
        );
      });
    } catch (err: any) {
      // DuplicateKey E11000 trên unique {userId, skillType, refId} (race check→insert
      // song song giữa 2 request) → map thành 409 BR-03 (architecture.md §5.3.6)
      if (err?.code === 11000 || (err as any)?.errorResponse?.code === 11000) {
        throw new AppError(
          'Bạn đã nộp bài cho đề này, không thể nộp lại.',
          HttpStatus.CONFLICT,
          ErrorCodes.WRITING_ALREADY_SUBMITTED,
        );
      }
      throw err;
    }

    // 7. Sau commit lần đầu → cập nhật DailyStats (CAP-07, pattern UC-15/voice-ai)
    try {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      await DailyStats.findOneAndUpdate(
        { userId: userObjectId, date: todayMidnight },
        { $inc: { writingSubmissions: totalQuestions, timeSpent: Math.round(totalTimeMs / 1000) } },
        { upsert: true },
      );
    } catch (err) {
      // Stats fail không rollback giao dịch chính — log, user vẫn giữ kết quả
      console.error('[Writing] DailyStats update error after submit:', err);
    }

    return {
      replayed: false as const,
      data: { groupId: body.groupId, totalQuestions, correctCount },
    };
  } finally {
    // 8. DEL lock trong finally — commit, validation fail, hay abort đều nhả
    if (isRedisAvailable() && redis && locked) {
      try {
        await redis.del(lockKey);
      } catch (err) {
        console.error('[Writing] Redis submit lock DEL error:', err);
      }
    }
  }
}

// ─── W4: Xem lại kết quả (CAP-05) ──────────────────────────────────────────────

export async function getResult(userId: string, resultId: string) {
  // 1. Param đã Zod-validate ObjectId ở route — tránh CastError 500
  const result = await PracticeSessionResult.findById(resultId).lean();
  if (!result) {
    throw new AppError('Result not found', HttpStatus.NOT_FOUND, ErrorCodes.RESULT_NOT_FOUND);
  }

  // 2. Chỉ chủ sở hữu xem được (403 nếu khác userId)
  if (String((result as any).userId) !== userId) {
    throw new AppError('Access denied', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
  }

  // 3. Populate attempts theo groupId — payload snapshot lúc submit (BR-08)
  const attempts = await PracticeAttempt.find({ groupId: resultId }).sort({ submittedAt: 1 }).lean();

  return { result, attempts };
}
