import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFCMToken extends Document {
  userId: Types.ObjectId;
  token: string;
  deviceId: string;
  platform: 'android' | 'ios' | 'web';
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FCMTokenSchema = new Schema<IFCMToken>({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token:     { type: String, required: true },
  deviceId:  { type: String, required: true },
  platform:  { type: String, enum: ['android','ios','web'], required: true },
  lastUsedAt:{ type: Date, default: Date.now },
}, { timestamps: true });

FCMTokenSchema.index({ userId: 1, deviceId: 1 }, { unique: true });
FCMTokenSchema.index({ token: 1 });

export const FCMToken = mongoose.model<IFCMToken>('FCMToken', FCMTokenSchema);
