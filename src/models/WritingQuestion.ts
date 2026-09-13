import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * WritingQuestion — ngân hàng đề Writing Practice (UC-17, data-model.md §1).
 * Admin CRUD manual qua W5 (adminWriting.service); không AI sinh đề, không moderation.
 * v1 KHÔNG có field `level` — examType phân loại ngầm (SPEC CON-13).
 */

export type WritingExamType = 'ielts' | 'toeic';
// v1 chỉ hiển thị 4 dạng đầu; picture/sentence giữ enum cho future (UC-17 Special Req)
export type WritingTaskType = 'email' | 'letter' | 'essay' | 'report' | 'picture' | 'sentence';

export interface IWritingQuestion extends Document {
  _id: Types.ObjectId;
  examType: WritingExamType;
  taskType: WritingTaskType;
  title: string;
  prompt: string;
  instructions: string;
  wordLimit: number; // 20..500 — ngưỡng 50% dùng cho BR-01
  suggestedVocab?: string[]; // ≤ 15 từ
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const WritingQuestionSchema = new Schema<IWritingQuestion>(
  {
    examType: {
      type: String,
      enum: ['ielts', 'toeic'],
      required: [true, 'examType is required'],
    },
    taskType: {
      type: String,
      enum: ['email', 'letter', 'essay', 'report', 'picture', 'sentence'],
      required: [true, 'taskType is required'],
    },
    title: {
      type: String,
      required: [true, 'title is required'],
      trim: true,
      minlength: [1, 'title must be at least 1 character'],
      maxlength: [150, 'title cannot exceed 150 characters'],
    },
    prompt: {
      type: String,
      required: [true, 'prompt is required'],
      trim: true,
      minlength: [10, 'prompt must be at least 10 characters'],
      maxlength: [2000, 'prompt cannot exceed 2000 characters'],
    },
    instructions: {
      type: String,
      required: [true, 'instructions is required'],
      trim: true,
      minlength: [10, 'instructions must be at least 10 characters'],
      maxlength: [500, 'instructions cannot exceed 500 characters'],
    },
    wordLimit: {
      type: Number,
      required: [true, 'wordLimit is required'],
      min: [20, 'wordLimit must be >= 20'],
      max: [500, 'wordLimit must be <= 500'],
    },
    suggestedVocab: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => !v || v.length <= 15,
        message: 'suggestedVocab cannot exceed 15 words',
      },
    },
    isDeleted: {
      type: Boolean,
      default: false, // soft delete (W5 DELETE — NFR-037)
    },
  },
  { timestamps: true },
);

// W1/W5 filter theo examType + loại đề đã soft-delete
WritingQuestionSchema.index({ examType: 1, isDeleted: 1 });

export const WritingQuestion = mongoose.model<IWritingQuestion>(
  'WritingQuestion',
  WritingQuestionSchema,
);
