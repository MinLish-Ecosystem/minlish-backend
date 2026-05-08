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
  },
  { timestamps: true },
);

DailyStatsSchema.index({ userId: 1, date: -1 }, { unique: true });
DailyStatsSchema.index({ userId: 1, createdAt: -1 });

export const DailyStats = mongoose.model<IDailyStats>(
  "DailyStats",
  DailyStatsSchema,
);
