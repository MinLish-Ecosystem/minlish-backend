import mongoose, { Document, Schema, Types } from "mongoose";

export interface IDailyPracticeResult extends Document {
  userId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  score: number;
  correctAnswers: number;
  timeTaken: number; // Seconds
  createdAt: Date;
  updatedAt: Date;
}

const DailyPracticeResultSchema = new Schema<IDailyPracticeResult>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    correctAnswers: {
      type: Number,
      required: true,
      min: 0,
      max: 15,
    },
    timeTaken: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

// A user can submit only one result per daily challenge date
DailyPracticeResultSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DailyPracticeResult = mongoose.model<IDailyPracticeResult>(
  "DailyPracticeResult",
  DailyPracticeResultSchema
);
