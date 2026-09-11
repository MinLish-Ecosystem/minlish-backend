import mongoose, { Document, Schema } from 'mongoose';
import {
  LISTENING_QUESTION_TYPES,
  CEFR_LEVELS,
  ListeningQuestionType,
  CefrLevel,
} from '../constants/listening';

/**
 * UC-15 ListeningQuestion — ngân hàng câu hỏi Listening (collection `listeningquestions`).
 * Ngân hàng giữ "thuần": chỉ có `level` (CEFR), KHÔNG có `topic` (§7.1).
 * Ràng buộc bắt buộc theo `type` (BR-03) được enforce ở pre-validate hook.
 */

export interface IListeningOption {
  id: string;
  text: string;
}

export interface IListeningQuestion extends Document {
  type: ListeningQuestionType;
  level: CefrLevel;
  transcript: string;
  options?: IListeningOption[];
  correctAnswer?: string;
  wordOptions?: string[];
  correctOrder?: string[];
  explanation?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ListeningOptionSchema = new Schema<IListeningOption>(
  {
    id: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const ListeningQuestionSchema = new Schema<IListeningQuestion>(
  {
    type: { type: String, enum: LISTENING_QUESTION_TYPES, required: true },
    level: { type: String, enum: CEFR_LEVELS, required: true },
    transcript: { type: String, required: true, minlength: 1, maxlength: 2000, trim: true },
    options: { type: [ListeningOptionSchema], default: undefined },
    correctAnswer: { type: String, trim: true },
    wordOptions: { type: [String], default: undefined },
    correctOrder: { type: [String], default: undefined },
    explanation: { type: String, trim: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

// Bắt buộc field theo type (BR-03): mcq cần options + correctAnswer;
// word-order cần wordOptions + correctOrder; transcription chỉ cần transcript.
ListeningQuestionSchema.pre('validate', function (next) {
  if (this.type === 'mcq') {
    if (!this.options || this.options.length === 0) {
      this.invalidate('options', 'options là bắt buộc với câu mcq');
    }
    if (!this.correctAnswer) {
      this.invalidate('correctAnswer', 'correctAnswer là bắt buộc với câu mcq');
    }
  }
  if (this.type === 'word-order') {
    if (!this.wordOptions || this.wordOptions.length === 0) {
      this.invalidate('wordOptions', 'wordOptions là bắt buộc với câu word-order');
    }
    if (!this.correctOrder || this.correctOrder.length === 0) {
      this.invalidate('correctOrder', 'correctOrder là bắt buộc với câu word-order');
    }
  }
  next();
});

// Index filter session + admin list (data-model).
ListeningQuestionSchema.index({ type: 1, level: 1, isDeleted: 1 });
ListeningQuestionSchema.index({ isDeleted: 1 });

export const ListeningQuestion = mongoose.model<IListeningQuestion>(
  'ListeningQuestion',
  ListeningQuestionSchema,
);
