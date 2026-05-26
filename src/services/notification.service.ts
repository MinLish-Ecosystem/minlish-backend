import { Types } from 'mongoose';
import { Notification } from '../models/Nofitication';

export async function getNotifications(userId: string, page = 1, limit = 20, type?: string) {
  const skip = (page - 1) * limit;
  const query: any = { userId: new Types.ObjectId(userId), isDeleted: { $ne: true } };
  if (type) query.type = type;

  const [data, total, unreadCount] = await Promise.all([
    Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ ...query, isRead: false }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    unreadCount,
  };
}

export async function getUnreadCount(userId: string) {
  return Notification.countDocuments({ userId: new Types.ObjectId(userId), isDeleted: { $ne: true }, isRead: false });
}

export async function markRead(userId: string, id: string) {
  await Notification.updateOne({ _id: id, userId: new Types.ObjectId(userId) }, { $set: { isRead: true } });
}

export async function markAllRead(userId: string) {
  await Notification.updateMany({ userId: new Types.ObjectId(userId), isRead: false }, { $set: { isRead: true } });
}

export async function deleteNotification(userId: string, id: string) {
  // Soft delete pattern: set isDeleted
  await Notification.updateOne({ _id: id, userId: new Types.ObjectId(userId) }, { $set: { isDeleted: true } });
}
