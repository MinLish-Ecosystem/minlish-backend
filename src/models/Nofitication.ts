import mongoose, { Document, Schema, Types } from "mongoose";

export interface INotification extends Document {
  userId: Types.ObjectId;
  type:
    | "daily_reminder"
    | "review_due"
    | "streak_milestone"
    | "achievement"
    | "system";
  title: string;
  message: string;
  isRead: boolean;
  data?: Record<string, any>;
  scheduledAt?: Date;
  sentAt?: Date;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "daily_reminder",
        "review_due",
        "streak_milestone",
        "achievement",
        "system",
        "report",
        "ai_moderation",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    data: {
      type: Schema.Types.Mixed,
    },
    scheduledAt: {
      type: Date,
    },
    sentAt: {
      type: Date,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ scheduledAt: 1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
);
