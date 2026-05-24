import mongoose, { Document, Schema, Types } from "mongoose";

export type VocabCategory =
  | "General"
  | "Business"
  | "IELTS"
  | "TOEIC"
  | "Travel"
  | "Technology"
  | "Academic"
  | "Psychology"
  | "Science"
  | "Other";

export type VocabLevel = "Beginner" | "Intermediate" | "Advanced" | "Academic";

export type ColorTheme =
  | "blue"
  | "emerald"
  | "amber"
  | "purple"
  | "rose"
  | "cyan";

export interface IVocabularySet extends Document {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  category: VocabCategory;
  level: VocabLevel;
  colorTheme: ColorTheme;
  tags: string[];
  isPublic: boolean;
  totalWords: number;
  learnerCount: number;        // Số người đã clone bộ từ này về library
  clonedFrom?: Types.ObjectId; // Ref đến set gốc nếu đây là bản copy
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VocabularySetSchema = new Schema<IVocabularySet>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Vocabulary set name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    category: {
      type: String,
      enum: ["General", "Business", "IELTS", "TOEIC", "Travel", "Technology", "Academic", "Psychology", "Science", "Other"],
      default: "General",
    },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "Academic"],
      default: "Intermediate",
    },
    colorTheme: {
      type: String,
      enum: ["blue", "emerald", "amber", "purple", "rose", "cyan"],
      default: "purple",
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 10,
        message: "Cannot have more than 10 tags",
      },
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    totalWords: {
      type: Number,
      default: 0,
      min: 0,
    },
    learnerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    clonedFrom: {
      type: Schema.Types.ObjectId,
      ref: "VocabularySet",
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// Compound indexes for common queries
VocabularySetSchema.index({ userId: 1, createdAt: -1 });
VocabularySetSchema.index({ tags: 1 });
VocabularySetSchema.index({ isPublic: 1, learnerCount: -1 }); // Explore: sorted by popularity
VocabularySetSchema.index({ isPublic: 1, createdAt: -1 });    // Explore: sorted by newest
VocabularySetSchema.index({ isPublic: 1, category: 1, level: 1 }); // Explore: filter by category+level
VocabularySetSchema.index({ userId: 1, category: 1 });         // My Library filter
VocabularySetSchema.index({ isDeleted: 1, updatedAt: -1 });  // sync query
VocabularySetSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });  // my library

// Full-text search index — hỗ trợ ?q=ielts tìm trong name, description, tags
VocabularySetSchema.index(
  { name: "text", description: "text", tags: "text" },
  { weights: { name: 10, tags: 5, description: 1 }, name: "vocab_text_search" }
);

export const VocabularySet = mongoose.model<IVocabularySet>(
  "VocabularySet",
  VocabularySetSchema,
);
