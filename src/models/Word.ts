import mongoose, { Document, Schema, Types } from "mongoose";

export type PartOfSpeech =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "phrase"
  | "idiom"
  | "other";

export interface IWord extends Document {
  setId: Types.ObjectId;
  word: string;
  pronunciation?: string;
  partOfSpeech?: PartOfSpeech;
  meaning: string;
  descriptionEN?: string;
  examples: string[];
  synonyms: string[];
  antonyms: string[];
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
    partOfSpeech: {
      type: String,
      enum: ["noun", "verb", "adjective", "adverb", "phrase", "idiom", "other"],
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
    synonyms: {
      type: [String],
      default: [],
    },
    antonyms: {
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

// Indexes cho lookup nhanh
WordSchema.index({ setId: 1 });
WordSchema.index({ setId: 1, word: 1 }, { unique: true });

// Full-text search trong word list của một set
WordSchema.index(
  { word: "text", meaning: "text", descriptionEN: "text" },
  { weights: { word: 10, meaning: 3, descriptionEN: 1 }, name: "word_text_search" }
);

export const Word = mongoose.model<IWord>("Word", WordSchema);

