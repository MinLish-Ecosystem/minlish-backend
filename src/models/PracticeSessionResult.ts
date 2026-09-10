// UC-14 — kiến trúc B′: kết quả phiên luyện tập dùng chung cho mọi skill (FR-115).
// _id = groupId do FE gửi (không tự sinh) — được set khi create, schema chỉ định nghĩa field còn lại.
import mongoose, { Document, Schema, Types } from "mongoose";

export type SessionSkillType =
  | "READING"
  | "WRITING"
  | "LISTENING"
  | "SPEAKING";

export interface IPracticeSessionResult extends Document {
  userId: Types.ObjectId;
  type: "PRACTICE" | "EXAM";
  scope: "SINGLE" | "MIXED";
  // Chỉ lưu phiên hoàn tất, không có IN_PROGRESS
  status: "COMPLETED";
  skillsSummary: Array<{
    skillType: SessionSkillType;
    correctCount: number;
    totalQuestions: number;
  }>;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  accuracyPercent: number;
  totalTimeMs: number;
  // KHÔNG lưu averageTimeMs — giá trị dẫn xuất, tính từ totalTimeMs/totalQuestions khi cần
  startedAt: Date;
  completedAt: Date;
  // Fingerprint nội bộ request đã chuẩn hóa (sau keep-last), dùng phát hiện body khác với cùng groupId
  requestFingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeSessionResultSchema = new Schema<IPracticeSessionResult>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, enum: ["PRACTICE", "EXAM"], default: "PRACTICE" },
    scope: { type: String, enum: ["SINGLE", "MIXED"], default: "SINGLE" },
    status: { type: String, enum: ["COMPLETED"], default: "COMPLETED" },
    skillsSummary: {
      type: [
        {
          _id: false,
          skillType: {
            type: String,
            required: true,
            enum: ["READING", "WRITING", "LISTENING", "SPEAKING"],
          },
          correctCount: { type: Number, required: true, min: 0 },
          totalQuestions: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
    totalQuestions: { type: Number, required: true, min: 1, max: 15 },
    correctCount: { type: Number, required: true, min: 0 },
    incorrectCount: { type: Number, required: true, min: 0 },
    accuracyPercent: { type: Number, required: true, min: 0, max: 100 },
    totalTimeMs: { type: Number, required: true, min: 0 },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true },
    requestFingerprint: { type: String, required: true },
  },
  { timestamps: true }
);

PracticeSessionResultSchema.index({ userId: 1, completedAt: -1 });

export const PracticeSessionResult =
  mongoose.model<IPracticeSessionResult>(
    "PracticeSessionResult",
    PracticeSessionResultSchema
  );
