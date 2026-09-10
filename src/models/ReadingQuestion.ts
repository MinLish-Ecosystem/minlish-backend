// UC-14 Reading question bank (FR-110..FR-114).
// Union validation theo type nằm ở Zod (reading.schema.ts) — model chỉ giữ ràng buộc field cơ bản.
import mongoose, { Document, Schema, Types } from "mongoose";

export type ReadingQuestionType =
  | "short-sentence-mcq"
  | "main-idea-mcq"
  | "word-bank-fill";

export interface IReadingQuestion extends Document {
  // Immutable sau create — đảm bảo ở service, không ở schema
  type: ReadingQuestionType;
  level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  // short-sentence-mcq: 10..500 ký tự, đúng 1 marker `___blank___` (range validate ở Zod)
  sentence?: string | null;
  // optional tiêu đề dạng main idea
  title?: string | null;
  passage?: string | null;
  question?: string | null;
  options?: { id: string; text: string }[] | null;
  correctAnswer?: string | null; // option id
  wordOptions?: string[] | null;
  correctMapping?: Record<string, string> | null; // key `blank_N`, value thuộc wordOptions
  explanation?: string | null;
  isDeleted: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReadingQuestionSchema = new Schema<IReadingQuestion>(
  {
    type: {
      type: String,
      required: true,
      enum: ["short-sentence-mcq", "main-idea-mcq", "word-bank-fill"],
    },
    level: {
      type: String,
      required: true,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
    },
    // Schema chỉ maxlength 500 (10..500 + marker validate ở Zod)
    sentence: { type: String, default: null, maxlength: 500 },
    title: { type: String, default: null },
    passage: { type: String, default: null, maxlength: 2000 },
    question: { type: String, default: null, maxlength: 300 },
    options: {
      type: [
        {
          _id: false,
          id: { type: String, required: true },
          text: { type: String, required: true },
        },
      ],
      default: null,
    },
    correctAnswer: { type: String, default: null },
    wordOptions: { type: [String], default: null },
    correctMapping: { type: Schema.Types.Mixed, default: null },
    explanation: { type: String, default: null, maxlength: 1000 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ReadingQuestionSchema.index({ isDeleted: 1, level: 1 });
ReadingQuestionSchema.index({
  isDeleted: 1,
  type: 1,
  level: 1,
  createdAt: -1,
});

export const ReadingQuestion = mongoose.model<IReadingQuestion>(
  "ReadingQuestion",
  ReadingQuestionSchema
);
