import { Types } from 'mongoose';
import { ListeningQuestion, IListeningQuestion } from '../models/ListeningQuestion';
import { PracticeSessionResult } from '../models/PracticeSessionResult';
import { PracticeAttempt } from '../models/PracticeAttempt';
import { DailyStats } from '../models/DailyStats';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';
import {
  ListeningQuestionType,
  CefrLevel,
  LISTENING_MIN_QUESTIONS,
  LISTENING_MAX_QUESTIONS,
  LISTENING_DEFAULT_QUESTIONS,
  LISTENING_SKILL_TYPE,
  LISTENING_PAGE_DEFAULT,
  LISTENING_PAGE_LIMIT_DEFAULT,
} from '../constants/listening';

/**
 * UC-15 Listening Practice service (FR-111).
 *
 * Ownership (AD-3): đây là nơi duy nhất đọc `ListeningQuestion` và ghi
 * `PracticeSessionResult` / `PracticeAttempt` cho `skillType='LISTENING'` +
 * cập nhật `DailyStats` sau batch write.
 *
 * TTS: theo quyết định build, synth chạy on-device phía client (weights UC-13);
 * BE chỉ cung cấp `transcript` qua endpoint audio riêng để client synth, không
 * lộ transcript trong payload session (AC-14).
 */

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface GetSessionQuery {
  count?: number;
  level?: CefrLevel;
}

/** Câu hỏi trả cho learner — KHÔNG có transcript/correctAnswer/correctOrder/explanation (AC-14). */
export interface ListeningSessionQuestion {
  id: string;
  type: ListeningQuestionType;
  level: CefrLevel;
  options?: { id: string; text: string }[];
  wordOptions?: string[];
}

export interface ListeningResultItem {
  questionId: string;
  selectedAnswer: string | string[];
  durationMs: number;
}

export interface SubmitSessionDto {
  results: ListeningResultItem[];
  startedAt: string;
  completedAt: string;
}

export interface SubmitSessionResponse {
  groupId: string;
  correctCount: number;
  totalQuestions: number;
  accuracy: number;
}

export interface AdminListQuery {
  page?: number;
  limit?: number;
  type?: ListeningQuestionType;
  level?: CefrLevel;
}

export interface AdminListResult {
  questions: unknown[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateQuestionDto {
  type: ListeningQuestionType;
  level: CefrLevel;
  transcript: string;
  options?: { id: string; text: string }[];
  correctAnswer?: string;
  wordOptions?: string[];
  correctOrder?: string[];
  explanation?: string;
}

export type UpdateQuestionDto = Partial<CreateQuestionDto>;

// ─── Scoring (BR-04) ──────────────────────────────────────────────────────────

/**
 * Chuẩn hóa text cho dạng `transcription`: bỏ hoa/thường, dấu câu và khoảng trắng thừa
 * (BR-04). Giữ nội dung chữ/số, gộp whitespace.
 */
export function normalizeTranscript(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()"'?!¿¡«»…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chấm rule-based một câu theo `type` (BR-04). Server luôn dùng hàm này khi Finish,
 * không tin kết quả client (SPEC Constraints).
 */
export function scoreByRule(
  question: Pick<IListeningQuestion, 'type' | 'transcript' | 'correctAnswer' | 'correctOrder'>,
  selectedAnswer: string | string[],
): boolean {
  switch (question.type) {
    case 'transcription': {
      if (typeof selectedAnswer !== 'string') {
        return false;
      }
      return normalizeTranscript(selectedAnswer) === normalizeTranscript(question.transcript);
    }
    case 'word-order': {
      if (!Array.isArray(selectedAnswer) || !Array.isArray(question.correctOrder)) {
        return false;
      }
      const expected = question.correctOrder.map((w) => w.trim());
      const actual = selectedAnswer.map((w) => String(w).trim());
      return expected.length === actual.length && expected.every((w, i) => w === actual[i]);
    }
    case 'mcq': {
      if (typeof selectedAnswer !== 'string') {
        return false;
      }
      return selectedAnswer === question.correctAnswer;
    }
    default:
      return false;
  }
}

// ─── Learner: session + audio ─────────────────────────────────────────────────

/**
 * CAP-1 — Lấy phiên đề Listening: random trong pool theo `level`, bỏ `isDeleted`,
 * 10–20 câu (mặc định 10). Pool rỗng → ERR_NO_QUESTIONS_AVAILABLE.
 */
export async function getSession(
  _userId: string,
  query: GetSessionQuery,
): Promise<{ questions: ListeningSessionQuestion[] }> {
  const count = query.count ?? LISTENING_DEFAULT_QUESTIONS;
  const bounded = Math.min(Math.max(count, LISTENING_MIN_QUESTIONS), LISTENING_MAX_QUESTIONS);

  const match: Record<string, unknown> = { isDeleted: { $ne: true } };
  if (query.level) {
    match.level = query.level;
  }

  const sampled = await ListeningQuestion.aggregate<IListeningQuestion>([
    { $match: match },
    { $sample: { size: bounded } },
    {
      // Loại transcript/correctAnswer/correctOrder/explanation khỏi session payload (AC-14).
      $project: { type: 1, level: 1, options: 1, wordOptions: 1 },
    },
  ]);

  if (sampled.length === 0) {
    throw new AppError(
      'Bộ đề Listening đang được cập nhật, quay lại sau nhé!',
      HttpStatus.NOT_FOUND,
      ErrorCodes.NO_QUESTIONS_AVAILABLE,
    );
  }

  const questions: ListeningSessionQuestion[] = sampled.map((q) => ({
    id: String(q._id),
    type: q.type,
    level: q.level,
    ...(q.type === 'mcq' && q.options ? { options: q.options.map((o) => ({ id: o.id, text: o.text })) } : {}),
    ...(q.type === 'word-order' && q.wordOptions ? { wordOptions: q.wordOptions } : {}),
  }));

  return { questions };
}

/**
 * CAP-2 — Lấy text nguồn để client tự TTS on-device (weights UC-13).
 * Chỉ trả `transcript` của đúng câu hỏi, không trả kèm trong session payload;
 * câu không tồn tại / soft-deleted → ERR_QUESTION_NOT_FOUND.
 */
export async function getAudio(questionId: string): Promise<{ text: string }> {
  if (!Types.ObjectId.isValid(questionId)) {
    throw new AppError('Câu hỏi không tồn tại hoặc đã bị xóa', HttpStatus.NOT_FOUND, ErrorCodes.QUESTION_NOT_FOUND);
  }
  const question = await ListeningQuestion.findOne({ _id: questionId, isDeleted: { $ne: true } })
    .select('transcript')
    .lean();
  if (!question) {
    throw new AppError('Câu hỏi không tồn tại hoặc đã bị xóa', HttpStatus.NOT_FOUND, ErrorCodes.QUESTION_NOT_FOUND);
  }
  return { text: question.transcript };
}

// ─── Learner: submit session (CAP-5) ──────────────────────────────────────────

/**
 * CAP-5 — Nộp phiên: chấm lại theo DB, ghi 1 lô `PracticeSessionResult` (COMPLETED)
 * + N `PracticeAttempt` cùng `groupId`, rollback phần ghi dở nếu batch thất bại,
 * rồi upsert DailyStats. Retry trùng (double-tap) dedupe theo
 * unique `{userId, skillType, refId}` — trả lại tổng kết đã ghi (AF-07).
 */
export async function submitSession(userId: string, dto: SubmitSessionDto): Promise<SubmitSessionResponse> {
  const userObjectId = new Types.ObjectId(userId);
  const questionIds = dto.results.map((r) => r.questionId);

  const questions = await ListeningQuestion.find({ _id: { $in: questionIds } }).lean();
  const questionMap = new Map(questions.map((q) => [String(q._id), q]));

  const missing = questionIds.filter((id) => !questionMap.has(id));
  if (missing.length > 0) {
    throw new AppError(
      'Một số câu hỏi không tồn tại hoặc đã bị xóa',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
    );
  }

  // Dedupe retry (AF-07): nếu đã có attempt cho các câu này → trả lại tổng kết đã ghi.
  const existingAttempts = await PracticeAttempt.find({
    userId: userObjectId,
    skillType: LISTENING_SKILL_TYPE,
    refId: { $in: questionIds },
  }).lean();
  if (existingAttempts.length > 0) {
    const existingSession = await PracticeSessionResult.findById(existingAttempts[0].groupId).lean();
    if (existingSession) {
      return {
        groupId: String(existingSession._id),
        correctCount: existingSession.correctCount,
        totalQuestions: existingSession.totalQuestions,
        accuracy: existingSession.accuracyPercent,
      };
    }
  }

  // Chấm lại theo đáp án trong DB — không tin client.
  const graded = dto.results.map((item) => {
    const question = questionMap.get(item.questionId)!;
    const isCorrect = scoreByRule(question, item.selectedAnswer);
    return { item, question, isCorrect };
  });

  const totalQuestions = graded.length;
  const correctCount = graded.filter((g) => g.isCorrect).length;
  const totalTimeMs = graded.reduce((sum, g) => sum + (Number(g.item.durationMs) || 0), 0);
  const accuracy = Math.round((correctCount / totalQuestions) * 100);

  const sessionResult = await PracticeSessionResult.create({
    userId: userObjectId,
    type: 'PRACTICE',
    scope: 'SINGLE',
    status: 'COMPLETED',
    totalQuestions,
    correctCount,
    accuracyPercent: accuracy,
    totalTimeMs,
  });

  const submittedAt = new Date();
  try {
    await PracticeAttempt.insertMany(
      graded.map((g) => ({
        userId: userObjectId,
        skillType: LISTENING_SKILL_TYPE,
        refId: new Types.ObjectId(g.item.questionId),
        groupId: sessionResult._id,
        scorePercent: g.isCorrect ? 100 : 0,
        durationMs: Number(g.item.durationMs) || 0,
        submittedAt,
        payload: {
          type: g.question.type,
          level: g.question.level,
          selectedAnswer: g.item.selectedAnswer,
        },
      })),
    );
  } catch (error) {
    // Rollback phần đã ghi dở — không để phiên ở trạng thái lưu một phần (BR-07).
    await PracticeAttempt.deleteMany({ groupId: sessionResult._id }).catch(() => undefined);
    await PracticeSessionResult.deleteOne({ _id: sessionResult._id }).catch(() => undefined);
    throw error;
  }

  // Cập nhật DailyStats sau khi batch write thành công (post-conditions).
  // listeningSessions đánh dấu ngày active cho streak (cùng pattern voiceSessions UC-13);
  // streak được stats.service tính lại từ lịch sử DailyStats (calcStreak).
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);
  await DailyStats.findOneAndUpdate(
    { userId: userObjectId, date: todayMidnight },
    {
      $inc: {
        totalAnswers: totalQuestions,
        correctAnswers: correctCount,
        timeSpent: Math.round(totalTimeMs / 1000),
        listeningSessions: 1,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true, new: true },
  );

  return {
    groupId: String(sessionResult._id),
    correctCount,
    totalQuestions,
    accuracy,
  };
}

// ─── Admin CRUD (CAP-6) ───────────────────────────────────────────────────────

/** Map document → ListeningQuestionFull (API-04): expose `id`, không lộ `__v`. */
function toAdminQuestionDto(q: Record<string, any>) {
  return {
    id: String(q._id),
    type: q.type,
    level: q.level,
    transcript: q.transcript,
    options: q.options ?? undefined,
    correctAnswer: q.correctAnswer ?? undefined,
    wordOptions: q.wordOptions ?? undefined,
    correctOrder: q.correctOrder ?? undefined,
    explanation: q.explanation ?? undefined,
    isDeleted: q.isDeleted,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

/** CAP-6 — Danh sách câu hỏi (phân trang + lọc type/level), bỏ soft-deleted. */
export async function adminListQuestions(query: AdminListQuery): Promise<AdminListResult> {
  const page = Math.max(query.page ?? LISTENING_PAGE_DEFAULT, 1);
  const limit = Math.max(query.limit ?? LISTENING_PAGE_LIMIT_DEFAULT, 1);
  const filter: Record<string, unknown> = { isDeleted: { $ne: true } };
  if (query.type) {
    filter.type = query.type;
  }
  if (query.level) {
    filter.level = query.level;
  }

  const [docs, total] = await Promise.all([
    ListeningQuestion.find(filter)
      .select('-__v')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ListeningQuestion.countDocuments(filter),
  ]);

  return { questions: docs.map(toAdminQuestionDto), total, page, limit };
}

/** CAP-6 — Tạo câu hỏi mới. */
export async function adminCreateQuestion(dto: CreateQuestionDto): Promise<Record<string, any>> {
  const created = await ListeningQuestion.create({ ...dto, isDeleted: false });
  return toAdminQuestionDto(created.toObject());
}

/** CAP-6 — Sửa câu hỏi; 404 nếu không tồn tại / đã xóa mềm. */
export async function adminUpdateQuestion(
  questionId: string,
  dto: UpdateQuestionDto,
): Promise<Record<string, any>> {
  if (!Types.ObjectId.isValid(questionId)) {
    throw new AppError('Câu hỏi không tồn tại hoặc đã bị xóa', HttpStatus.NOT_FOUND, ErrorCodes.QUESTION_NOT_FOUND);
  }
  const existing = await ListeningQuestion.findOne({ _id: questionId, isDeleted: { $ne: true } });
  if (!existing) {
    throw new AppError('Câu hỏi không tồn tại hoặc đã bị xóa', HttpStatus.NOT_FOUND, ErrorCodes.QUESTION_NOT_FOUND);
  }

  const nextType = dto.type ?? existing.type;
  const merged = {
    options: dto.options ?? existing.options,
    correctAnswer: dto.correctAnswer ?? existing.correctAnswer,
    wordOptions: dto.wordOptions ?? existing.wordOptions,
    correctOrder: dto.correctOrder ?? existing.correctOrder,
  };

  // Enforce field bắt buộc theo type MỚI tính cả field đã lưu (Zod route chỉ thấy payload).
  if (nextType === 'mcq') {
    if (!merged.options || merged.options.length === 0 || !merged.correctAnswer) {
      throw new AppError('Câu mcq cần options + correctAnswer', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    }
    if (!merged.options.some((o) => o.id === merged.correctAnswer)) {
      throw new AppError('correctAnswer phải là id của một option', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    }
  }
  if (nextType === 'word-order') {
    if (!merged.wordOptions || merged.wordOptions.length === 0 || !merged.correctOrder || merged.correctOrder.length === 0) {
      throw new AppError('Câu word-order cần wordOptions + correctOrder', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
    }
  }

  const $set: Record<string, unknown> = { ...dto };
  const $unset: Record<string, ''> = {};
  // Đổi type → gỡ field của type cũ để không để thừa dữ liệu trái schema mới.
  if (dto.type && dto.type !== existing.type) {
    if (nextType !== 'mcq') {
      $unset.options = '';
      $unset.correctAnswer = '';
    }
    if (nextType !== 'word-order') {
      $unset.wordOptions = '';
      $unset.correctOrder = '';
    }
  }

  const updated = await ListeningQuestion.findOneAndUpdate(
    { _id: questionId, isDeleted: { $ne: true } },
    { $set, ...(Object.keys($unset).length > 0 ? { $unset } : {}) },
    { new: true, runValidators: true },
  );
  return toAdminQuestionDto(updated!.toObject());
}

/** CAP-6 — Soft delete (`isDeleted=true` + `deletedAt`). */
export async function adminDeleteQuestion(questionId: string): Promise<void> {
  if (!Types.ObjectId.isValid(questionId)) {
    throw new AppError('Câu hỏi không tồn tại hoặc đã bị xóa', HttpStatus.NOT_FOUND, ErrorCodes.QUESTION_NOT_FOUND);
  }
  const deleted = await ListeningQuestion.findOneAndUpdate(
    { _id: questionId, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: new Date() } },
    { new: true },
  );
  if (!deleted) {
    throw new AppError('Câu hỏi không tồn tại hoặc đã bị xóa', HttpStatus.NOT_FOUND, ErrorCodes.QUESTION_NOT_FOUND);
  }
}
