import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * SpeakingPrompt — Ngân hàng câu mẫu luyện nói (UC-16 / FR-114).
 * Ownership ghi: speakingSkill.service (AD-3) — không ghi model này từ service khác.
 * Ngân hàng giữ thuần: chỉ level + referenceText, không topic (topic là nhãn PracticeSession).
 * isActive=false = soft-delete → lọc khỏi phiên render (R5), vẫn load khi chấm lịch sử.
 */

export type SpeakingPromptSource = 'seed' | 'admin' | 'ai';
export type SpeakingLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface ISpeakingPrompt extends Document {
  level: SpeakingLevel;
  referenceText: string;
  audioUrl: string | null;
  source: SpeakingPromptSource;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SpeakingPromptSchema = new Schema<ISpeakingPrompt>(
  {
    level: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      required: [true, 'Level is required'],
      index: true,
    },
    referenceText: {
      type: String,
      required: [true, 'Reference text is required'],
      trim: true,
      minlength: [1, 'Reference text cannot be empty'],
      maxlength: [2000, 'Reference text cannot exceed 2000 characters'],
    },
    audioUrl: {
      type: String,
      default: null,
      validate: {
        validator: (v: string | null) => v === null || /^https?:\/\//.test(v),
        message: 'audioUrl must be a valid http/https URL or null',
      },
    },
    source: {
      type: String,
      enum: ['seed', 'admin', 'ai'],
      default: 'admin',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Index đề xuất data-model.md §1: lọc RANDOM theo level + list admin mới nhất trước + search
SpeakingPromptSchema.index({ isActive: 1, level: 1, _id: 1 });
SpeakingPromptSchema.index({ createdAt: -1 });
SpeakingPromptSchema.index({ referenceText: 'text' });

export const SpeakingPrompt = mongoose.model<ISpeakingPrompt>(
  'SpeakingPrompt',
  SpeakingPromptSchema
);

// ─── Types dùng chung cho service/controller ─────────────────────────────────

export interface SpeakingPromptPublicDTO {
  id: string;
  level: SpeakingLevel;
  referenceText: string;
  audioUrl: string | null;
  source: SpeakingPromptSource;
}

export function toSpeakingPromptDTO(doc: ISpeakingPrompt): SpeakingPromptPublicDTO {
  return {
    id: doc._id.toHexString(),
    level: doc.level,
    referenceText: doc.referenceText,
    audioUrl: doc.audioUrl,
    source: doc.source,
  };
}

// Types.ObjectId chỉ để hổ trợ ref type trong schema — giữ import cho các model khác dùng
export type SpeakingPromptRef = Types.ObjectId;
