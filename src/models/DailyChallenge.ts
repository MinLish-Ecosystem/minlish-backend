import mongoose, { Document, Schema } from "mongoose";

export interface IQuestion {
  type: "DICTATION" | "MULTIPLE_CHOICE" | "SCRAMBLE";
  word: string;
  questionText: string;
  options?: string[];
  correctAnswerIndex?: number;
  scrambledTokens?: string[];
  correctSentence?: string;
  audioUrl?: string;
  explanation: string;
}

export interface IDailyChallenge extends Document {
  date: string; // YYYY-MM-DD
  questions: IQuestion[];
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  type: {
    type: String,
    enum: ["DICTATION", "MULTIPLE_CHOICE", "SCRAMBLE"],
    required: true,
  },
  word: {
    type: String,
    required: true,
  },
  questionText: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    default: undefined,
  },
  correctAnswerIndex: {
    type: Number,
    default: undefined,
  },
  scrambledTokens: {
    type: [String],
    default: undefined,
  },
  correctSentence: {
    type: String,
    default: undefined,
  },
  audioUrl: {
    type: String,
    default: undefined,
  },
  explanation: {
    type: String,
    required: true,
  },
});

const DailyChallengeSchema = new Schema<IDailyChallenge>(
  {
    date: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    questions: {
      type: [QuestionSchema],
      required: true,
    },
  },
  { timestamps: true }
);

export const DailyChallenge = mongoose.model<IDailyChallenge>(
  "DailyChallenge",
  DailyChallengeSchema
);
