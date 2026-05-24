import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

// ─── Interface ────────────────────────────────────────────────────────────────
export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  avatar: string | null;
  isVerified: boolean;
  refreshToken: string | null;
  isActive: boolean;
  banReason?: string;
  bannedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Method
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ─── Schema ──────────────────────────────────────────────────────────────────
const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Mặc định KHÔNG trả password trong query
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    avatar: {
      type: String,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
      default: null,
      select: false, // Mặc định KHÔNG trả refreshToken trong query
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    banReason: {
      type: String,
      maxlength: [500, 'Ban reason cannot exceed 500 characters'],
    },
    bannedAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // tự động thêm createdAt, updatedAt
  }
);

// ─── Pre-save Hook: Hash password trước khi lưu ──────────────────────────────
UserSchema.pre('save', async function (next) {
  // Chỉ hash khi password thay đổi (tránh hash lại khi update trường khác)
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance Method: So sánh password ───────────────────────────────────────
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUser>('User', UserSchema);
