import { Router } from 'express';
import { Request, Response } from 'express';
import { verifyToken, requireAdmin } from '../middlewares/auth.middleware';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { UserReport } from '../models/UserReport';
import { Notification } from '../models/Nofitication';
import { User } from '../models/User';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Reports
 *     description: Quản lý báo cáo từ người dùng (support/bug reports)
 */

/**
 * @swagger
 * /api/v1/reports:
 *   post:
 *     summary: Gửi báo cáo hỗ trợ/lỗi mới (User)
 *     tags: [Reports]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category, subject, message]
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [bug, vocab, community, learning, billing, other]
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Báo cáo đã gửi thành công
 *       400:
 *         description: Thiếu thông số đầu vào
 *       429:
 *         description: Quá giới hạn 3 reports/24h
 */
router.post('/', verifyToken, catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as any)?.toString();
  const { category, subject, message } = req.body;

  if (!category || !subject?.trim() || !message?.trim()) {
    throw new AppError('category, subject, and message are required', HttpStatus.BAD_REQUEST);
  }

  // Rate limit check: max 3 reports per day per user
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentCount = await UserReport.countDocuments({ userId, createdAt: { $gte: since } });
  if (recentCount >= 3) {
    throw new AppError(
      'Bạn đã gửi quá 3 báo cáo trong 24 giờ qua. Vui lòng thử lại sau.',
      HttpStatus.TOO_MANY_REQUESTS
    );
  }

  const report = await UserReport.create({ userId, category, subject: subject.trim(), message: message.trim() });

  // Find admin users and notify all of them via report notification
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  const user = await User.findById(userId).select('name email').lean();
  const senderName = (user as any)?.name || 'User';
  const senderEmail = (user as any)?.email || '';

  if (admins.length > 0) {
    const notifications = admins.map((admin: any) => ({
      userId: admin._id,
      type: 'report',
      title: `📋 New Report: ${category}`,
      message: `${senderName} (${senderEmail}) sent: "${subject.trim().substring(0, 80)}${subject.trim().length > 80 ? '…' : ''}"`,
      isRead: false,
      data: { reportId: report._id.toString(), category, senderName, senderEmail, subject: subject.trim(), message: message.trim() },
    }));

    await Notification.insertMany(notifications);

    // Emit real-time socket event to admins
    try {
      const { emitToAdmins } = require('../config/socket');
      emitToAdmins('new_notification', {
        type: 'report',
        title: `📋 New Report: ${category}`,
        message: `${senderName} (${senderEmail}) sent: "${subject.trim().substring(0, 80)}${subject.trim().length > 80 ? '…' : ''}"`,
        data: { reportId: report._id.toString(), category, senderName, senderEmail, subject: subject.trim(), message: message.trim() }
      });
    } catch (err) {
      console.error('Socket.IO emit error:', err);
    }
  }

  return sendSuccess(res, 'Report submitted successfully. Thank you!', { reportId: report._id }, 201);
}));

/**
 * @swagger
 * /api/v1/reports:
 *   get:
 *     summary: Lấy danh sách toàn bộ báo cáo của user (Admin only)
 *     tags: [Reports]
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
 *       - in: query
 *         name: unread
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Chỉ lấy báo cáo chưa đọc
 *     responses:
 *       200:
 *         description: Danh sách báo cáo
 */
router.get('/', verifyToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const skip = (page - 1) * limit;
  const unreadOnly = req.query.unread === 'true';

  const filter = unreadOnly ? { isRead: false } : {};
  const [reports, total] = await Promise.all([
    UserReport.find(filter)
      .populate('userId', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    UserReport.countDocuments(filter),
  ]);

  return sendSuccess(res, 'Reports fetched', reports, 200, {
    page, limit, total, totalPages: Math.ceil(total / limit)
  });
}));

/**
 * @swagger
 * /api/v1/reports/{id}/read:
 *   put:
 *     summary: Đánh dấu báo cáo đã đọc (Admin only)
 *     tags: [Reports]
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
 *         description: Thành công
 */
router.put('/:id/read', verifyToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  await UserReport.findByIdAndUpdate(req.params.id, { $set: { isRead: true } });
  return sendSuccess(res, 'Report marked as read', null);
}));

export default router;
