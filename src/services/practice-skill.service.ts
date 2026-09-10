/**
 * Practice-skill batch persistence (kiến trúc B′ — dùng chung cho UC-14/15/17, FR-114).
 * Ownership (AD-3): đây là nơi DUY NHẤT ghi `PracticeSessionResult` + `PracticeAttempt`.
 * Các module skill (reading/writing...) chỉ orchestrate rồi gọi `recordBatch()`.
 */
import { Types } from 'mongoose';
import { PracticeAttempt } from '../models/PracticeAttempt';
import { PracticeSessionResult, SessionSkillType } from '../models/PracticeSessionResult';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';

export type PracticeSessionType = 'PRACTICE' | 'EXAM';
export type PracticeSessionScope = 'SINGLE' | 'MIXED';

export interface ScoredAttempt {
  refId: Types.ObjectId;
  // 100 = đúng, 0 = sai (server chấm lại theo DB, không tin client)
  scorePercent: 0 | 100;
  durationMs: number;
  payload: {
    type: string;
    level: string;
    selectedAnswer: string | Record<string, string> | null;
  };
}

export interface RecordBatchParams {
  groupId: Types.ObjectId;
  userId: Types.ObjectId;
  skillType: SessionSkillType;
  type: PracticeSessionType;
  scope: PracticeSessionScope;
  startedAt: Date;
  completedAt: Date;
  // Fingerprint request đã chuẩn hóa (sau keep-last) — chống retry body khác cùng groupId
  requestFingerprint: string;
  scored: ScoredAttempt[];
  totals: {
    totalQuestions: number;
    correctCount: number;
    totalTimeMs: number;
  };
}

export interface RecordBatchResult {
  groupId: Types.ObjectId;
  accuracyPercent: number;
  totalTimeMs: number;
}

/** Bản ghi session result đã lean — đủ field để replay summary. */
export interface PracticeSessionResultLean {
  _id: unknown;
  userId: unknown;
  totalQuestions: number;
  correctCount: number;
  totalTimeMs: number;
  accuracyPercent: number;
  requestFingerprint: string;
}

/**
 * Trạng thái batch theo `groupId` (data-model §Batch Integrity, api-spec §2 bước 2):
 * - `absent`: chưa có gì → ghi lô mới
 * - `complete`: result đúng user + fingerprint + đủ attempts → replay idempotent
 * - `incomplete`: có result/attempts nhưng batch dở dang → cleanup trong lock rồi ghi lại
 * - `conflict`: groupId thuộc user khác / fingerprint khác → 409
 */
export type BatchState =
  | { status: 'absent' }
  | { status: 'complete'; result: PracticeSessionResultLean }
  | { status: 'conflict' }
  | { status: 'incomplete'; result: PracticeSessionResultLean | null };

const DUPLICATE_KEY_CODE = 11000;

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === DUPLICATE_KEY_CODE;
}

/**
 * Đọc trạng thái batch của một `groupId`. Owner của `PracticeSessionResult`/`PracticeAttempt`
 * là service này (AD-3) — module skill khác không tự truy vấn 2 aggregate kết quả.
 */
export async function inspectBatch(params: {
  groupId: Types.ObjectId;
  userId: string;
  requestFingerprint: string;
  skillType: SessionSkillType;
}): Promise<BatchState> {
  const { groupId, userId, requestFingerprint, skillType } = params;
  const result = (await PracticeSessionResult.findById(groupId).lean()) as unknown as
    | PracticeSessionResultLean
    | null;

  if (!result) {
    // Attempts mồ côi không có result = batch dở dang
    const orphanCount = await PracticeAttempt.countDocuments({ groupId });
    return orphanCount > 0 ? { status: 'incomplete', result: null } : { status: 'absent' };
  }

  if (String(result.userId) !== userId || result.requestFingerprint !== requestFingerprint) {
    return { status: 'conflict' };
  }

  const attemptCount = await PracticeAttempt.countDocuments({ groupId, skillType });
  return attemptCount === result.totalQuestions ? { status: 'complete', result } : { status: 'incomplete', result };
}

/**
 * Xóa đúng dữ liệu của một group (attempts + session result).
 * Chỉ gọi cho group do request hiện tại tạo (hoặc recovery path đã giữ lock) —
 * tuyệt đối không xóa group của request khác.
 *
 * @throws AppError 500 ERR_INTERNAL khi cleanup không hoàn tất (lỗi được log cho vận hành)
 */
export async function cleanupGroup(groupId: Types.ObjectId): Promise<void> {
  let failed = false;

  try {
    await PracticeAttempt.deleteMany({ groupId });
  } catch (err) {
    failed = true;
    console.error(`[practice-skill] Cleanup attempts failed for group ${String(groupId)}:`, err);
  }

  try {
    await PracticeSessionResult.deleteOne({ _id: groupId });
  } catch (err) {
    failed = true;
    console.error(`[practice-skill] Cleanup session result failed for group ${String(groupId)}:`, err);
  }

  if (failed) {
    // Invariant B′: không trả success/tiếp tục khi cleanup chưa xong
    throw new AppError('Failed to clean up practice batch', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL);
  }
}

/**
 * Ghi một lô kết quả phiên: 1 `PracticeSessionResult` (`_id = groupId`) + N `PracticeAttempt` cùng group.
 * Nếu ghi attempts lỗi hoặc thiếu dòng → cleanup toàn bộ group trước khi trả lỗi,
 * để retry cùng `groupId` không tạo dữ liệu trùng hoặc dữ liệu một phần.
 *
 * @throws AppError 409 ERR_GROUP_ID_CONFLICT khi `groupId` đã tồn tại
 * @throws AppError 500 ERR_INTERNAL khi ghi lô hoặc cleanup thất bại
 */
export async function recordBatch(params: RecordBatchParams): Promise<RecordBatchResult> {
  const {
    groupId,
    userId,
    skillType,
    type,
    scope,
    startedAt,
    completedAt,
    requestFingerprint,
    scored,
    totals,
  } = params;

  const accuracyPercent = Math.round((totals.correctCount / totals.totalQuestions) * 100);
  let resultCreated = false;

  try {
    await PracticeSessionResult.create({
      _id: groupId,
      userId,
      type,
      scope,
      status: 'COMPLETED',
      skillsSummary: [
        {
          skillType,
          correctCount: totals.correctCount,
          totalQuestions: totals.totalQuestions,
        },
      ],
      totalQuestions: totals.totalQuestions,
      correctCount: totals.correctCount,
      incorrectCount: totals.totalQuestions - totals.correctCount,
      accuracyPercent,
      totalTimeMs: totals.totalTimeMs,
      startedAt,
      completedAt,
      requestFingerprint,
    });
    resultCreated = true;

    await PracticeAttempt.insertMany(
      scored.map((item) => ({
        userId,
        skillType,
        refId: item.refId,
        groupId,
        scorePercent: item.scorePercent,
        durationMs: item.durationMs,
        // Server time — không lấy thời gian client cho submittedAt
        submittedAt: new Date(),
        payload: item.payload,
      })),
      { ordered: true },
    );

    const attemptCount = await PracticeAttempt.countDocuments({ groupId, skillType });
    if (attemptCount !== totals.totalQuestions) {
      throw new Error(`Incomplete batch: expected ${totals.totalQuestions} attempts, got ${attemptCount}`);
    }

    return { groupId, accuracyPercent, totalTimeMs: totals.totalTimeMs };
  } catch (err) {
    // Chỉ cleanup group mình vừa tạo — tránh xóa dữ liệu của request khác
    if (resultCreated) {
      await cleanupGroup(groupId);
    }

    // Result tạo fail vì _id đã tồn tại = groupId đã bị chiếm (race sau lock hết hạn)
    if (!resultCreated && isDuplicateKeyError(err)) {
      throw new AppError(
        'groupId already exists for another session',
        HttpStatus.CONFLICT,
        ErrorCodes.GROUP_ID_CONFLICT,
      );
    }
    if (err instanceof AppError) {
      throw err;
    }

    console.error(`[practice-skill] recordBatch failed for group ${String(groupId)}:`, err);
    throw new AppError('Failed to persist practice session', HttpStatus.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL);
  }
}
