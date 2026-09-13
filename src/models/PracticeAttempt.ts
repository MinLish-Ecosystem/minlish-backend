import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * PracticeAttempt — bài nộp DÙNG CHUNG UC-14..17 (kiến trúc B′, data-model.md §3).
 * Discriminator `skillType` quyết định shape `payload`; UC-17 ghi skillType="WRITING".
 * groupId = PracticeSessionResult._id của phiên (R3).
 * Unique {userId, skillType, refId} chặn nộp trùng vĩnh viễn (BR-03/CON-06).
 */

export type PracticeSkillType = 'WRITING' | 'READING' | 'LISTENING' | 'SPEAKING';

/** Shape payload khi skillType="WRITING" (UC-17 §7) — snapshot tại lúc chấm (BR-08/R8). */
export interface IWritingAttemptPayload {
  examType: string;
  taskType?: string;
  userText: string;
  wordCount: number;
  aiResult: {
    bandScale: 'TOEIC_0_5' | 'IELTS_0_9';
    bandScore: number; // TOEIC 0..5 | IELTS 0..9
    feedback: string;
    strengths?: string[];
    improvements?: string[];
    correctedText: string;
  };
}

export interface IPracticeAttempt extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  skillType: PracticeSkillType;
  refId: Types.ObjectId; // UC-17: trỏ WritingQuestion._id
  groupId: Types.ObjectId; // = PracticeSessionResult._id (R3)
  scorePercent?: number; // TOEIC round(band/5*100) | IELTS round(band/9*100)
  durationMs?: number; // từ mở đề → nhấn Nộp (CON-15)
  submittedAt: Date;
  payload: IWritingAttemptPayload | Record<string, unknown>; // shape theo skillType
  createdAt: Date;
  updatedAt: Date;
}

const PracticeAttemptSchema = new Schema<IPracticeAttempt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    skillType: {
      type: String,
      enum: ['WRITING', 'READING', 'LISTENING', 'SPEAKING'],
      required: true,
    },
    refId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: 'PracticeSessionResult',
      required: true,
    },
    scorePercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    durationMs: {
      type: Number,
      min: 1,
      max: 86400000, // 24h
    },
    submittedAt: {
      type: Date,
      default: () => new Date(),
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true },
);

// BR-03: một đề — một lần nộp vĩnh viễn (unique index)
PracticeAttemptSchema.index({ userId: 1, skillType: 1, refId: 1 }, { unique: true });
// W4 populate attempts theo phiên
PracticeAttemptSchema.index({ groupId: 1 });
// Lịch sử cá nhân
PracticeAttemptSchema.index({ userId: 1, submittedAt: -1 });

export const PracticeAttempt = mongoose.model<IPracticeAttempt>(
  'PracticeAttempt',
  PracticeAttemptSchema,
);
