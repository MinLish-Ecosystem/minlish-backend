import mongoose, { Document, Schema } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IOTP extends Document {
  email: string;
  otp: string;
  type: 'verify_email' | 'reset_password' | 'change_email';
  expiresAt: Date;
  createdAt: Date;
  // optional metadata (e.g., requestedBy, newEmail)
  meta?: Record<string, any> | null;
}

// ─── Schema ──────────────────────────────────────────────────────────────────
const OTPSchema = new Schema<IOTP>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['verify_email', 'reset_password', 'change_email'],
      required: true,
    },
    meta: {
      type: Schema.Types.Mixed,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ─── TTL Index: MongoDB tự động xóa document sau khi expiresAt ───────────────
// Không cần cron job, MongoDB tự dọn rác mỗi 60 giây
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index để tìm nhanh theo email + type
OTPSchema.index({ email: 1, type: 1 });

export const OTP = mongoose.model<IOTP>('OTP', OTPSchema);
