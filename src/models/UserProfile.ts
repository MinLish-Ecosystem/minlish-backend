import mongoose, { Document, Schema, Types } from "mongoose";

export interface IUserProfile extends Document {
  userId: Types.ObjectId;
  learningGoal: "ielts" | "toeic" | "business" | "travel" | "general" | "other";
  targetLevel?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  currentLevel?: "beginner" | "intermediate" | "advanced";
  dailyGoal: number; // Số từ mới mỗi ngày
  reminderTime?: string; // HH:mm format
  timezone?: string;
  preferences: {
    emailNotification: boolean;
    pushNotification: boolean;
    soundEffect: boolean;
  };
  reviewPerDay: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    learningGoal: {
      type: String,
      enum: ["ielts", "toeic", "business", "travel", "general", "other"],
      default: "general",
    },
    targetLevel: {
      type: String,
      enum: ["A1", "A2", "B1", "B2", "C1", "C2"],
    },
    currentLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    dailyGoal: {
      type: Number,
      default: 10,
      min: [1, "Daily goal must be at least 1"],
      max: [100, "Daily goal cannot exceed 100"],
    },
    reminderTime: {
      type: String,
      match: [/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)"],
      default: "20:00",
    },
    timezone: {
      type: String,
      default: "Asia/Ho_Chi_Minh",
    },
    preferences: {
      emailNotification: { type: Boolean, default: true },
      pushNotification: { type: Boolean, default: true },
      soundEffect: { type: Boolean, default: true },
    },
    reviewPerDay: {
      type: Number,
      default: 20,
      min: [1, "Review goal must be at least 1"],
      max: [200, "Review goal cannot exceed 200"],
    },
  },
  { timestamps: true },
);

UserProfileSchema.index({ userId: 1 });

export const UserProfile = mongoose.model<IUserProfile>(
  "UserProfile",
  UserProfileSchema,
);
