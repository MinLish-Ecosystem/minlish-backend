import { Types } from 'mongoose';
import { User } from '../models/User';
import { VocabularySet } from '../models/VocabularySet';
import { Word } from '../models/Word';
import { UserProfile } from '../models/UserProfile';
import { LearningProgress } from '../models/LearningProgress';
import { DailyStats } from '../models/DailyStats';
import { Notification } from '../models/Nofitication';
import { FCMToken } from '../models/FCMToken';
import { OTP } from '../models/OTP';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';

export async function listUsers(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    User.find().select('-password -refreshToken').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getUserDetail(userId: string) {
  const user = await User.findById(userId).select('-password -refreshToken').lean();
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  return user;
}

export async function banUser(adminId: string, targetUserId: string, reason: string) {
  const target = await User.findById(targetUserId);
  if (!target) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  if (!target.isActive) throw new AppError('User already banned', HttpStatus.CONFLICT, 'ERR_ALREADY_BANNED');
  if (target.role === 'admin') throw new AppError('Cannot ban admin', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);

  const before = { isActive: target.isActive };
  await User.findByIdAndUpdate(targetUserId, { $set: { isActive: false, banReason: reason, bannedAt: new Date(), refreshToken: null } });

  await AdminAuditLog.create({ adminId: new Types.ObjectId(adminId), action: 'ban_user', targetId: new Types.ObjectId(targetUserId), targetType: 'user', reason, before, after: { isActive: false } });
}

export async function unbanUser(adminId: string, targetUserId: string) {
  const target = await User.findById(targetUserId);
  if (!target) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  if (target.isActive) throw new AppError('User is not banned', HttpStatus.CONFLICT, 'ERR_NOT_BANNED');

  const before = { isActive: target.isActive };
  await User.findByIdAndUpdate(targetUserId, { $set: { isActive: true, banReason: null, bannedAt: null } });

  await AdminAuditLog.create({ adminId: new Types.ObjectId(adminId), action: 'unban_user', targetId: new Types.ObjectId(targetUserId), targetType: 'user', before, after: { isActive: true } });
}

export async function deleteUser(adminId: string, targetUserId: string) {
  const target = await User.findById(targetUserId);
  if (!target) throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.USER_NOT_FOUND);
  if (target.role === 'admin') throw new AppError('Cannot delete admin', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);

  const before = { isActive: target.isActive, email: target.email, name: target.name };
  const now = new Date();

  // Soft-delete user's public content (sets + words) to preserve public data integrity
  const userSets = await VocabularySet.find({ userId: targetUserId }).select('_id').lean();
  const setIds = userSets.map((s: any) => s._id);

  const ops: Promise<any>[] = [];

  // Mark sets and words as deleted (soft delete)
  ops.push(VocabularySet.updateMany({ userId: targetUserId }, { $set: { isDeleted: true, deletedAt: now } }));
  if (setIds.length > 0) {
    ops.push(Word.updateMany({ setId: { $in: setIds } }, { $set: { isDeleted: true, deletedAt: now } }));
  }

  // Hard-delete personally identifiable / user-owned data
  ops.push(LearningProgress.deleteMany({ userId: targetUserId }));
  ops.push(DailyStats.deleteMany({ userId: targetUserId }));
  ops.push(Notification.deleteMany({ userId: targetUserId }));
  ops.push(FCMToken.deleteMany({ userId: targetUserId }));
  ops.push(OTP.deleteMany({ email: target.email }));
  ops.push(UserProfile.deleteOne({ userId: targetUserId }));

  // Execute deletes/updates in parallel
  await Promise.all(ops);

  // Finally remove the User document itself (hard delete)
  await User.findByIdAndDelete(targetUserId);

  await AdminAuditLog.create({ adminId: new Types.ObjectId(adminId), action: 'delete_user', targetId: new Types.ObjectId(targetUserId), targetType: 'user', before, after: null });
}

export async function getAdminStats() {
  const [totalUsers, activeUsers, bannedUsers, totalSets] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ isActive: false }),
    VocabularySet.countDocuments({ isPublic: true, moderationStatus: 'approved', isDeleted: { $ne: true } }),
  ]);
  return { totalUsers, activeUsers, bannedUsers, totalSets };
}

export async function listPublicSets(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    VocabularySet.find({ isPublic: true, isDeleted: { $ne: true } }).sort({ learnerCount: -1 }).skip(skip).limit(limit).lean(),
    VocabularySet.countDocuments({ isPublic: true, isDeleted: { $ne: true } }),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function unpublishSet(adminId: string, setId: string, reason?: string) {
  const set = await VocabularySet.findById(setId);
  if (!set) throw new AppError('Set not found', HttpStatus.NOT_FOUND, 'ERR_SET_NOT_FOUND');
  if (!set.isPublic) throw new AppError('Set is already private', HttpStatus.CONFLICT, 'ERR_ALREADY_PRIVATE');

  const before = { isPublic: set.isPublic };
  await VocabularySet.findByIdAndUpdate(setId, { $set: { isPublic: false } });
  await AdminAuditLog.create({ adminId: new Types.ObjectId(adminId), action: 'unpublish_set', targetId: new Types.ObjectId(setId), targetType: 'set', reason, before, after: { isPublic: false } });
}

export async function getAuditLogs(page = 1, limit = 50) {
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    AdminAuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdminAuditLog.countDocuments(),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function exportUsersReportCSV() {
  // Aggregate users with total public/private sets count
  const rows = await User.aggregate([
    {
      $lookup: {
        from: 'vocabularysets',
        localField: '_id',
        foreignField: 'userId',
        as: 'sets',
      },
    },
    {
      $addFields: {
        totalSets: { $size: '$sets' },
      },
    },
    {
      $project: {
        password: 0,
        refreshToken: 0,
        sets: 0,
      },
    },
    { $sort: { createdAt: -1 } },
  ]).allowDiskUse(true);

  // Build CSV
  const header = ['id', 'name', 'email', 'role', 'isActive', 'banReason', 'bannedAt', 'totalSets', 'createdAt', 'updatedAt'];

  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'string' ? v : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      escape(r._id),
      escape(r.name),
      escape(r.email),
      escape(r.role),
      escape(r.isActive),
      escape(r.banReason ?? ''),
      escape(r.bannedAt ? r.bannedAt.toISOString() : ''),
      escape(r.totalSets ?? 0),
      escape(r.createdAt ? r.createdAt.toISOString() : ''),
      escape(r.updatedAt ? r.updatedAt.toISOString() : ''),
    ].join(','));
  }

  return lines.join('\n');
}
