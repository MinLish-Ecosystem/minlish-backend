import mongoose, { Document, Schema, Types } from "mongoose";

export interface ILearningProgress extends Document {
  userId: Types.ObjectId;
  wordId: Types.ObjectId;
  setId: Types.ObjectId;

  // SM-2 Algorithm fields
  easeFactor: number; // EF (>= 1.3)
  interval: number; // Days until next review
  repetitions: number; // Số lần ôn tập liên tiếp đúng
  nextReviewDate: Date;

  // Learning stats
  status: "new" | "learning" | "review" | "mastered";
  totalReviews: number;
  correctReviews: number;
  lastReviewDate?: Date;
  lastRating?: "again" | "hard" | "good" | "easy";

  createdAt: Date;
  updatedAt: Date;
}

const LearningProgressSchema = new Schema<ILearningProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    wordId: {
      type: Schema.Types.ObjectId,
      ref: "Word",
      required: true,
    },
    setId: {
      type: Schema.Types.ObjectId,
      ref: "VocabularySet",
      required: true,
    },
    easeFactor: {
      type: Number,
      default: 2.5,
      min: 1.3,
    },
    interval: {
      type: Number,
      default: 0, // 0 = new word
      min: 0,
    },
    repetitions: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextReviewDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ["new", "learning", "review", "mastered"],
      default: "new",
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    correctReviews: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReviewDate: {
      type: Date,
    },
    lastRating: {
      type: String,
      enum: ["again", "hard", "good", "easy"],
    },
  },
  { timestamps: true },
);

LearningProgressSchema.index({ userId: 1, wordId: 1 }, { unique: true });
LearningProgressSchema.index({ userId: 1, nextReviewDate: 1, status: 1 });
LearningProgressSchema.index({ userId: 1, setId: 1 });

export const LearningProgress = mongoose.model<ILearningProgress>(
  "LearningProgress",
  LearningProgressSchema,
);
