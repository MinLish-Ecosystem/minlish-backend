import { Types } from 'mongoose';

/**
 * practice-skill.service — Chuỗi lưu trữ Practice dùng chung 4 kỹ năng (UC-16 / FR-116).
 * Ownership: Result + Attempt chỉ được ghi qua service này (AD-3, D-1) —
 * các skill service khác orchestrate nhưng không ghi trực tiếp 2 model trên.
 */

import {
  PracticeSessionResult,
  ISkillSummary,
  IPracticeSessionResult,
} from '../models/PracticeSessionResult';
import { PracticeAttempt } from '../models/PracticeAttempt';
import { SkillType } from '../models/PracticeSession';

export interface AttemptRecordInput {
  skillType: SkillType;
  refId: string;
  scorePercent: number;
  durationMs: number;
  submittedAt: Date;
  payload: Record<string, unknown>;
}

export interface RecordBatchInput {
  /** groupId FE-gen — dùng làm _id của Result (CAP-8) */
  groupId: string;
  userId: string;
  sessionId: string | null;
  type: 'PRACTICE' | 'EXAM';
  scope: 'SINGLE' | 'MIXED';
  skillsSummary: ISkillSummary[];
  totalQuestions: number;
  totalTimeMs: number;
  fingerprint: string;
  completedAt: Date;
  attempts: AttemptRecordInput[];
}

/**
 * Ghi 1 PracticeSessionResult (COMPLETED) + N PracticeAttempt cùng groupId trong một lô (BR-05).
 * All-or-nothing (CAP-4): lỗi giữa chừng → xóa sạch result + attempts của group rồi ném lỗi.
 *
 * @param input - Dữ liệu đã chấm xong, đủ điều kiện persist
 * @returns Result document đã ghi
 * @throws DuplicateGroupError khi _id groupId đã bị request khác ghi (race song song)
 * @throws Error bất kỳ khi ghi DB — caller giải phóng lock và trả 500
 */
export async function recordBatch(input: RecordBatchInput): Promise<IPracticeSessionResult> {
  const result = await saveResult(input);

  try {
    if (input.attempts.length > 0) {
      const docs = input.attempts.map((a) => ({
        userId: new Types.ObjectId(input.userId),
        skillType: a.skillType,
        refId: new Types.ObjectId(a.refId),
        groupId: new Types.ObjectId(input.groupId),
        scorePercent: a.scorePercent,
        durationMs: a.durationMs,
        submittedAt: a.submittedAt,
        payload: a.payload,
      }));
      await PracticeAttempt.insertMany(docs);
    }
    return result;
  } catch (err) {
    // All-or-nothing: result do chính request này ghi — cleanup an toàn (AF-09)
    await cleanupGroup(input.groupId).catch(() => undefined);
    throw err;
  }
}

/**
 * Ghi result với _id = groupId. Trùng _id nghĩa là một request khác đang giữ/
 * đã giữ group này (race khi Redis lock miss) — ném DuplicateGroupError để caller
 * trả 409, KHÔNG cleanup vì group có thể thuộc request đang thắng cuộc.
 */
async function saveResult(input: RecordBatchInput): Promise<IPracticeSessionResult> {
  const result = new PracticeSessionResult({
    _id: new Types.ObjectId(input.groupId),
    userId: new Types.ObjectId(input.userId),
    sessionId: input.sessionId ? new Types.ObjectId(input.sessionId) : null,
    type: input.type,
    scope: input.scope,
    status: 'COMPLETED' as const,
    skillsSummary: input.skillsSummary,
    totalQuestions: input.totalQuestions,
    totalTimeMs: input.totalTimeMs,
    fingerprint: input.fingerprint,
    completedAt: input.completedAt,
  });
  try {
    return await result.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new DuplicateGroupError(input.groupId);
    }
    throw err;
  }
}

/** Race ghi trùng groupId — caller map sang 409 conflict (CAP-8) */
export class DuplicateGroupError extends Error {
  public readonly groupId: string;

  constructor(groupId: string) {
    super(`groupId ${groupId} already recorded by another request`);
    this.name = 'DuplicateGroupError';
    this.groupId = groupId;
  }
}

/** Mongo duplicate key (code 11000) — trùng _id hoặc unique index */
function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: number }).code === 11000
  );
}

/** Xóa result + attempts của một group (cleanup batch dở dang) */
export async function cleanupGroup(groupId: string): Promise<void> {
  await PracticeAttempt.deleteMany({ groupId: new Types.ObjectId(groupId) });
  await PracticeSessionResult.deleteOne({ _id: new Types.ObjectId(groupId) });
}

/**
 * Đếm số attempt đã ghi của group — dùng nhận diện result dở dang
 * (cùng user + fingerprint nhưng thiếu attempts → cleanup rồi xử lý lại như mới).
 */
export async function countGroupAttempts(groupId: string): Promise<number> {
  return PracticeAttempt.countDocuments({ groupId: new Types.ObjectId(groupId) });
}
