// UC-14 — log từng câu trả lời trong một phiên luyện tập (data-model §3).
// refId giữ ref sau soft delete của ReadingQuestion — không cascade.
import mongoose, { Document, Schema, Types } from "mongoose";

export type AttemptSkillType =
  | "READING"
  | "WRITING"
  | "LISTENING"
  | "SPEAKING";

export interface IPracticeAttempt extends Document {
  userId: Types.ObjectId;
  skillType: AttemptSkillType;
  // Câu gốc
  refId: Types.ObjectId;
  // = PracticeSessionResult._id
  groupId: Types.ObjectId;
  // 100 đúng, 0 sai
  scorePercent: number;
  durationMs: number;
  // Server time
  submittedAt: Date;
  // Snapshot bất biến của câu hỏi + đáp án khi submit
  payload: {
    type: string;
    level: string;
    selectedAnswer: string | Record<string, string> | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PracticeAttemptSchema = new Schema<IPracticeAttempt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    skillType: {
      type: String,
      required: true,
      enum: ["READING", "WRITING", "LISTENING", "SPEAKING"],
    },
    refId: {
      type: Schema.Types.ObjectId,
      ref: "ReadingQuestion",
      required: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    scorePercent: { type: Number, required: true, min: 0, max: 100 },
    durationMs: { type: Number, required: true, min: 0 },
    submittedAt: { type: Date, required: true, default: Date.now },
    payload: {
      type: {
        type: String,
        required: true,
      },
      level: {
        type: String,
        required: true,
      },
      // Mixed bên trong vì selectedAnswer là string hoặc Record
      selectedAnswer: { type: Schema.Types.Mixed, default: null },
    },
  },
  { timestamps: true }
);

// 1 câu chỉ xuất hiện 1 lần trong 1 phiên (idempotency theo groupId+refId)
PracticeAttemptSchema.index({ groupId: 1, refId: 1 }, { unique: true });
PracticeAttemptSchema.index({ groupId: 1, skillType: 1 });
PracticeAttemptSchema.index({ userId: 1, skillType: 1, submittedAt: -1 });
PracticeAttemptSchema.index({ refId: 1 });

export const PracticeAttempt = mongoose.model<IPracticeAttempt>(
  "PracticeAttempt",
  PracticeAttemptSchema
);
