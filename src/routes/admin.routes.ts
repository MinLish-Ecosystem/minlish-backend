import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import {
  banUserSchema,
  unpublishSetSchema,
  adminPaginationSchema,
  adminIdParamSchema,
} from '../validators/admin.schema';
import {
	listUsersController,
	getUserDetailController,
	banUserController,
	unbanUserController,
	deleteUserController,
	getAdminStatsController,
	listPublicSetsController,
	unpublishSetController,
	getReportsController,
	getAuditLogsController,
	getSystemConfigController,
	updateSystemConfigController,
	getPendingModerationSetsController,
	getModerationLogsController,
	overrideModerationController,
	runAutoModerationController,
} from '../controllers/admin.controller';

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Quản trị hệ thống — chỉ dành cho Admin (yêu cầu role=admin)
 */

const router = Router();

// Tất cả admin routes đều yêu cầu verifyToken + requireAdmin
router.use(verifyToken, requireAdmin);

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: Lấy danh sách tất cả người dùng (có phân trang)
 *     tags: [Admin]
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
 *         description: Danh sách users
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
 *                           name: { type: string }
 *                           email: { type: string }
 *                           role: { type: string, enum: [user, admin] }
 *                           isActive: { type: boolean }
 *                           isVerified: { type: boolean }
 *                           createdAt: { type: string, format: date-time }
 *                     pagination:
 *                       type: object
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Không có quyền Admin
 */
router.get('/users', validateZod(adminPaginationSchema), listUsersController);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   get:
 *     summary: Lấy chi tiết một người dùng theo ID
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId của user
 *     responses:
 *       200:
 *         description: Thông tin chi tiết user
 *       403:
 *         description: Không có quyền Admin
 *       404:
 *         description: Không tìm thấy user
 */
router.get('/users/:id', validateZod(adminIdParamSchema), getUserDetailController);

/**
 * @swagger
 * /api/v1/admin/users/{id}/ban:
 *   put:
 *     summary: Cấm tài khoản người dùng
 *     tags: [Admin]
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
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Vi phạm điều khoản sử dụng"
 *     responses:
 *       200:
 *         description: User đã bị cấm thành công
 *       400:
 *         description: User đã bị cấm trước đó
 *       403:
 *         description: Không thể cấm tài khoản Admin
 *       404:
 *         description: Không tìm thấy user
 */
router.put('/users/:id/ban', validateZod(banUserSchema), banUserController);

/**
 * @swagger
 * /api/v1/admin/users/{id}/unban:
 *   put:
 *     summary: Bỏ cấm tài khoản người dùng
 *     tags: [Admin]
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
 *         description: User đã được bỏ cấm
 *       400:
 *         description: User hiện không bị cấm
 *       404:
 *         description: Không tìm thấy user
 */
router.put('/users/:id/unban', validateZod(adminIdParamSchema), unbanUserController);

/**
 * @swagger
 * /api/v1/admin/users/{id}:
 *   delete:
 *     summary: Xóa vĩnh viễn tài khoản người dùng
 *     description: Hard delete user + xóa toàn bộ dữ liệu cá nhân (LearningProgress, DailyStats...). Soft delete các bộ từ để bảo toàn dữ liệu công khai.
 *     tags: [Admin]
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
 *         description: User đã bị xóa
 *       403:
 *         description: Không thể xóa tài khoản Admin
 *       404:
 *         description: Không tìm thấy user
 */
router.delete('/users/:id', validateZod(adminIdParamSchema), deleteUserController);

/**
 * @swagger
 * /api/v1/admin/stats:
 *   get:
 *     summary: Lấy thống kê tổng quan hệ thống
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê hệ thống
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalUsers: { type: number, example: 1200 }
 *                     activeUsers: { type: number, example: 1150 }
 *                     bannedUsers: { type: number, example: 50 }
 *                     totalSets: { type: number, example: 3400 }
 */
router.get('/stats', getAdminStatsController);
/**
 * @swagger
 * /api/v1/admin/sets:
 *   get:
 *     summary: Lấy danh sách tất cả bộ từ công khai (có phân trang)
 *     tags: [Admin]
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
 *         description: Danh sách bộ từ công khai
 */
router.get('/sets', validateZod(adminPaginationSchema), listPublicSetsController);

/**
 * @swagger
 * /api/v1/admin/sets/{id}/unpublish:
 *   put:
 *     summary: Hủy công khai một bộ từ vựng
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của bộ từ cần unpublish
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Nội dung vi phạm"
 *     responses:
 *       200:
 *         description: Bộ từ đã được chuyển về private
 *       400:
 *         description: Bộ từ đã là private
 *       404:
 *         description: Không tìm thấy bộ từ
 */
router.put('/sets/:id/unpublish', validateZod(unpublishSetSchema), unpublishSetController);

/**
 * @swagger
 * /api/v1/admin/reports:
 *   get:
 *     summary: Xuất báo cáo người dùng dạng CSV
 *     description: Trả về file CSV chứa thông tin tất cả users (id, name, email, role, isActive, totalSets...)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: File CSV báo cáo
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/reports', getReportsController);

/**
 * @swagger
 * /api/v1/admin/audit-logs:
 *   get:
 *     summary: Lấy lịch sử hành động quản trị (Audit Logs)
 *     description: Trả về tất cả các thao tác admin đã thực hiện (ban, unban, delete, unpublish...)
 *     tags: [Admin]
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
 *                           adminId: { type: string }
 *                           action: { type: string, example: "ban_user" }
 *                           targetId: { type: string }
 *                           targetType: { type: string, example: "user" }
 *                           reason: { type: string }
 *                           createdAt: { type: string, format: date-time }
 *                     pagination:
 *                       type: object
 */
router.get('/audit-logs', validateZod(adminPaginationSchema), getAuditLogsController);

// System Configuration
router.get('/config', getSystemConfigController);
router.put('/config', updateSystemConfigController);

// Moderation
router.get('/moderation/pending', getPendingModerationSetsController);
router.get('/moderation/logs', getModerationLogsController);
router.put('/moderation/override', overrideModerationController);
router.post('/moderation/run', runAutoModerationController);

export default router;
