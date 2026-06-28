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

// ─── POST /api/v1/reports — User submits a report ──────────────────────────
// Rate limit: 3 reports per 24h per user (persisted in DB, not IP-based)
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

  // Find admin users and notify all of them via system notification
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  const user = await User.findById(userId).select('name email').lean();
  const senderName = (user as any)?.name || 'Người dùng';

  if (admins.length > 0) {
    await Notification.insertMany(
      admins.map((admin: any) => ({
        userId: admin._id,
        type: 'system',
        title: `📋 Báo cáo mới: ${category}`,
        message: `${senderName} gửi: "${subject.trim().substring(0, 80)}${subject.trim().length > 80 ? '…' : ''}"`,
        isRead: false,
        data: { reportId: report._id.toString(), category },
      }))
    );
  }

  return sendSuccess(res, 'Báo cáo đã được gửi thành công. Cảm ơn bạn!', { reportId: report._id }, 201);
}));

// ─── GET /api/v1/reports — Admin gets all reports ──────────────────────────
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

// ─── PUT /api/v1/reports/:id/read — Admin marks a report as read ──────────
router.put('/:id/read', verifyToken, requireAdmin, catchAsync(async (req: Request, res: Response) => {
  await UserReport.findByIdAndUpdate(req.params.id, { $set: { isRead: true } });
  return sendSuccess(res, 'Report marked as read', null);
}));

export default router;
