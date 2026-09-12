import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * PracticeSession — Giáo án luyện tập dùng chung 4 kỹ năng (UC-16 / FR-112, _temp-diagrams ERD).
 * UC-16 chỉ đọc model này; tạo giáo án thuộc Manager/Admin flow khác (ngoài scope UC-16).
 * items ref-only {skillType, refId} — không nhúng nội dung câu (R4).
 */

export type PracticeSessionType = 'PRACTICE' | 'EXAM';
export type PracticeSessionScope = 'SINGLE' | 'MIXED';
export type PracticeSessionSource = 'RANDOM' | 'CUSTOM';
export type SkillType = 'SPEAKING' | 'READING' | 'LISTENING' | 'WRITING';

export interface IPracticeSessionItem {
  skillType: SkillType;
  refId: Types.ObjectId;
}

export interface IPracticeSession extends Document {
  createdBy: Types.ObjectId;
  name: string;
  type: PracticeSessionType;
  scope: PracticeSessionScope;
  source: PracticeSessionSource;
  filterLevel: string | null;
  topic: string | null;
  items: IPracticeSessionItem[];
  createdAt: Date;
  updatedAt: Date;
}

const PracticeSessionItemSchema = new Schema<IPracticeSessionItem>(
  {
    skillType: {
      type: String,
      enum: ['SPEAKING', 'READING', 'LISTENING', 'WRITING'],
      required: true,
    },
    refId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
  },
  { _id: false }
);

const PracticeSessionSchema = new Schema<IPracticeSession>(
  {
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Session name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['PRACTICE', 'EXAM'],
      required: true,
    },
    scope: {
      type: String,
      enum: ['SINGLE', 'MIXED'],
      required: true,
      default: 'SINGLE',
    },
    source: {
      type: String,
      enum: ['RANDOM', 'CUSTOM'],
      required: true,
    },
    filterLevel: {
      type: String,
      enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
      default: null,
    },
    topic: {
      type: String,
      default: null,
    },
    items: {
      type: [PracticeSessionItemSchema],
      required: true,
      default: [],
    },
  },
  { timestamps: true }
);

export const PracticeSession = mongoose.model<IPracticeSession>(
  'PracticeSession',
  PracticeSessionSchema
);
