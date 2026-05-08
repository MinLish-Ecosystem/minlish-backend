import mongoose, { Document, Schema, Types } from "mongoose";

export interface IVocabularySet extends Document {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  tags: string[];
  isPublic: boolean;
  totalWords: number;
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
  },
  { timestamps: true },
);

VocabularySetSchema.index({ userId: 1, createdAt: -1 });
VocabularySetSchema.index({ tags: 1 });
VocabularySetSchema.index({ isPublic: 1, totalWords: -1 });

export const VocabularySet = mongoose.model<IVocabularySet>(
  "VocabularySet",
  VocabularySetSchema,
);
