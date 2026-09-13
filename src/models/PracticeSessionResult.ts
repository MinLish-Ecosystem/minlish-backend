import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * PracticeSessionResult — sổ điểm phiên DÙNG CHUNG UC-14..17 (kiến trúc B′, data-model.md §2).
 * `_id` = groupId FE-gen (W3 set trực tiếp khi INSERT — R3).
 * v1 Writing: type=PRACTICE, scope=SINGLE, status=COMPLETED — ghi lô 1 lần khi Hoàn thành.
 * Ownership (AD-3): chỉ writing.service ghi document này cho skillType WRITING.
 */

export type PracticeType = 'PRACTICE' | 'EXAM';
export type PracticeScope = 'SINGLE' | 'MIXED';
export type PracticeStatus = 'COMPLETED' | 'IN_PROGRESS'; // v1 luôn COMPLETED

export interface ISkillSummary {
  skillType: string;
  correct: number;
  total: number;
}

export interface IPracticeSessionResult extends Document {
  _id: Types.ObjectId; // = groupId của các attempt trong phiên (R3)
  userId: Types.ObjectId;
  sessionId?: Types.ObjectId | null; // v1 null — collection PracticeSession để future (BR-07)
  type: PracticeType;
  examKind?: 'MOCK' | 'OFFICIAL' | null; // chỉ khi type=EXAM — v1 không dùng
  scope: PracticeScope;
  status: PracticeStatus;
  totalQuestions: number;
  correctCount?: number; // số attempt scorePercent >= 60
  accuracyPercent?: number;
  totalTimeMs?: number; // sum(durationMs)
  skillsSummary?: ISkillSummary[];
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeSessionResultSchema = new Schema<IPracticeSessionResult>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
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
    examKind: {
      type: String,
      enum: ['MOCK', 'OFFICIAL'],
      default: null,
    },
    scope: {
      type: String,
      enum: ['SINGLE', 'MIXED'],
      required: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'IN_PROGRESS'],
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
      min: 1,
    },
    correctCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    accuracyPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    totalTimeMs: {
      type: Number,
      min: 0,
    },
    skillsSummary: {
      type: [
        {
          _id: false,
          skillType: { type: String, required: true },
          correct: { type: Number, required: true, min: 0 },
          total: { type: Number, required: true, min: 1 },
        },
      ],
      default: [],
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// W4 lịch sử phiên của user (data-model.md §6)
PracticeSessionResultSchema.index({ userId: 1, completedAt: -1 });
PracticeSessionResultSchema.index({ userId: 1, type: 1 });

export const PracticeSessionResult = mongoose.model<IPracticeSessionResult>(
  'PracticeSessionResult',
  PracticeSessionResultSchema,
);
