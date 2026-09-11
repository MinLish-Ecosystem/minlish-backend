/**
 * UC-14 Reading Practice service (FR-110..FR-114).
 * Ownership (AD-3): nơi duy nhất đọc/ghi `ReadingQuestion` của UC-14.
 * Kết quả phiên KHÔNG ghi trực tiếp ở đây — bàn giao `practice-skill.service.recordBatch()`.
 */
import { createHash, randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { ReadingQuestion, IReadingQuestion, ReadingQuestionType } from '../models/ReadingQuestion';
import {
  BatchState,
  cleanupGroup,
  inspectBatch,
  PracticeSessionResultLean,
  recordBatch,
} from './practice-skill.service';
import { logAction } from './admin.service';
import { redis, isRedisAvailable, reportRedisFailure } from '../config/redis';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';
import type {
  ReadingAdminQuestionDto,
  ReadingSubmitDto,
  ReadingSubmitResultDto,
  AdminReadingListQueryDto,
} from '../validators/reading.schema';
import { readingAdminQuestionUnionSchema } from '../validators/reading.schema';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

const SESSION_SIZE = 15;
const SUBMIT_LOCK_PREFIX = 'minlish:reading:submit';
const SUBMIT_LOCK_TTL_SECONDS = 60;
const SUBMIT_DONE_TTL_SECONDS = 24 * 60 * 60;

// ─── DTO ─────────────────────────────────────────────────────────────────────

export interface ReadingQuestionDto {
  _id: string;
  type: ReadingQuestionType;
  level: CefrLevel;
  sentence?: string;
  title?: string;
  passage?: string;
  question?: string;
  options?: { id: string; text: string }[];
  correctAnswer?: string;
  wordOptions?: string[];
  correctMapping?: Record<string, string>;
  explanation?: string;
}

export interface ReadingSubmitResponse {
  groupId: string;
  correctCount: number;
  incorrectCount: number;
  totalQuestions: number;
  accuracy: number;
  totalTimeMs: number;
  averageTimeMs: number;
}

export interface ReadingSubmitOutcome {
  summary: ReadingSubmitResponse;
  // true khi request là retry cùng groupId — controller trả 200 thay vì 201
  replayed: boolean;
}

export interface ReadingAdminListResult {
  questions: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CONTENT_FIELDS = [
  'type',
  'level',
  'sentence',
  'title',
  'passage',
  'question',
  'options',
  'correctAnswer',
  'wordOptions',
  'correctMapping',
  'explanation',
] as const;

const OPTIONAL_CONTENT_FIELDS = new Set(['title', 'explanation']);

/** Projection DTO cho Learner — chỉ giữ field FE cần để hiển thị + chấm feedback. */
function toQuestionDto(doc: Partial<IReadingQuestion> & { _id: unknown }): ReadingQuestionDto {
  const dto: ReadingQuestionDto = {
    _id: String(doc._id),
    type: doc.type as ReadingQuestionType,
    level: doc.level as CefrLevel,
  };
  const source = doc as unknown as Record<string, unknown>;
  for (const field of CONTENT_FIELDS) {
    const value = source[field];
    if (value !== null && value !== undefined) {
      (dto as unknown as Record<string, unknown>)[field] = value;
    }
  }
  return dto;
}

/** Keep-last theo `questionId` — Learner có thể quay lại submit đè kết quả cũ (AF-06). */
function keepLastResults(results: ReadingSubmitResultDto[]): ReadingSubmitResultDto[] {
  const byQuestion = new Map<string, ReadingSubmitResultDto>();
  for (const result of results) {
    byQuestion.set(result.questionId, result);
  }
  return [...byQuestion.values()];
}

/** Chuẩn hóa selectedAnswer để fingerprint ổn định: string giữ nguyên, object sort key. */
function canonicalSelectedAnswer(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1));
    return JSON.stringify(Object.fromEntries(entries));
  }
  return JSON.stringify(value);
}

/**
 * Fingerprint SHA-256 của request đã chuẩn hóa — chống retry body khác cùng groupId.
 * Chuẩn hóa: keep-last đã áp trước khi gọi, sort theo questionId, sort key object,
 * timestamp quy về epoch ms (retry gửi ISO format khác nhau vẫn cùng fingerprint).
 */
function computeFingerprint(
  groupId: string,
  startedAt: string,
  completedAt: string,
  results: ReadingSubmitResultDto[],
): string {
  const normalized = [...results]
    .sort((a, b) => (a.questionId < b.questionId ? -1 : 1))
    .map((r) => [r.questionId, canonicalSelectedAnswer(r.selectedAnswer), r.timeSpent]);
  return createHash('sha256')
    .update(
      JSON.stringify({
        groupId,
        startedAt: new Date(startedAt).getTime(),
        completedAt: new Date(completedAt).getTime(),
        results: normalized,
      }),
    )
    .digest('hex');
}

/** Phần dữ liệu câu hỏi cần cho việc chấm/snapshot — dùng chung cho document và lean object. */
type GradeableQuestion = Pick<IReadingQuestion, 'type' | 'level' | 'correctAnswer' | 'correctMapping'>;

/** Chấm một câu theo dữ liệu DB — server là nguồn sự thật, không tin client (BR-03, OQ-3). */
function gradeAnswer(question: GradeableQuestion, selectedAnswer: unknown): 0 | 100 {
  if (selectedAnswer === null || selectedAnswer === undefined) {
    return 0;
  }

  if (question.type === 'word-bank-fill') {
    // Sai/thiếu/thừa bất kỳ blank nào → sai cả câu; object rỗng cũng là chưa trả lời (BR-03)
    if (typeof selectedAnswer !== 'object' || Array.isArray(selectedAnswer)) {
      return 0;
    }
    const answer = selectedAnswer as Record<string, unknown>;
    const mapping = question.correctMapping ?? {};
    const mappingKeys = Object.keys(mapping);
    if (mappingKeys.length === 0) {
      return 0;
    }
    const answerKeys = Object.keys(answer);
    if (answerKeys.length !== mappingKeys.length) {
      return 0;
    }
    const allMatch = mappingKeys.every((key) => key in answer && answer[key] === mapping[key]);
    return allMatch ? 100 : 0;
  }

  // short-sentence-mcq / main-idea-mcq: so khớp option id
  return typeof selectedAnswer === 'string' && selectedAnswer === question.correctAnswer ? 100 : 0;
}

function buildSubmitResponse(result: {
  _id: unknown;
  correctCount: number;
  totalQuestions: number;
  totalTimeMs: number;
  accuracyPercent: number;
}): ReadingSubmitResponse {
  const incorrectCount = result.totalQuestions - result.correctCount;
  return {
    groupId: String(result._id),
    correctCount: result.correctCount,
    incorrectCount,
    totalQuestions: result.totalQuestions,
    accuracy: result.accuracyPercent,
    totalTimeMs: result.totalTimeMs,
    averageTimeMs: result.totalTimeMs / result.totalQuestions,
  };
}

// ─── Redis submit lock (idempotent theo groupId — R7) ───────────────────────

type AcquireLockResult =
  | { status: 'acquired'; key: string; token: string }
  | { status: 'busy' }
  | { status: 'skipped' };

function submitLockKey(userId: string, groupId: string): string {
  return `${SUBMIT_LOCK_PREFIX}:${userId}:${groupId}`;
}

function submitDoneKey(userId: string, groupId: string): string {
  return `${SUBMIT_LOCK_PREFIX}:${userId}:${groupId}:done`;
}

// Chỉ chủ sở hữu lockToken được DEL/PEXPIRE — lock hết hạn/re-owned không bị request cũ xóa/gia hạn
const RELEASE_LOCK_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
const RENEW_LOCK_SCRIPT =
  "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end";

async function acquireSubmitLock(userId: string, groupId: string): Promise<AcquireLockResult> {
  if (!redis || !isRedisAvailable()) {
    return { status: 'skipped' };
  }
  const key = submitLockKey(userId, groupId);
  const token = randomUUID();
  try {
    const value = await redis.set(key, token, 'EX', SUBMIT_LOCK_TTL_SECONDS, 'NX');
    return value === 'OK' ? { status: 'acquired', key, token } : { status: 'busy' };
  } catch (err) {
    // Redis lỗi không chặn luồng chính — Mongo vẫn là nguồn idempotency chính
    console.error('[reading] Acquire submit lock failed:', err);
    reportRedisFailure(err);
    return { status: 'skipped' };
  }
}

/**
 * Gia hạn lock theo `lockToken` (data-model §Redis: "TTL 60 giây, gia hạn khi đang xử lý").
 * Chỉ gia hạn khi value hiện tại vẫn là token của mình — lock đã bị chiếm lại thì bỏ qua.
 */
async function renewSubmitLock(lock: AcquireLockResult): Promise<void> {
  if (lock.status !== 'acquired' || !redis || !isRedisAvailable()) {
    return;
  }
  try {
    await redis.eval(RENEW_LOCK_SCRIPT, 1, lock.key, String(SUBMIT_LOCK_TTL_SECONDS), lock.token);
  } catch (err) {
    console.error('[reading] Renew submit lock failed (TTL sẽ tự hết hạn):', err);
    reportRedisFailure(err);
  }
}

async function releaseSubmitLock(lock: AcquireLockResult): Promise<void> {
  if (lock.status !== 'acquired' || !redis || !isRedisAvailable()) {
    return;
  }
  try {
    await redis.eval(RELEASE_LOCK_SCRIPT, 1, lock.key, lock.token);
  } catch (err) {
    console.error('[reading] Release submit lock failed (TTL sẽ tự hết hạn):', err);
    reportRedisFailure(err);
  }
}

async function markSubmitDone(userId: string, groupId: string): Promise<void> {
  if (!redis || !isRedisAvailable()) {
    return;
  }
  try {
    await redis.set(submitDoneKey(userId, groupId), '1', 'EX', SUBMIT_DONE_TTL_SECONDS);
  } catch (err) {
    // DB đã ghi thành công — không rollback; retry sẽ replay trực tiếp từ Mongo
    console.error('[reading] Mark submit done failed (không rollback kết quả DB):', err);
    reportRedisFailure(err);
  }
}

// ─── Learner: lấy phiên đề (CAP-1, FR-110) ──────────────────────────────────

/**
 * Lấy phiên Reading tối đa 15 câu random trong pool `isDeleted=false` + filter `level`.
 * Pool ít hơn 15 → trả toàn bộ pool (AC-15). Pool rỗng → 404 ERR_NO_QUESTIONS_AVAILABLE.
 *
 * @throws AppError 404 khi không có câu hỏi nào sau filter
 */
export async function getSession(level?: CefrLevel): Promise<ReadingQuestionDto[]> {
  const match: Record<string, unknown> = { isDeleted: false };
  if (level) {
    match.level = level;
  }

  const docs = await ReadingQuestion.aggregate<Record<string, unknown>>([
    { $match: match },
    { $sample: { size: SESSION_SIZE } },
    { $project: { isDeleted: 0, deletedAt: 0, __v: 0, createdAt: 0, updatedAt: 0 } },
  ]);

  if (docs.length === 0) {
    throw new AppError(
      'Bộ đề Reading đang được cập nhật, quay lại sau nhé!',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NO_QUESTIONS_AVAILABLE,
    );
  }

  return docs.map((doc) => toQuestionDto(doc as unknown as Partial<IReadingQuestion> & { _id: unknown }));
}

// ─── Learner: submit phiên (CAP-5, FR-114) ──────────────────────────────────

/** Đọc trạng thái batch qua owner service (AD-3) — xem `practice-skill.service.inspectBatch`. */
function getBatchState(groupId: Types.ObjectId, userId: string, fingerprint: string): Promise<BatchState> {
  return inspectBatch({ groupId, userId, requestFingerprint: fingerprint, skillType: 'READING' });
}

async function replayComplete(result: PracticeSessionResultLean): Promise<ReadingSubmitOutcome> {
  return { summary: buildSubmitResponse(result), replayed: true };
}

/**
 * Ghi lô kết quả phiên Reading khi Finish: server chấm lại theo DB, tạo 1
 * `PracticeSessionResult` (`_id=groupId`) + N `PracticeAttempt` cùng group.
 * Retry cùng `groupId` + cùng fingerprint → replay kết quả cũ (idempotent R7).
 *
 * @throws AppError 400 ERR_VALIDATION_FAILED khi body/question không hợp lệ
 * @throws AppError 409 ERR_SUBMIT_IN_PROGRESS khi có request song song cùng groupId
 * @throws AppError 409 ERR_GROUP_ID_CONFLICT khi groupId thuộc user khác / body khác fingerprint
 * @throws AppError 500 ERR_INTERNAL khi ghi lô hoặc cleanup thất bại
 */
export async function submitSession(userId: string, dto: ReadingSubmitDto): Promise<ReadingSubmitOutcome> {
  const groupId = new Types.ObjectId(dto.groupId);
  const startedAt = new Date(dto.startedAt);
  const completedAt = new Date(dto.completedAt);

  const results = keepLastResults(dto.results);
  if (
    results.length < 1 ||
    results.length > SESSION_SIZE ||
    Number.isNaN(startedAt.getTime()) ||
    Number.isNaN(completedAt.getTime()) ||
    startedAt > completedAt ||
    results.some((r) => !Number.isSafeInteger(r.timeSpent) || r.timeSpent < 0)
  ) {
    throw new AppError('Dữ liệu nộp bài không hợp lệ', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  const fingerprint = computeFingerprint(dto.groupId, dto.startedAt, dto.completedAt, results);

  // Fast path: batch đã hoàn tất → replay không cần lock
  const initialState = await getBatchState(groupId, userId, fingerprint);
  if (initialState.status === 'complete') {
    return replayComplete(initialState.result);
  }
  if (initialState.status === 'conflict') {
    throw new AppError('groupId đã được dùng cho phiên khác', HttpStatus.CONFLICT, ErrorCodes.GROUP_ID_CONFLICT);
  }

  // Bước 3: lock chống submit song song cùng groupId
  const lock = await acquireSubmitLock(userId, dto.groupId);
  if (lock.status === 'busy') {
    const racedState = await getBatchState(groupId, userId, fingerprint);
    if (racedState.status === 'complete') {
      return replayComplete(racedState.result);
    }
    throw new AppError('Phiên đang được xử lý, vui lòng thử lại', HttpStatus.CONFLICT, ErrorCodes.SUBMIT_IN_PROGRESS);
  }

  try {
    // Trong lock: state ổn định — cleanup batch dở dang TRƯỚC khi ghi lô mới
    const state = await getBatchState(groupId, userId, fingerprint);
    if (state.status === 'complete') {
      return replayComplete(state.result);
    }
    if (state.status === 'conflict') {
      throw new AppError('groupId đã được dùng cho phiên khác', HttpStatus.CONFLICT, ErrorCodes.GROUP_ID_CONFLICT);
    }
    if (state.status === 'incomplete') {
      // Chỉ xóa đúng group đang giữ lock (data-model §Batch Integrity)
      await cleanupGroup(groupId);
    }

    // Bước 5: load câu hỏi kể cả đã soft-delete (bảo toàn lịch sử — R8)
    const questionIds = results.map((r) => new Types.ObjectId(r.questionId));
    const questions = await ReadingQuestion.find({ _id: { $in: questionIds } }).lean();
    if (questions.length !== questionIds.length) {
      throw new AppError('Một số câu hỏi không tồn tại', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    }
    const questionById = new Map(questions.map((q) => [String(q._id), q]));

    // Bước 6: server chấm lại theo DB
    const scored = results.map((r) => {
      const question = questionById.get(r.questionId) as unknown as GradeableQuestion;
      return {
        refId: new Types.ObjectId(r.questionId),
        scorePercent: gradeAnswer(question, r.selectedAnswer),
        durationMs: r.timeSpent,
        payload: {
          type: question.type,
          level: question.level,
          selectedAnswer: r.selectedAnswer,
        },
      };
    });

    const correctCount = scored.filter((s) => s.scorePercent === 100).length;
    const totalTimeMs = scored.reduce((sum, s) => sum + s.durationMs, 0);
    const totalQuestions = scored.length;

    // Gia hạn lock trước thao tác ghi (data-model §Redis: TTL 60s, gia hạn khi đang xử lý)
    await renewSubmitLock(lock);

    // Bước 7: ghi lô — owner duy nhất là practice-skill.service
    let batch;
    try {
      batch = await recordBatch({
        groupId,
        userId: new Types.ObjectId(userId),
        skillType: 'READING',
        type: 'PRACTICE',
        scope: 'SINGLE',
        startedAt,
        completedAt,
        requestFingerprint: fingerprint,
        scored,
        totals: { totalQuestions, correctCount, totalTimeMs },
      });
    } catch (err) {
      // Race khi lock bị skip (Redis down): request khác cùng user + cùng fingerprint
      // vừa tạo group trước mình. Phân loại lại theo state thay vì báo conflict sai (api-spec §2).
      if (err instanceof AppError && err.errorCode === ErrorCodes.GROUP_ID_CONFLICT) {
        const racedState = await getBatchState(groupId, userId, fingerprint);
        if (racedState.status === 'complete') {
          return replayComplete(racedState.result);
        }
        if (racedState.status === 'conflict') {
          throw err;
        }
        throw new AppError(
          'Phiên đang được xử lý, vui lòng thử lại',
          HttpStatus.CONFLICT,
          ErrorCodes.SUBMIT_IN_PROGRESS,
        );
      }
      throw err;
    }

    // Bước 9: đánh dấu hoàn tất — lỗi Redis không rollback kết quả DB
    await markSubmitDone(userId, dto.groupId);

    const summary: ReadingSubmitResponse = {
      groupId: dto.groupId,
      correctCount,
      incorrectCount: totalQuestions - correctCount,
      totalQuestions,
      accuracy: batch.accuracyPercent,
      totalTimeMs,
      averageTimeMs: totalTimeMs / totalQuestions,
    };
    return { summary, replayed: false };
  } finally {
    await releaseSubmitLock(lock);
  }
}

// ─── Admin: quản lý ngân hàng câu hỏi (CAP-6, FR-114) ───────────────────────

/** Danh sách câu hỏi cho Admin — filter `isDeleted:false`, type/level tùy chọn, sort mới nhất trước. */
export async function adminListQuestions(query: AdminReadingListQueryDto): Promise<ReadingAdminListResult> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { isDeleted: false };
  if (query.type) {
    filter.type = query.type;
  }
  if (query.level) {
    filter.level = query.level;
  }

  const [questions, total] = await Promise.all([
    ReadingQuestion.find(filter).select('-__v').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ReadingQuestion.countDocuments(filter),
  ]);

  return {
    questions: questions as unknown as Record<string, unknown>[],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Tạo câu hỏi Reading + ghi AdminAuditLog. Audit fail → xóa câu vừa tạo (không coi mutation là success).
 *
 * @throws AppError 500 ERR_INTERNAL khi audit thất bại
 */
export async function adminCreateQuestion(dto: ReadingAdminQuestionDto, adminId: string) {
  const question = await ReadingQuestion.create({ ...dto, isDeleted: false });

  try {
    await logAction({
      adminId,
      action: 'READING_Q_CREATE',
      targetId: String(question._id),
      targetType: 'reading_question',
      before: null,
      after: question.toObject(),
    });
  } catch (err) {
    console.error(`[reading] Audit create failed — rollback question ${String(question._id)}:`, err);
    await ReadingQuestion.findByIdAndDelete(question._id).catch((cleanupErr) =>
      console.error('[reading] Rollback created question failed:', cleanupErr),
    );
    throw new AppError('Không thể ghi audit log cho thao tác tạo câu hỏi', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL);
  }

  return toAdminResponse(question);
}

/**
 * Cập nhật câu hỏi: merge partial với document hiện có rồi validate toàn bộ theo type hiện tại.
 * `type` immutable; `null` xóa field optional; không update câu đã soft-delete.
 *
 * @throws AppError 404 ERR_QUESTION_NOT_FOUND khi không tồn tại/đã xóa
 * @throws AppError 400 ERR_VALIDATION_FAILED khi type đổi hoặc document sau merge không hợp lệ
 * @throws AppError 500 ERR_INTERNAL khi audit thất bại (đã restore document cũ)
 */
export async function adminUpdateQuestion(id: string, dto: Record<string, unknown>, adminId: string) {
  const current = await ReadingQuestion.findOne({ _id: id, isDeleted: false });
  if (!current) {
    throw new AppError('Câu hỏi không tồn tại hoặc đã bị xóa', HttpStatus.NOT_FOUND, ErrorCodes.QUESTION_NOT_FOUND);
  }

  if (dto.type !== undefined && dto.type !== current.type) {
    throw new AppError('Không thể đổi type của câu hỏi', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  const merged = buildMergedContent(current, dto);
  const parsed = readingAdminQuestionUnionSchema.safeParse(merged);
  if (!parsed.success) {
    throw new AppError(
      'Dữ liệu câu hỏi không hợp lệ sau khi merge',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
    );
  }

  const before = pickContent(current);
  const unsetFields = Object.fromEntries(
    Object.keys(dto)
      .filter((key) => dto[key] === null && OPTIONAL_CONTENT_FIELDS.has(key))
      .map((key) => [key, 1]),
  );

  const updated = await ReadingQuestion.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $set: parsed.data, ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}) },
    { new: true, runValidators: true },
  );
  if (!updated) {
    throw new AppError('Câu hỏi không tồn tại hoặc đã bị xóa', HttpStatus.NOT_FOUND, ErrorCodes.QUESTION_NOT_FOUND);
  }

  try {
    await logAction({
      adminId,
      action: 'READING_Q_UPDATE',
      targetId: id,
      targetType: 'reading_question',
      before,
      after: pickContent(updated),
    });
  } catch (err) {
    console.error(`[reading] Audit update failed — restore question ${id}:`, err);
    // Bù trừ mutation: khôi phục nguyên trạng document trước khi update
    await ReadingQuestion.findByIdAndUpdate(id, { $set: before }).catch((restoreErr) =>
      console.error('[reading] Restore question after audit failure failed:', restoreErr),
    );
    throw new AppError('Không thể ghi audit log cho thao tác cập nhật', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL);
  }

  return toAdminResponse(updated);
}

/**
 * Soft delete câu hỏi (NFR-037): set `isDeleted=true` + `deletedAt`; lịch sử attempt giữ nguyên.
 * Audit fail → khôi phục trạng thái trước khi trả lỗi.
 *
 * @throws AppError 404 ERR_QUESTION_NOT_FOUND khi không tồn tại/đã xóa
 * @throws AppError 500 ERR_INTERNAL khi audit thất bại (đã restore trạng thái)
 */
export async function adminSoftDeleteQuestion(id: string, adminId: string) {
  const doc = await ReadingQuestion.findOne({ _id: id, isDeleted: false });
  if (!doc) {
    throw new AppError('Câu hỏi không tồn tại hoặc đã bị xóa', HttpStatus.NOT_FOUND, ErrorCodes.QUESTION_NOT_FOUND);
  }

  const before = pickContent(doc);
  const deletedAt = new Date();
  const deleted = await ReadingQuestion.findByIdAndUpdate(
    id,
    { $set: { isDeleted: true, deletedAt } },
    { new: true },
  );
  if (!deleted) {
    throw new AppError('Câu hỏi không tồn tại hoặc đã bị xóa', HttpStatus.NOT_FOUND, ErrorCodes.QUESTION_NOT_FOUND);
  }

  try {
    await logAction({
      adminId,
      action: 'READING_Q_DELETE',
      targetId: id,
      targetType: 'reading_question',
      before,
      after: { isDeleted: true, deletedAt },
    });
  } catch (err) {
    console.error(`[reading] Audit delete failed — restore question ${id}:`, err);
    await ReadingQuestion.findByIdAndUpdate(id, { $set: { isDeleted: false, deletedAt: null } }).catch((restoreErr) =>
      console.error('[reading] Restore question after audit failure failed:', restoreErr),
    );
    throw new AppError('Không thể ghi audit log cho thao tác xóa', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL);
  }

  return toAdminResponse(deleted);
}

/** Merge partial update với document hiện có, chỉ giữ content field; null optional = xóa field. */
function buildMergedContent(current: IReadingQuestion, dto: Record<string, unknown>): Record<string, unknown> {
  const source = current.toObject() as unknown as Record<string, unknown>;
  const merged: Record<string, unknown> = {};

  for (const field of CONTENT_FIELDS) {
    const value = source[field];
    if (value !== null && value !== undefined) {
      merged[field] = value;
    }
  }
  merged.type = current.type;

  for (const [key, value] of Object.entries(dto)) {
    if (!(CONTENT_FIELDS as readonly string[]).includes(key) || key === 'type') {
      continue;
    }
    if (value === null) {
      delete merged[key];
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

/** Snapshot nội dung câu hỏi cho audit (bỏ field nội bộ mongoose). */
function pickContent(doc: IReadingQuestion): Record<string, unknown> {
  const source = doc.toObject() as unknown as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of CONTENT_FIELDS) {
    if (source[field] !== undefined) {
      picked[field] = source[field];
    }
  }
  return picked;
}

/** Response Admin: giữ field quản lý nhưng bỏ `__v` (AD-8 — không lộ field nội bộ). */
function toAdminResponse(doc: IReadingQuestion): Record<string, unknown> {
  const obj = doc.toObject() as unknown as Record<string, unknown>;
  delete obj.__v;
  return obj;
}
