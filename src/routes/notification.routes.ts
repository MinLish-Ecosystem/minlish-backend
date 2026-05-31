import { Router } from 'express';
import { query, param } from 'express-validator';
import { validate } from '../middlewares/validate.middleware';
import { verifyToken } from '../middlewares/auth.middleware';
import {
  getNotificationsController,
  getUnreadCountController,
  markReadController,
  markAllReadController,
  deleteNotificationController,
} from '../controllers/notification.controller';

/**
 * @swagger
 * tags:
 *   - name: Notifications
 *     description: Quản lý thông báo của người dùng
 */

const router = Router();

/**
 * @swagger
 * /api/v1/notifications:
 *   get:
 *     summary: Lấy danh sách thông báo của user (có phân trang)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Trang hiện tại
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Số thông báo mỗi trang
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [srs_reminder, achievement, system]
 *         description: Lọc theo loại thông báo
 *     responses:
 *       200:
 *         description: Danh sách thông báo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id: { type: string }
 *                           type: { type: string, example: "srs_reminder" }
 *                           title: { type: string, example: "Đã đến giờ ôn tập!" }
 *                           body: { type: string }
 *                           isRead: { type: boolean, example: false }
 *                           createdAt: { type: string, format: date-time }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page: { type: number }
 *                         limit: { type: number }
 *                         total: { type: number }
 *                         totalPages: { type: number }
 *                     unreadCount: { type: number, example: 3 }
 *       401:
 *         description: Chưa đăng nhập
 */
router.get(
  '/',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('type').optional().isString(),
  ],
  validate,
  getNotificationsController,
);

/**
 * @swagger
 * /api/v1/notifications/unread-count:
 *   get:
 *     summary: Lấy số lượng thông báo chưa đọc (Badge count)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Số thông báo chưa đọc
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     unreadCount: { type: number, example: 5 }
 *       401:
 *         description: Chưa đăng nhập
 */
router.get('/unread-count', verifyToken, getUnreadCountController);

/**
 * @swagger
 * /api/v1/notifications/read-all:
 *   put:
 *     summary: Đánh dấu tất cả thông báo là đã đọc
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Tất cả thông báo đã được đánh dấu đọc
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "All notifications marked as read" }
 *                 data: { type: object, nullable: true }
 *       401:
 *         description: Chưa đăng nhập
 */
router.put('/read-all', verifyToken, markAllReadController);

/**
 * @swagger
 * /api/v1/notifications/{id}/read:
 *   put:
 *     summary: Đánh dấu một thông báo là đã đọc
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thông báo
 *     responses:
 *       200:
 *         description: Thông báo đã được đánh dấu đọc
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Notification marked as read" }
 *                 data: { type: object, nullable: true }
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy thông báo
 */
router.put(
  '/:id/read',
  verifyToken,
  [param('id').isMongoId().withMessage('Invalid notification id')],
  validate,
  markReadController,
);

/**
 * @swagger
 * /api/v1/notifications/{id}:
 *   delete:
 *     summary: Xóa một thông báo (soft delete)
 *     tags: [Notifications]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của thông báo cần xóa
 *     responses:
 *       200:
 *         description: Thông báo đã được xóa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Notification deleted" }
 *                 data: { type: object, nullable: true }
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Không tìm thấy thông báo
 */
router.delete(
  '/:id',
  verifyToken,
  [param('id').isMongoId().withMessage('Invalid notification id')],
  validate,
  deleteNotificationController,
);

export default router;
