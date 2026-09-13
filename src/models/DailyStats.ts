import mongoose, { Document, Schema, Types } from "mongoose";

export interface IDailyStats extends Document {
  userId: Types.ObjectId;
  date: Date; // YYYY-MM-DD
  newWordsLearned: number;
  wordsReviewed: number;
  correctAnswers: number;
  totalAnswers: number;
  timeSpent: number; // Seconds
  streak: number;
  /** Voice AI: số câu đã nói được chấm trong ngày (ghi khi xong phiên, FE rule-based). */
  voiceUtterances: number;
  /** Voice AI: số phiên hoàn thành (đạt targetScore) trong ngày. */
  voiceSessions: number;
  /** UC-17 Writing: số bài Writing đã nộp trong ngày (tăng khi submit lô thành công — CAP-07). */
  writingSubmissions: number;
  createdAt: Date;
  updatedAt: Date;
}

const DailyStatsSchema = new Schema<IDailyStats>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    newWordsLearned: {
      type: Number,
      default: 0,
      min: 0,
    },
    wordsReviewed: {
      type: Number,
      default: 0,
      min: 0,
    },
    correctAnswers: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAnswers: {
      type: Number,
      default: 0,
      min: 0,
    },
    timeSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    streak: {
      type: Number,
      default: 0,
      min: 0,
    },
    voiceUtterances: {
      type: Number,
      default: 0,
      min: 0,
    },
    voiceSessions: {
      type: Number,
      default: 0,
      min: 0,
    },
    writingSubmissions: {
      // UC-17 (CAP-07): tăng theo số attempt ghi lô thành công — active-day cho streak
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

DailyStatsSchema.index({ userId: 1, date: -1 }, { unique: true });
DailyStatsSchema.index({ userId: 1, createdAt: -1 });

export const DailyStats = mongoose.model<IDailyStats>(
  "DailyStats",
  DailyStatsSchema,
);
