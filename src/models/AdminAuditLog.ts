import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAdminAuditLog extends Document {
  adminId:    Types.ObjectId;
  action:     'ban_user' | 'unban_user' | 'delete_user' | 'unpublish_set' | 'approve_set' | 'reject_set' | 'reset_user_auth' | 'READING_Q_CREATE' | 'READING_Q_UPDATE' | 'READING_Q_DELETE';
  targetId:   Types.ObjectId;
  targetType: 'user' | 'set' | 'word' | 'post' | 'reading_question';
  reason?:    string;
  before?:    object;
  after?:     object;
  createdAt:  Date;
  updatedAt:  Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>({
  adminId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  action:     { type: String, required: true },
  targetId:   { type: Schema.Types.ObjectId, required: true },
  targetType: { type: String, required: true },
  reason:     { type: String },
  before:     { type: Schema.Types.Mixed },
  after:      { type: Schema.Types.Mixed },
}, { timestamps: true });

AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ targetId: 1, targetType: 1 });

export const AdminAuditLog = mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);
