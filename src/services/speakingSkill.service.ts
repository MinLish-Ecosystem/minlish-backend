import crypto from 'crypto';
import { Types } from 'mongoose';
import { redis, isRedisAvailable, reportRedisFailure } from '../config/redis';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';
import { SpeakingPrompt, ISpeakingPrompt, SpeakingLevel } from '../models/SpeakingPrompt';
import {
  PracticeSession,
  IPracticeSession,
  PracticeSessionType,
} from '../models/PracticeSession';
import {
  PracticeSessionResult,
  IPracticeSessionResult,
} from '../models/PracticeSessionResult';
import { PracticeAttempt, IPracticeAttempt } from '../models/PracticeAttempt';
import { User } from '../models/User';
import {
  recordBatch,
  cleanupGroup,
  countGroupAttempts,
  DuplicateGroupError,
} from './practice-skill.service';
import { getSpeakingScoringEngine } from './scoring';
import { ScoringError } from '../utils/speakingScoring.util';

/**
 * speakingSkill.service — Ownership speakingPrompts + orchestrate Speaking UC-16
 * (FR-112/114/115/116). Controller không chạm DB; service không nhận req/res (AD-3).
 * Result/Attempt chỉ ghi qua practice-skill.service.recordBatch() (D-1).
 */

// ─── Hằng số nghiệp vụ (không magic number — coding-rules §9.3) ────────────────

const SPEAKING_LOCK_TTL_SECONDS = 60; // NX EX 60 (BR-07)
const SPEAKING_DONE_TTL_SECONDS = 24 * 60 * 60; // best-effort replay cache (data-model §5)
const MAX_ANSWERS = 12; // OQ-2: default count=10, max 12
const CEFR_LEVELS: SpeakingLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const lockKey = (userId: string, groupId: string) =>
  `minlish:speaking:submit:${userId}:${groupId}`;
const doneKey = (groupId: string) => `minlish:speaking:submit:done:${groupId}`;

/**
 * Gating learner theo C-2: phải verify email + không bị ban mới dùng được tính năng học.
 * Đặt tại service (không sửa verifyToken chung) để không ảnh hưởng UC khác.
 *
 * @throws AppError 403 ERR_EMAIL_NOT_VERIFIED khi isVerified=false
 * @throws AppError 403 FORBIDDEN khi isActive=false (soft ban)
 */
async function assertLearnerEligible(userId: string): Promise<void> {
  const user = await User.findById(userId).select('isVerified isActive').lean<{
    isVerified: boolean;
    isActive: boolean;
  }>();
  if (!user) {
    throw new AppError('Tài khoản không tồn tại.', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  if (!user.isVerified) {
    throw new AppError(
      'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email.',
      HttpStatus.FORBIDDEN,
      ErrorCodes.EMAIL_NOT_VERIFIED
    );
  }
  if (!user.isActive) {
    throw new AppError('Tài khoản đã bị khóa.', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
  }
}

// ─── CAP-1 / API-01 — List sessions ───────────────────────────────────────────

export interface ListSpeakingSessionsParams {
  userId: string;
  level?: SpeakingLevel;
  type?: PracticeSessionType;
  page: number;
  limit: number;
}

/**
 * Liệt kê phiên Speaking active (scope=SINGLE), mới nhất trước (TBD-5).
 * Không có phiên → mảng rỗng, FE tự render empty-state (CAP-1).
 */
export async function listSpeakingSessions(params: ListSpeakingSessionsParams): Promise<{
  sessions: Array<{
    id: string;
    name: string;
    type: PracticeSessionType;
    scope: string;
    source: string;
    filterLevel: string | null;
    totalItems: number;
    createdAt: Date;
  }>;
  pagination: { page: number; limit: number; total: number };
}> {
  await assertLearnerEligible(params.userId);
  const filter: Record<string, unknown> = { scope: 'SINGLE' };
  // items của phiên Speaking chứa skillType SPEAKING (phiên dùng chung model, lọc qua items)
  filter['items.skillType'] = 'SPEAKING';
  if (params.level) {
    filter.filterLevel = params.level;
  }
  if (params.type) {
    filter.type = params.type;
  }

  const skip = (params.page - 1) * params.limit;
  const [docs, total] = await Promise.all([
    PracticeSession.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit).lean(),
    PracticeSession.countDocuments(filter),
  ]);

  const sessions = docs.map((s) => ({
    id: (s._id as Types.ObjectId).toHexString(),
    name: s.name,
    type: s.type,
    scope: s.scope,
    source: s.source,
    filterLevel: s.filterLevel ?? null,
    // List không trừ prompt soft-delete — chỉ đếm lúc detail (api-spec API-01)
    totalItems: Array.isArray(s.items) ? s.items.length : 0,
    createdAt: s.createdAt,
  }));

  return { sessions, pagination: { page: params.page, limit: params.limit, total } };
}

// ─── CAP-2 / API-02 — Session detail ref-only ─────────────────────────────────

/**
 * Chi tiết phiên ref-only: items {skillType, refId} + prompts đã resolve
 * và lọc soft-delete (R5 — phiên co lại, KHÔNG 404 cả phiên).
 *
 * @throws AppError 404 ERR_SESSION_NOT_FOUND — sessionId không tồn tại
 * @throws AppError 404 ERR_NO_QUESTIONS_AVAILABLE — pool rỗng sau lọc soft-delete
 */
export async function getSpeakingSessionDetail(
  userId: string,
  sessionId: string
): Promise<{
  session: {
    id: string;
    name: string;
    type: PracticeSessionType;
    scope: string;
    source: string;
    filterLevel: string | null;
    items: Array<{ skillType: 'SPEAKING'; refId: string }>;
  };
  prompts: Array<{
    id: string;
    level: SpeakingLevel;
    referenceText: string;
    audioUrl: string | null;
    source: string;
  }>;
}> {
  await assertLearnerEligible(userId);
  const session = await PracticeSession.findById(sessionId).lean<IPracticeSession>();
  if (!session) {
    throw new AppError('Phiên luyện nói không tồn tại.', HttpStatus.NOT_FOUND, ErrorCodes.SESSION_NOT_FOUND);
  }

  const speakingItems = session.items
    .filter((i) => i.skillType === 'SPEAKING')
    .map((i) => ({ skillType: 'SPEAKING' as const, refId: i.refId.toHexString() }));

  if (speakingItems.length === 0) {
    throw new AppError(
      'Phiên không còn câu khả dụng.',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NO_QUESTIONS_AVAILABLE
    );
  }

  const refIds = speakingItems.map((i) => new Types.ObjectId(i.refId));
  // Lọc soft-delete tại service — không để FE tự lọc (R5, C-7)
  const promptDocs = await SpeakingPrompt.find({
    _id: { $in: refIds },
    isActive: true,
  }).lean<ISpeakingPrompt[]>();

  if (promptDocs.length === 0) {
    throw new AppError(
      'Phiên không còn câu khả dụng.',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NO_QUESTIONS_AVAILABLE
    );
  }

  // Phiên co lại: chỉ giữ items trỏ prompt còn active, đúng thứ tự giáo án (R5)
  const activeIds = new Set(promptDocs.map((p) => p._id.toHexString()));
  const availableItems = speakingItems.filter((i) => activeIds.has(i.refId));

  const prompts = promptDocs.map((p) => ({
    id: p._id.toHexString(),
    level: p.level,
    referenceText: p.referenceText,
    audioUrl: p.audioUrl,
    source: p.source,
  }));

  return {
    session: {
      id: session._id.toHexString(),
      name: session.name,
      type: session.type,
      scope: session.scope,
      source: session.source,
      filterLevel: session.filterLevel ?? null,
      items: availableItems,
    },
    prompts,
  };
}

// ─── CAP-3/4/8 / API-03 — Submit + scoring + batch all-or-nothing ─────────────

export interface SpeakingAnswerInput {
  skillType: 'SPEAKING';
  refId: string;
  transcript: string;
  durationMs?: number;
}

export interface SubmitSpeakingSessionInput {
  groupId: string;
  answers: SpeakingAnswerInput[];
  startedAt: string;
  completedAt: string;
}

export interface SubmitSpeakingSessionResult {
  groupId: string;
  totalItems: number;
  skillsSummary: Array<{
    skillType: 'SPEAKING';
    avgScorePercent: number;
    totalItems: number;
    totalTimeMs: number;
  }>;
  replay: boolean;
}

/**
 * Nộp lô & chấm khi Finish (CAP-3 + CAP-4 + CAP-8):
 * keep-last theo refId → fingerprint → kiểm tra replay/conflict → Redis lock
 * → chấm server-side toàn bộ → recordBatch all-or-nothing.
 *
 * Server là source of truth: KHÔNG nhận scorePercent từ client (OQ-5).
 * Lần đầu 201, retry cùng fingerprint 200 replay, song song 409 (BR-07).
 *
 * @throws AppError 400 ERR_SESSION_NOT_FOUND — phiên không tồn tại
 * @throws AppError 400 ERR_TRANSCRIPT_EMPTY / ERR_TRANSCRIPT_TOO_SHORT
 * @throws AppError 409 ERR_SUBMIT_IN_PROGRESS — submit song song cùng groupId
 * @throws AppError 409 ERR_GROUP_ID_CONFLICT — groupId của user khác hoặc khác body
 * @throws AppError 500 ERR_SCORING_FAILED — engine lỗi, không lưu gì
 */
export async function submitSpeakingSession(
  userId: string,
  sessionId: string,
  input: SubmitSpeakingSessionInput
): Promise<SubmitSpeakingSessionResult> {
  await assertLearnerEligible(userId);

  // Phiên phải tồn tại trước khi chấm (AF-01)
  const session = await PracticeSession.findById(sessionId).lean<IPracticeSession>();
  if (!session) {
    throw new AppError('Phiên luyện nói không tồn tại.', HttpStatus.NOT_FOUND, ErrorCodes.SESSION_NOT_FOUND);
  }

  // Keep-last theo refId: học viên thu lại đè kết quả cũ trong phiên
  const kept = new Map<string, SpeakingAnswerInput>();
  for (const answer of input.answers) {
    kept.set(answer.refId, answer);
  }
  const answers = [...kept.values()];
  if (answers.length < 1 || answers.length > MAX_ANSWERS) {
    throw new AppError(
      `Số câu nộp phải từ 1 đến ${MAX_ANSWERS} sau keep-last.`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  // Fingerprint từ request chuẩn hóa — phát hiện retry khác body (BR-07)
  const fingerprint = computeFingerprint(userId, sessionId, answers, input.startedAt, input.completedAt);

  // Idempotency: kết quả đã có → replay hoặc conflict
  const existing = await PracticeSessionResult.findById(input.groupId).lean<IPracticeSessionResult>();
  if (existing) {
    if (existing.userId.toHexString() !== userId || existing.fingerprint !== fingerprint) {
      throw new AppError(
        'groupId đã được dùng cho một lần nộp khác.',
        HttpStatus.CONFLICT,
        ErrorCodes.GROUP_ID_CONFLICT
      );
    }
    // Result dở dang (thiếu attempts) → cleanup rồi xử lý lại như flow mới (sequence §3)
    const attemptCount = await countGroupAttempts(input.groupId);
    if (attemptCount === existing.totalQuestions) {
      return toSubmitResult(existing, true);
    }
    await cleanupGroup(input.groupId);
  }

  // Redis lock chống submit song song — lockToken để DEL an toàn (D-4)
  const lockToken = crypto.randomUUID();
  const key = lockKey(userId, input.groupId);
  const acquired = await acquireLock(key, lockToken);
  if (!acquired) {
    throw new AppError(
      'Phiên đang được xử lý, vui lòng thử lại sau.',
      HttpStatus.CONFLICT,
      ErrorCodes.SUBMIT_IN_PROGRESS
    );
  }

  try {
    // Load prompt kể cả isActive=false để snapshot đúng bản learner đã làm (C-6)
    const refIds = answers.map((a) => new Types.ObjectId(a.refId));
    const promptDocs = await SpeakingPrompt.find({ _id: { $in: refIds } }).lean<ISpeakingPrompt[]>();
    const promptMap = new Map(promptDocs.map((p) => [p._id.toHexString(), p]));

    for (const answer of answers) {
      const prompt = promptMap.get(answer.refId);
      if (!prompt) {
        throw new AppError(
          `refId ${answer.refId} không tồn tại trong ngân hàng mẫu.`,
          HttpStatus.BAD_REQUEST,
          ErrorCodes.VALIDATION_FAILED
        );
      }
    }

    // Chấm server-side bằng engine duy nhất (CAP-3/7)
    const engine = getSpeakingScoringEngine();
    const completedAtDate = new Date(input.completedAt);
    const attemptRecords = answers.map((answer) => {
      const prompt = promptMap.get(answer.refId)!;
      let scored;
      try {
        scored = engine.score(answer.transcript, prompt.referenceText);
      } catch (err) {
        if (err instanceof ScoringError) {
          throw mapScoringError(err);
        }
        throw new AppError(
          'Lỗi chấm điểm. Vui lòng thử lại sau.',
          HttpStatus.INTERNAL_SERVER_ERROR,
          ErrorCodes.SCORING_FAILED
        );
      }
      // Snapshot bất biến: referenceText + engine tại lúc chấm (R8, C-6)
      return {
        skillType: 'SPEAKING' as const,
        refId: answer.refId,
        scorePercent: scored.scorePercent,
        durationMs: answer.durationMs ?? 0,
        submittedAt: completedAtDate,
        payload: {
          transcript: answer.transcript,
          referenceText: prompt.referenceText,
          matchedWords: scored.matchedWords,
          totalWords: scored.totalWords,
          engine: engine.name,
        },
      };
    });

    // skillsSummary cho SPEAKING (TBD-6) + totalTimeMs đơn giản v1 (C-10)
    const totalItems = attemptRecords.length;
    const avgScorePercent =
      Math.round(attemptRecords.reduce((sum, a) => sum + a.scorePercent, 0) / totalItems);
    const totalTimeMs = Math.max(0, completedAtDate.getTime() - new Date(input.startedAt).getTime());

    const result = await recordBatch({
      groupId: input.groupId,
      userId,
      sessionId,
      type: session.type,
      scope: session.scope,
      skillsSummary: [
        { skillType: 'SPEAKING', avgScorePercent, totalItems, totalTimeMs },
      ],
      totalQuestions: totalItems,
      totalTimeMs,
      fingerprint,
      completedAt: completedAtDate,
      attempts: attemptRecords,
    }).catch((err) => {
      // Race khi lock miss (Redis down): request khác đã ghi group này → 409
      if (err instanceof DuplicateGroupError) {
        throw new AppError(
          'Phiên đang được xử lý, vui lòng thử lại sau.',
          HttpStatus.CONFLICT,
          ErrorCodes.SUBMIT_IN_PROGRESS
        );
      }
      throw err;
    });

    // Trạng thái hoàn tất best-effort 24h — lỗi chỉ log, không phá submit (architecture §3.9)
    markDone(input.groupId);

    return {
      groupId: result._id.toHexString(),
      totalItems,
      skillsSummary: [
        { skillType: 'SPEAKING', avgScorePercent, totalItems, totalTimeMs },
      ],
      replay: false,
    };
  } finally {
    // Giải phóng lock chỉ khi value khớp lockToken (D-4)
    await releaseLock(key, lockToken);
  }
}

// ─── CAP-5 / API-04 — Review result ───────────────────────────────────────────

/**
 * Xem lại kết quả phiên: tổng kết + N attempt kèm payload snapshot (R8).
 *
 * @throws AppError 404 ERR_RESULT_NOT_FOUND — resultId không tồn tại
 * @throws AppError 403 FORBIDDEN — result thuộc user khác
 */
export async function getSpeakingResult(
  userId: string,
  resultId: string
): Promise<{
  result: {
    groupId: string;
    sessionId: string | null;
    type: PracticeSessionType;
    scope: string;
    status: string;
    totalQuestions: number;
    totalTimeMs: number;
    skillsSummary: IPracticeSessionResult['skillsSummary'];
    completedAt: Date;
  };
  attempts: Array<{
    id: string;
    refId: string;
    scorePercent: number;
    durationMs: number;
    payload: IPracticeAttempt['payload'];
    submittedAt: Date;
  }>;
}> {
  await assertLearnerEligible(userId);
  const result = await PracticeSessionResult.findById(resultId).lean<IPracticeSessionResult>();
  if (!result) {
    throw new AppError(
      'Kết quả phiên không tồn tại.',
      HttpStatus.NOT_FOUND,
      ErrorCodes.RESULT_NOT_FOUND
    );
  }
  if (result.userId.toHexString() !== userId) {
    throw new AppError('Bạn không có quyền xem kết quả này.', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
  }

  const attemptDocs = await PracticeAttempt.find({ groupId: result._id })
    .sort({ _id: 1 })
    .lean<IPracticeAttempt[]>();

  return {
    result: {
      groupId: result._id.toHexString(),
      sessionId: result.sessionId ? result.sessionId.toHexString() : null,
      type: result.type,
      scope: result.scope,
      status: result.status,
      totalQuestions: result.totalQuestions,
      totalTimeMs: result.totalTimeMs,
      skillsSummary: result.skillsSummary,
      completedAt: result.completedAt,
    },
    attempts: attemptDocs.map((a) => ({
      id: a._id.toHexString(),
      refId: a.refId.toHexString(),
      scorePercent: a.scorePercent,
      durationMs: a.durationMs,
      payload: a.payload,
      submittedAt: a.submittedAt,
    })),
  };
}

// ─── CAP-6 / API-05 — Admin CRUD prompts ──────────────────────────────────────

export interface ListPromptsParams {
  page: number;
  limit: number;
  level?: SpeakingLevel;
  search?: string;
  hasAudio?: boolean;
  source?: 'seed' | 'admin' | 'ai';
}

export async function listPrompts(params: ListPromptsParams): Promise<{
  prompts: Array<{
    id: string;
    level: SpeakingLevel;
    referenceText: string;
    audioUrl: string | null;
    source: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  pagination: { page: number; limit: number; total: number };
}> {
  const filter: Record<string, unknown> = {};
  if (params.level) {
    filter.level = params.level;
  }
  if (params.search) {
    // regex search thay text index cho match chuỗi một phần, escaped tránh regex injection
    const escaped = params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.referenceText = { $regex: escaped, $options: 'i' };
  }
  if (params.hasAudio !== undefined) {
    filter.audioUrl = params.hasAudio ? { $ne: null } : null;
  }
  if (params.source) {
    filter.source = params.source;
  }

  const skip = (params.page - 1) * params.limit;
  const [docs, total] = await Promise.all([
    SpeakingPrompt.find(filter).sort({ createdAt: -1 }).skip(skip).limit(params.limit).lean<ISpeakingPrompt[]>(),
    SpeakingPrompt.countDocuments(filter),
  ]);

  return {
    prompts: docs.map((p) => ({
      id: p._id.toHexString(),
      level: p.level,
      referenceText: p.referenceText,
      audioUrl: p.audioUrl,
      source: p.source,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
    pagination: { page: params.page, limit: params.limit, total },
  };
}

export interface SpeakingPromptBody {
  level: SpeakingLevel;
  referenceText: string;
  audioUrl?: string | null;
  source?: 'seed' | 'admin' | 'ai';
  isActive?: boolean;
}

export async function createPrompt(body: SpeakingPromptBody): Promise<ISpeakingPrompt> {
  const prompt = new SpeakingPrompt({
    level: body.level,
    referenceText: body.referenceText,
    audioUrl: body.audioUrl ?? null,
    source: body.source ?? 'admin',
    isActive: body.isActive ?? true,
  });
  return prompt.save();
}

/**
 * Sửa prompt (admin). Lịch sử đã chấm KHÔNG đổi vì attempt giữ snapshot riêng (R8).
 *
 * @throws AppError 404 ERR_PROMPT_NOT_FOUND — id không tồn tại
 */
export async function updatePrompt(id: string, body: Partial<SpeakingPromptBody>): Promise<ISpeakingPrompt> {
  const update: Record<string, unknown> = {};
  if (body.level !== undefined) {
    update.level = body.level;
  }
  if (body.referenceText !== undefined) {
    update.referenceText = body.referenceText;
  }
  if (body.audioUrl !== undefined) {
    update.audioUrl = body.audioUrl;
  }
  if (body.source !== undefined) {
    update.source = body.source;
  }
  if (body.isActive !== undefined) {
    update.isActive = body.isActive;
  }

  const prompt = await SpeakingPrompt.findByIdAndUpdate(id, update, { new: true, runValidators: true });
  if (!prompt) {
    throw new AppError(
      'Mẫu luyện nói không tồn tại hoặc đã bị xóa.',
      HttpStatus.NOT_FOUND,
      ErrorCodes.PROMPT_NOT_FOUND
    );
  }
  return prompt;
}

/**
 * Soft-delete prompt: chỉ set isActive=false, KHÔNG xóa cứng (R5, data-model §6).
 * Phiên active đang trỏ → render co lại; attempt cũ giữ snapshot.
 *
 * @throws AppError 404 ERR_PROMPT_NOT_FOUND — id không tồn tại
 */
export async function softDeletePrompt(id: string): Promise<ISpeakingPrompt> {
  const prompt = await SpeakingPrompt.findByIdAndUpdate(
    id,
    { isActive: false },
    { new: true }
  );
  if (!prompt) {
    throw new AppError(
      'Mẫu luyện nói không tồn tại hoặc đã bị xóa.',
      HttpStatus.NOT_FOUND,
      ErrorCodes.PROMPT_NOT_FOUND
    );
  }
  return prompt;
}

// ─── Helpers nội bộ ───────────────────────────────────────────────────────────

/** Fingerprint SHA-256 của request chuẩn hóa — retry khác body sẽ khác hash (BR-07) */
function computeFingerprint(
  userId: string,
  sessionId: string,
  answers: SpeakingAnswerInput[],
  startedAt: string,
  completedAt: string
): string {
  const canonical = JSON.stringify({
    userId,
    sessionId,
    answers: answers.map((a) => ({
      refId: a.refId,
      transcript: a.transcript,
      durationMs: a.durationMs ?? 0,
    })),
    startedAt,
    completedAt,
  });
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

function toSubmitResult(doc: IPracticeSessionResult, replay: boolean): SubmitSpeakingSessionResult {
  const speakingSummary = doc.skillsSummary.find((s) => s.skillType === 'SPEAKING');
  return {
    groupId: doc._id.toHexString(),
    totalItems: doc.totalQuestions,
    skillsSummary: [
      {
        skillType: 'SPEAKING',
        avgScorePercent: speakingSummary?.avgScorePercent ?? 0,
        totalItems: speakingSummary?.totalItems ?? doc.totalQuestions,
        totalTimeMs: doc.totalTimeMs,
      },
    ],
    replay,
  };
}

/** SET NX EX — trả true nếu giành được lock; Redis down thì thà chặn còn hơn double-write */
async function acquireLock(key: string, token: string): Promise<boolean> {
  if (!isRedisAvailable() || !redis) {
    // Redis miss: bỏ qua lock nhưng vẫn dedupe qua _id = groupId (fallback như leaderboard)
    return true;
  }
  try {
    const ok = await redis.set(key, token, 'EX', SPEAKING_LOCK_TTL_SECONDS, 'NX');
    return ok === 'OK';
  } catch (err) {
    reportRedisFailure(err);
    return true;
  }
}

/** DEL lock chỉ khi value khớp lockToken (D-4) — sai token là lock của request khác */
async function releaseLock(key: string, token: string): Promise<void> {
  if (!isRedisAvailable() || !redis) {
    return;
  }
  try {
    const current = await redis.get(key);
    if (current === token) {
      await redis.del(key);
    }
  } catch (err) {
    reportRedisFailure(err);
  }
}

/** Ghi trạng thái hoàn tất TTL 24h — best-effort, lỗi chỉ log (architecture §3.9) */
async function markDone(groupId: string): Promise<void> {
  if (!isRedisAvailable() || !redis) {
    return;
  }
  try {
    await redis.set(doneKey(groupId), '1', 'EX', SPEAKING_DONE_TTL_SECONDS);
  } catch (err) {
    reportRedisFailure(err);
  }
}

/** Map ScoringError của engine sang AppError với errorCode stable cho FE (AD-8) */
function mapScoringError(err: ScoringError): AppError {
  switch (err.scoringCode) {
    case 'TRANSCRIPT_EMPTY':
      return new AppError(
        'Không nhận diện được giọng nói.',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.TRANSCRIPT_EMPTY
      );
    case 'TRANSCRIPT_TOO_SHORT':
      return new AppError(
        'Transcript quá ngắn so với câu mẫu.',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.TRANSCRIPT_TOO_SHORT
      );
    default:
      return new AppError(
        'Lỗi chấm điểm. Vui lòng thử lại sau.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.SCORING_FAILED
      );
  }
}
