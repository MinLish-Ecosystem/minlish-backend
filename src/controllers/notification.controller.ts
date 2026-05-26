import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import * as notifService from '../services/notification.service';

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: Lấy danh sách thông báo của tôi
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
 *         name: type
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Danh sách thông báo
 */
export const getNotificationsController = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as any)?.toString();
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const type = req.query.type as string | undefined;
  const result = await notifService.getNotifications(userId, page, limit, type);
  return sendSuccess(res, 'Notifications fetched', result);
});

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Đếm số thông báo chưa đọc
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Số thông báo chưa đọc
 */
export const getUnreadCountController = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as any)?.toString();
  const count = await notifService.getUnreadCount(userId);
  return sendSuccess(res, 'Unread count', { unreadCount: count });
});

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Đánh dấu một thông báo đã đọc
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
 *         description: Đã đánh dấu đã đọc
 */
export const markReadController = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as any)?.toString();
  const id = req.params.id;
  await notifService.markRead(userId, id);
  return sendSuccess(res, 'Notification marked read', null);
});

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   put:
 *     tags: [Notifications]
 *     summary: Đánh dấu tất cả thông báo đã đọc
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Đã đánh dấu tất cả đã đọc
 */
export const markAllReadController = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as any)?.toString();
  await notifService.markAllRead(userId);
  return sendSuccess(res, 'All notifications marked read', null);
});

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Xóa một thông báo
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
 *         description: Đã xóa thông báo
 */
export const deleteNotificationController = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as any)?.toString();
  const id = req.params.id;
  await notifService.deleteNotification(userId, id);
  return sendSuccess(res, 'Notification deleted', null);
});
