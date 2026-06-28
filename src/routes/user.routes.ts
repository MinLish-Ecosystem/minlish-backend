import { Router } from 'express';
import { getProfile, updateProfile, requestEmailChangeController, confirmEmailChangeController, getLearningProfileController, updateLearningProfileController, changePassword, verifyChangePassword } from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { updateProfileSchema, requestEmailChangeSchema, confirmEmailChangeSchema, updateLearningProfileSchema, changePasswordSchema, verifyChangePasswordSchema } from '../validators/user.schema';
import { validateZod } from '../middlewares/validate.middleware';

/**
 * @swagger
 * tags:
 *   - name: User
 *     description: Quản lý thông tin cá nhân và cài đặt học tập (yêu cầu đăng nhập)
 */

const router = Router();

/**
 * @swagger
 * /api/v1/user/profile:
 *   get:
 *     summary: Lấy thông tin profile của user hiện tại
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin profile user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string, example: "Nguyen Van A" }
 *                     email: { type: string, example: "user@example.com" }
 *                     role: { type: string, example: "user" }
 *                     avatar: { type: string, nullable: true }
 *                     isVerified: { type: boolean }
 *                     createdAt: { type: string, format: date-time }
 *       401:
 *         description: Chưa đăng nhập
 */
router.get('/profile', verifyToken, getProfile);

/**
 * @swagger
 * /api/v1/user/profile:
 *   put:
 *     summary: Cập nhật thông tin profile (name, avatar)
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Nguyen Van B"
 *               avatar:
 *                 type: string
 *                 nullable: true
 *                 example: "https://example.com/avatar.jpg"
 *     responses:
 *       200:
 *         description: Profile đã được cập nhật
 *       401:
 *         description: Chưa đăng nhập
 */
router.put('/profile', verifyToken, validateZod(updateProfileSchema), updateProfile);

/**
 * @swagger
 * /api/v1/user/request-email-change:
 *   post:
 *     summary: Yêu cầu đổi địa chỉ email (gửi OTP tới email mới)
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newEmail
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *                 example: "newemail@example.com"
 *     responses:
 *       200:
 *         description: OTP đã được gửi tới email mới
 *       400:
 *         description: Email đã tồn tại trong hệ thống
 *       401:
 *         description: Chưa đăng nhập
 */
router.post('/request-email-change', verifyToken, validateZod(requestEmailChangeSchema), requestEmailChangeController);

/**
 * @swagger
 * /api/v1/user/confirm-email-change:
 *   post:
 *     summary: Xác nhận đổi email bằng OTP đã nhận
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newEmail
 *               - otp
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *                 example: "newemail@example.com"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email đã được đổi thành công
 *       400:
 *         description: OTP không hợp lệ hoặc email đã tồn tại
 *       410:
 *         description: OTP đã hết hạn
 */
router.post('/confirm-email-change', verifyToken, validateZod(confirmEmailChangeSchema), confirmEmailChangeController);

/**
 * @swagger
 * /api/v1/user/learning-profile:
 *   get:
 *     summary: Lấy cài đặt học tập của user (Learning Profile)
 *     description: Trả về mục tiêu học tập, số từ mới mỗi ngày, trình độ, timezone...
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Learning profile của user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     learningGoal: { type: string, example: "ielts" }
 *                     targetLevel: { type: string, example: "B2" }
 *                     currentLevel: { type: string, example: "beginner" }
 *                     dailyGoal: { type: number, example: 10, description: "Số từ mới mỗi ngày" }
 *                     reviewPerDay: { type: number, example: 20, description: "Số từ ôn tập tối đa mỗi ngày" }
 *                     reminderTime: { type: string, example: "20:00" }
 *                     timezone: { type: string, example: "Asia/Ho_Chi_Minh" }
 *                     preferences:
 *                       type: object
 *                       properties:
 *                         pushNotification: { type: boolean }
 *                         soundEffect: { type: boolean }
 *       401:
 *         description: Chưa đăng nhập
 *       404:
 *         description: Chưa có learning profile
 */
router.get('/learning-profile', verifyToken, getLearningProfileController);

/**
 * @swagger
 * /api/v1/user/learning-profile:
 *   put:
 *     summary: Cập nhật cài đặt học tập (Learning Profile)
 *     description: Cập nhật một hoặc nhiều trường — dùng upsert nếu chưa tồn tại
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               learningGoal:
 *                 type: string
 *                 enum: [ielts, toeic, business, travel, general, other]
 *               targetLevel:
 *                 type: string
 *                 enum: [A1, A2, B1, B2, C1, C2]
 *               dailyGoal:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 example: 15
 *               reviewPerDay:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 200
 *                 example: 30
 *               reminderTime:
 *                 type: string
 *                 example: "20:00"
 *               timezone:
 *                 type: string
 *                 example: "Asia/Ho_Chi_Minh"
 *               preferences:
 *                 type: object
 *                 properties:
 *                   pushNotification: { type: boolean }
 *                   soundEffect: { type: boolean }
 *     responses:
 *       200:
 *         description: Learning profile đã được cập nhật
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 */
router.put('/learning-profile', verifyToken, validateZod(updateLearningProfileSchema), updateLearningProfileController);

router.post('/change-password', verifyToken, validateZod(changePasswordSchema), changePassword);
router.post('/change-password/verify', verifyToken, validateZod(verifyChangePasswordSchema), verifyChangePassword);

export default router;
