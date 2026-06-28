import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IModerationResult {
  setId: Types.ObjectId;
  setName: string;
  creatorName: string;
  creatorEmail: string;
  wordsCount: number;
  status: 'approved' | 'rejected';
  reason: string;
  flaggedTerms?: string[];
}

export interface IModerationLog extends Document {
  runAt: Date;
  type: 'auto' | 'manual';
  setsCount: number;
  results: IModerationResult[];
  createdAt: Date;
  updatedAt: Date;
}

const ModerationResultSchema = new Schema<IModerationResult>({
  setId: { type: Schema.Types.ObjectId, ref: 'VocabularySet', required: true },
  setName: { type: String, required: true },
  creatorName: { type: String, required: true },
  creatorEmail: { type: String, required: true },
  wordsCount: { type: Number, required: true },
  status: { type: String, enum: ['approved', 'rejected'], required: true },
  reason: { type: String, required: true },
  flaggedTerms: { type: [String], default: [] },
});

const ModerationLogSchema = new Schema<IModerationLog>(
  {
    runAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    type: {
      type: String,
      enum: ['auto', 'manual'],
      required: true,
    },
    setsCount: {
      type: Number,
      required: true,
      default: 0,
    },
    results: {
      type: [ModerationResultSchema],
      default: [],
    },
  },
  { timestamps: true }
);

ModerationLogSchema.index({ runAt: -1 });
ModerationLogSchema.index({ type: 1 });

export const ModerationLog = mongoose.model<IModerationLog>('ModerationLog', ModerationLogSchema);
