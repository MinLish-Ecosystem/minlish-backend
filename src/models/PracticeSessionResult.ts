import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * PracticeSessionResult — tổng kết một phiên luyện (bảng dùng chung, B′).
 * UC-15 ghi 1 dòng `status=COMPLETED` khi Finish (batch write), không ghi dần.
 * Ownership: `listening.service` (AD-3).
 */

export interface IPracticeSessionResult extends Document {
  userId: Types.ObjectId;
  type: string;
  scope: string;
  status: string;
  totalQuestions: number;
  correctCount: number;
  accuracyPercent: number;
  totalTimeMs: number;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeSessionResultSchema = new Schema<IPracticeSessionResult>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true, default: 'PRACTICE' },
    scope: { type: String, required: true, default: 'SINGLE' },
    status: { type: String, required: true, default: 'COMPLETED' },
    totalQuestions: { type: Number, required: true, min: 1 },
    correctCount: { type: Number, required: true, min: 0 },
    accuracyPercent: { type: Number, required: true, min: 0, max: 100 },
    totalTimeMs: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

PracticeSessionResultSchema.index({ userId: 1, createdAt: -1 });

export const PracticeSessionResult = mongoose.model<IPracticeSessionResult>(
  'PracticeSessionResult',
  PracticeSessionResultSchema,
);
