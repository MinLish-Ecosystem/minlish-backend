import mongoose, { Document, Schema, Types } from "mongoose";

export interface IWord extends Document {
  setId: Types.ObjectId;
  word: string;
  pronunciation?: string;
  meaning: string;
  descriptionEN?: string;
  examples: string[];
  collocations: string[];
  relatedWords: string[];
  note?: string;
  imageUrl?: string;
  audioUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WordSchema = new Schema<IWord>(
  {
    setId: {
      type: Schema.Types.ObjectId,
      ref: "VocabularySet",
      required: true,
    },
    word: {
      type: String,
      required: [true, "Word is required"],
      trim: true,
      lowercase: true,
    },
    pronunciation: {
      type: String,
      trim: true,
    },
    meaning: {
      type: String,
      required: [true, "Meaning is required"],
    },
    descriptionEN: {
      type: String,
    },
    examples: {
      type: [String],
      default: [],
    },
    collocations: {
      type: [String],
      default: [],
    },
    relatedWords: {
      type: [String],
      default: [],
    },
    note: {
      type: String,
    },
    imageUrl: {
      type: String,
    },
    audioUrl: {
      type: String,
    },
  },
  { timestamps: true },
);

WordSchema.index({ setId: 1 });
WordSchema.index({ word: 1 });
WordSchema.index({ setId: 1, word: 1 }, { unique: true });

export const Word = mongoose.model<IWord>("Word", WordSchema);
