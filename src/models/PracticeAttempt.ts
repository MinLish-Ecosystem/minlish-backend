import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * PracticeAttempt — Chi tiết từng câu trong phiên luyện tập (UC-16 / FR-115/116).
 * Ghi qua practice-skill.service.recordBatch(); groupId = PracticeSessionResult._id (R3).
 * payload snapshot {transcript, referenceText, matchedWords, totalWords, engine} tại lúc chấm (R8).
 */

import { SkillType } from './PracticeSession';

export interface ISpeakingAttemptPayload {
  transcript: string;
  referenceText: string;
  matchedWords: number;
  totalWords: number;
  engine: string;
}

export interface IPracticeAttempt extends Document {
  userId: Types.ObjectId;
  skillType: SkillType;
  refId: Types.ObjectId;
  groupId: Types.ObjectId;
  scorePercent: number;
  durationMs: number;
  submittedAt: Date;
  payload: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeAttemptSchema = new Schema<IPracticeAttempt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    skillType: {
      type: String,
      enum: ['SPEAKING', 'READING', 'LISTENING', 'WRITING'],
      required: true,
    },
    refId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'PracticeSessionResult',
      required: true,
      index: true,
    },
    scorePercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    submittedAt: {
      type: Date,
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

// Index đề xuất data-model.md §4: review theo groupId + tiến bộ learner + dedupe
PracticeAttemptSchema.index({ groupId: 1 });
PracticeAttemptSchema.index({ userId: 1, skillType: 1, submittedAt: -1 });
PracticeAttemptSchema.index(
  { userId: 1, skillType: 1, refId: 1, groupId: 1 },
  { unique: true }
);

export const PracticeAttempt = mongoose.model<IPracticeAttempt>(
  'PracticeAttempt',
  PracticeAttemptSchema
);
