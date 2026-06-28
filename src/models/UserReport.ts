import mongoose, { Document, Schema, Types } from 'mongoose';

export type ReportCategory =
  | 'bug'
  | 'content'
  | 'abuse'
  | 'suggestion'
  | 'other';

export interface IUserReport extends Document {
  userId: Types.ObjectId;
  category: ReportCategory;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

const UserReportSchema = new Schema<IUserReport>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
      type: String,
      enum: ['bug', 'content', 'abuse', 'suggestion', 'other'],
      required: true,
    },
    subject: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

UserReportSchema.index({ userId: 1, createdAt: -1 });
UserReportSchema.index({ isRead: 1, createdAt: -1 });

export const UserReport = mongoose.model<IUserReport>('UserReport', UserReportSchema);
