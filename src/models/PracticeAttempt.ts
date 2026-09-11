import mongoose, { Document, Schema, Types } from 'mongoose';
import { LISTENING_QUESTION_TYPES, CEFR_LEVELS } from '../constants/listening';

/**
 * PracticeAttempt — kết quả từng câu trong phiên (bảng dùng chung, B′).
 * UC-15 chỉ ghi `skillType='LISTENING'`, `groupId = PracticeSessionResult._id`,
 * payload denormalize `{type, level, selectedAnswer}` (§7.2).
 * Unique `{userId, skillType, refId}` dùng dedupe retry submit (AF-07).
 */

export interface IPracticeAttemptPayload {
  type: string;
  level: string;
  selectedAnswer: string | string[];
}

export interface IPracticeAttempt extends Document {
  userId: Types.ObjectId;
  skillType: string;
  refId: Types.ObjectId;
  groupId: Types.ObjectId;
  scorePercent: number;
  durationMs: number;
  submittedAt: Date;
  payload: IPracticeAttemptPayload;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeAttemptSchema = new Schema<IPracticeAttempt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    skillType: { type: String, required: true, default: 'LISTENING', index: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'PracticeSessionResult',
      required: true,
    },
    scorePercent: { type: Number, required: true, min: 0, max: 100 },
    durationMs: { type: Number, required: true, min: 0 },
    submittedAt: { type: Date, required: true, default: Date.now },
    payload: {
      type: { type: String, enum: LISTENING_QUESTION_TYPES, required: true },
      level: { type: String, enum: CEFR_LEVELS, required: true },
      selectedAnswer: { type: Schema.Types.Mixed, required: true },
    },
  },
  { timestamps: true },
);

PracticeAttemptSchema.index({ groupId: 1 });
// Dedupe retry submit trùng (AF-07) — theo data-model UC-15.
PracticeAttemptSchema.index({ userId: 1, skillType: 1, refId: 1 }, { unique: true });
PracticeAttemptSchema.index({ userId: 1, submittedAt: -1 });

export const PracticeAttempt = mongoose.model<IPracticeAttempt>(
  'PracticeAttempt',
  PracticeAttemptSchema,
);
