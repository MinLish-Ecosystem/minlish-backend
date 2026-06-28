import { Request, Response } from 'express';
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
  const result = await adminService.listPublicSets(page, limit);
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
    await Notification.create({
      userId: set.userId,
      type: 'system',
      title,
      message,
      isRead: false,
    });
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

  post.moderationStatus = status;
  post.moderationReason = reason || '';
  await post.save();

  // Create system notification for the user
  const title = status === 'approved' ? 'Bài viết cộng đồng đã được duyệt' : 'Bài viết cộng đồng bị từ chối';
  const message = status === 'approved'
    ? `Bài viết "${post.title}" của bạn đã được duyệt và đăng công khai.`
    : `Bài viết "${post.title}" bị từ chối công khai. Lý do: ${reason || 'Không có lý do cụ thể'}`;

  await Notification.create({
    userId: post.author,
    type: 'system',
    title,
    message,
    isRead: false,
  });

  return sendSuccess(res, `Post moderation status updated to ${status} successfully`);
});

export const listAllPostsController = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const [posts, total] = await Promise.all([
    Post.find().populate('author', 'name email avatar').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Post.countDocuments()
  ]);

  return sendSuccess(res, 'All posts fetched successfully for admin', posts, 200, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
  });
});
