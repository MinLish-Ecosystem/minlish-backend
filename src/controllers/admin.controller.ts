import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import * as adminService from '../services/admin.service';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';
import { getOrCreateSystemConfig, SystemConfig } from '../models/SystemConfig';
import { runAutoModerationBatch, runAutoModerationPostsBatch, manualOverrideModeration } from '../services/moderation.service';
import { rescheduleModerationJob } from '../services/moderation.worker';
import { VocabularySet } from '../models/VocabularySet';
import { ModerationLog } from '../models/ModerationLog';
import { Post } from '../models/Post';
import { Notification } from '../models/Nofitication';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { isRedisAvailable } from '../config/redis';
import { User } from '../models/User';

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Lấy danh sách người dùng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Danh sách người dùng
 */
export const listUsersController = catchAsync(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const result = await adminService.listUsers(page, limit);
  return sendSuccess(res, 'Users fetched successfully', result.data, 200, result.pagination);
});

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Lấy chi tiết người dùng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chi tiết người dùng
 *       404:
 *         description: Không tìm thấy người dùng
 */
export const getUserDetailController = catchAsync(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = await adminService.getUserDetail(id);
  return sendSuccess(res, 'User details fetched successfully', user);
});

/**
 * @swagger
 * /api/v1/admin/users/{id}/ban:
 *   put:
 *     tags: [Admin]
 *     summary: Khóa tài khoản người dùng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Người dùng đã bị khóa
 */
export const banUserController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  const id = req.params.id;
  const reason = req.body.reason;
  await adminService.banUser(adminId, id, reason);
  return sendSuccess(res, 'User banned successfully');
});

/**
 * @swagger
 * /api/v1/admin/users/{id}/unban:
 *   put:
 *     tags: [Admin]
 *     summary: Mở khóa tài khoản người dùng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Người dùng đã được mở khóa
 */
export const unbanUserController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  const id = req.params.id;
  await adminService.unbanUser(adminId, id);
  return sendSuccess(res, 'User unbanned successfully');
});

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     tags: [Admin]
 *     summary: Xóa người dùng
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Người dùng đã bị xóa
 */
export const deleteUserController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  const id = req.params.id;
  await adminService.deleteUser(adminId, id);
  return sendSuccess(res, 'User deleted successfully');
});

/**
 * @swagger
 * /api/v1/admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Lấy thống kê admin
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê hệ thống
 */
export const getAdminStatsController = catchAsync(async (_req: Request, res: Response) => {
  const stats = await adminService.getAdminStats();
  return sendSuccess(res, 'Admin stats fetched successfully', stats);
});

/**
 * @swagger
 * /api/v1/admin/sets:
 *   get:
 *     tags: [Admin]
 *     summary: Lấy danh sách public sets
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Danh sách sets
 */
export const listPublicSetsController = catchAsync(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const status = req.query.status as string || undefined;
  const q = req.query.q as string || undefined;
  const category = req.query.category as string || undefined;
  const sort = req.query.sort as string || 'newest';
  const result = await adminService.listPublicSets(page, limit, status, q, category, sort);
  return sendSuccess(res, 'Public sets fetched successfully', result.data, 200, result.pagination);
});

/**
 * @swagger
 * /api/v1/admin/sets/{id}/unpublish:
 *   put:
 *     tags: [Admin]
 *     summary: Ẩn public set
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Set đã được ẩn
 */
export const unpublishSetController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  const id = req.params.id;
  const reason = req.body.reason;
  await adminService.unpublishSet(adminId, id, reason);
  return sendSuccess(res, 'Set unpublished successfully');
});

/**
 * @swagger
 * /api/v1/admin/audit-logs:
 *   get:
 *     tags: [Admin]
 *     summary: Lấy audit logs của admin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Danh sách audit logs
 */
export const getAuditLogsController = catchAsync(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const result = await adminService.getAuditLogs(page, limit);
  return sendSuccess(res, 'Audit logs fetched successfully', result.data, 200, result.pagination);
});

/**
 * @swagger
 * /api/v1/admin/reports:
 *   get:
 *     tags: [Admin]
 *     summary: Export users report as CSV
 *     security:
 *       - BearerAuth: []
 *     produces:
 *       - text/csv
 *     responses:
 *       200:
 *         description: CSV file download
 */
export const getReportsController = catchAsync(async (_req: Request, res: Response) => {
  const csv = await adminService.exportUsersReportCSV();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="users_report.csv"');
  res.status(200).send(csv);
});

// ─── System Configuration Controllers ─────────────────────────────────────────

export const getSystemConfigController = catchAsync(async (_req: Request, res: Response) => {
  const config = await getOrCreateSystemConfig();
  return sendSuccess(res, 'System configuration fetched successfully', config);
});

export const updateSystemConfigController = catchAsync(async (req: Request, res: Response) => {
  let config = await SystemConfig.findOne();
  if (!config) {
    config = await SystemConfig.create({});
  }

  const oldInterval = config.moderationInterval;
  
  // Cập nhật cấu hình
  config.set(req.body);
  await config.save();

  // Nếu tần suất kiểm duyệt thay đổi, lên lịch lại background job
  if (req.body.moderationInterval !== undefined && req.body.moderationInterval !== oldInterval) {
    await rescheduleModerationJob(config.moderationInterval);
  }

  return sendSuccess(res, 'System configuration updated successfully', config);
});

// ─── Content Moderation Controllers ───────────────────────────────────────────

export const getPendingModerationSetsController = catchAsync(async (_req: Request, res: Response) => {
  const pendingSets = await VocabularySet.find({
    isPublic: true,
    moderationStatus: 'pending',
    isDeleted: { $ne: true }
  }).populate('userId', 'name email').sort({ createdAt: -1 }).lean();

  return sendSuccess(res, 'Pending sets fetched successfully', pendingSets);
});

export const getModerationLogsController = catchAsync(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    ModerationLog.find().sort({ runAt: -1 }).skip(skip).limit(limit).lean(),
    ModerationLog.countDocuments()
  ]);

  return sendSuccess(res, 'Moderation logs fetched successfully', logs, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  });
});

export const overrideModerationController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  const { setId, status, reason } = req.body;

  if (!setId || !status || !reason) {
    throw new AppError('setId, status, and reason are required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  await manualOverrideModeration(adminId, setId, status, reason);

  // Send Notification
  const set = await VocabularySet.findById(setId);
  if (set) {
    const title = status === 'approved' ? 'Bộ từ vựng đã được duyệt' : 'Bộ từ vựng bị từ chối';
    const message = status === 'approved'
      ? `Bộ từ vựng "${set.name}" của bạn đã được duyệt và đăng công khai.`
      : `Bộ từ vựng "${set.name}" bị từ chối công khai. Lý do: ${reason}`;
    const userNotification = await Notification.create({
      userId: set.userId,
      type: 'vocab_moderation',
      title,
      message,
      isRead: false,
      data: {
        setId: set._id.toString()
      }
    });

    // Emit socket notification to vocab owner
    try {
      const { emitToUser } = require('../config/socket');
      emitToUser(set.userId.toString(), 'new_notification', {
        _id: userNotification._id.toString(),
        type: 'vocab_moderation',
        title,
        message,
        data: {
          setId: set._id.toString()
        }
      });
    } catch (err) {
      console.error('Failed to emit manual vocab moderation socket notification:', err);
    }
  }

  return sendSuccess(res, `Set moderation status updated to ${status} successfully`);
});

export const runAutoModerationController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  console.log(`[Admin] Manual moderation run triggered by admin ${adminId}`);
  
  const stats = await runAutoModerationBatch(adminId);
  const postStats = await runAutoModerationPostsBatch(adminId);
  
  return sendSuccess(res, 'Auto-moderation batch run completed successfully', {
    sets: stats,
    posts: postStats
  });
});

export const getPendingModerationPostsController = catchAsync(async (_req: Request, res: Response) => {
  const pendingPosts = await Post.find({
    isPublic: true,
    moderationStatus: 'pending'
  }).populate('author', 'name email avatar').sort({ createdAt: -1 }).lean();

  return sendSuccess(res, 'Pending posts fetched successfully', pendingPosts);
});

export const overridePostModerationController = catchAsync(async (req: Request, res: Response) => {
  const adminId = (req.user?._id as any)?.toString();
  const { postId, status, reason } = req.body;

  if (!postId || !status) {
    throw new AppError('postId and status are required', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED);
  }

  const post = await Post.findById(postId);
  if (!post) {
    throw new AppError('Post not found', HttpStatus.NOT_FOUND);
  }

  const oldStatus = post.moderationStatus;
  const oldReason = post.moderationReason;

  post.moderationStatus = status;
  post.moderationReason = reason || '';
  await post.save();

  // Create system notification for the user
  const title = status === 'approved' ? 'Bài viết cộng đồng đã được duyệt' : 'Bài viết cộng đồng bị từ chối';
  const message = status === 'approved'
    ? `Bài viết "${post.title}" của bạn đã được duyệt và đăng công khai.`
    : `Bài viết "${post.title}" bị từ chối công khai. Lý do: ${reason || 'Không có lý do cụ thể'}`;

  const userNotification = await Notification.create({
    userId: post.author,
    type: 'post_moderation',
    title,
    message,
    isRead: false,
    data: {
      postId: post._id.toString()
    }
  });

  // Emit socket notification to post author
  try {
    const { emitToUser } = require('../config/socket');
    emitToUser(post.author.toString(), 'new_notification', {
      _id: userNotification._id.toString(),
      type: 'post_moderation',
      title,
      message,
      data: {
        postId: post._id.toString()
      }
    });
  } catch (err) {
    console.error('Failed to emit manual post moderation socket notification:', err);
  }

  // Create audit log
  await AdminAuditLog.create({
    adminId: new mongoose.Types.ObjectId(adminId),
    action: status === 'approved' ? 'approve_post' : 'reject_post',
    targetId: post._id,
    targetType: 'post' as any,
    reason: reason || '',
    before: { moderationStatus: oldStatus, moderationReason: oldReason },
    after: { moderationStatus: status, moderationReason: reason || '' }
  });

  return sendSuccess(res, `Post moderation status updated to ${status} successfully`);
});
export const listAllPostsController = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const tab = req.query.tab as string || 'published';
  const adminId = req.user!.id;
  const q = req.query.q as string || undefined;
  const category = req.query.category as string || undefined;
  const sort = req.query.sort as string || 'newest';
  const status = req.query.status as string || undefined;

  let filter: any = {};
  if (tab === 'published') {
    filter = { isPublic: true, moderationStatus: 'approved' };
  } else if (tab === 'drafts') {
    filter = { author: adminId, isPublic: false };
  } else if (tab === 'pending') {
    filter = { isPublic: true, moderationStatus: 'pending' };
  } else if (tab === 'moderated') {
    filter = { isPublic: true, moderationStatus: { $in: ['approved', 'rejected'] } };
  } else {
    filter = {};
  }

  // If status parameter is set, let it override the basic published tab filters
  if (tab === 'published' && status) {
    if (status === 'approved') {
      filter = { isPublic: true, moderationStatus: 'approved' };
    } else if (status === 'pending') {
      filter = { isPublic: true, moderationStatus: 'pending' };
    } else if (status === 'rejected') {
      filter = { isPublic: true, moderationStatus: 'rejected' };
    } else if (status === 'private') {
      filter = { isPublic: false };
    } else if (status === 'all') {
      filter = {};
    }
  }

  let sortOption: any = { createdAt: -1 };
  if (sort === 'oldest') {
    sortOption = { createdAt: 1 };
  } else if (sort === 'alphabetical') {
    sortOption = { title: 1 };
  }

  if (category) {
    filter.category = category;
  }

  if (q) {
    const cleanQ = q.trim();
    if (cleanQ) {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: cleanQ, $options: 'i' } },
          { email: { $regex: cleanQ, $options: 'i' } }
        ]
      }).select('_id').lean();
      const userIds = matchingUsers.map((u: any) => u._id);

      filter.$or = [
        { title: { $regex: cleanQ, $options: 'i' } },
        { content: { $regex: cleanQ, $options: 'i' } },
        { excerpt: { $regex: cleanQ, $options: 'i' } },
        { author: { $in: userIds } }
      ];
    }
  }

  const [posts, total] = await Promise.all([
    Post.find(filter).populate('author', 'name email avatar').sort(sortOption).skip(skip).limit(limit).lean(),
    Post.countDocuments(filter)
  ]);

  return sendSuccess(res, 'Posts fetched successfully for admin', posts, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  });
});

export const resetUserAuthController = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const { id: targetUserId } = req.params;
  const { email: newEmail } = req.body;

  await adminService.resetUserAuth(adminId, targetUserId, newEmail);

  return sendSuccess(res, 'User credentials reset successfully and temporary password email sent');
});

// ─── System Health Check ───────────────────────────────────────────────────────

export const getSystemHealthController = catchAsync(async (_req: Request, res: Response) => {
  // 1. MongoDB: check if mongoose connection is open (readyState 1 = connected)
  const mongoOk = mongoose.connection.readyState === 1;

  // 2. Redis: use the shared health flag from redis.ts
  const redisOk = isRedisAvailable();

  // 3. Gemini: just check if the key is configured (no actual API call to save quota)
  const geminiOk = !!process.env.GEMINI_API_KEY;

  // 4. Mailer / Cloudinary: read from system config
  const config = await getOrCreateSystemConfig();

  return sendSuccess(res, 'System health fetched', {
    mongodb: mongoOk,
    redis: redisOk,
    gemini: geminiOk,
    mailer: config.mailerActive,
    cloudinary: config.cloudinaryActive,
    redisConfigured: !!process.env.REDIS_URL,
  });
});

