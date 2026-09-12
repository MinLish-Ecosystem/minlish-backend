import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * PracticeSessionResult — Sổ điểm phiên luyện tập dùng chung 4 kỹ năng (UC-16 / FR-116).
 * Ghi duy nhất qua practice-skill.service.recordBatch() với _id = groupId FE-gen (CAP-8).
 * Snapshot tại lúc nộp; sửa đề sau không đổi kết quả cũ (R8 nằm ở attempt payload).
 */

import { PracticeSessionType, PracticeSessionScope, SkillType } from './PracticeSession';

export type PracticeResultStatus = 'COMPLETED';

export interface ISkillSummary {
  skillType: SkillType;
  avgScorePercent: number;
  totalItems: number;
  totalTimeMs: number;
}

export interface IPracticeSessionResult extends Document {
  userId: Types.ObjectId;
  sessionId: Types.ObjectId | null;
  type: PracticeSessionType;
  scope: PracticeSessionScope;
  status: PracticeResultStatus;
  skillsSummary: ISkillSummary[];
  totalQuestions: number;
  totalTimeMs: number;
  fingerprint: string;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SkillSummarySchema = new Schema<ISkillSummary>(
  {
    skillType: {
      type: String,
      enum: ['SPEAKING', 'READING', 'LISTENING', 'WRITING'],
      required: true,
    },
    avgScorePercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    totalItems: {
      type: Number,
      required: true,
      min: 0,
    },
    totalTimeMs: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { _id: false }
);

const PracticeSessionResultSchema = new Schema<IPracticeSessionResult>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // [TBD: future — OQ-1 SPEC] v1 ghi từ path submit nhưng chưa bắt buộc truy vấn ngược
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'PracticeSession',
      default: null,
    },
    type: {
      type: String,
      enum: ['PRACTICE', 'EXAM'],
      required: true,
    },
    scope: {
      type: String,
      enum: ['SINGLE', 'MIXED'],
      required: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED'],
      required: true,
      default: 'COMPLETED',
    },
    skillsSummary: {
      type: [SkillSummarySchema],
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    totalTimeMs: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    completedAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// Index đề xuất data-model.md §3
PracticeSessionResultSchema.index({ userId: 1, completedAt: -1 });
PracticeSessionResultSchema.index({ sessionId: 1 });

export const PracticeSessionResult = mongoose.model<IPracticeSessionResult>(
  'PracticeSessionResult',
  PracticeSessionResultSchema
);
