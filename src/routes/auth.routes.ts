import { Router } from "express";
import {
  login,
  register,
  refreshToken,
  logout,
  verifyEmail,
  verifyMfa,
} from "../controllers/auth.controller";
import {
  forgotPassword,
  resetPassword,
} from "../controllers/password.controller";
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyMfaSchema,
} from '../validators/auth.schema';
import { validateZod } from '../middlewares/validate.middleware';
import { verifyToken } from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/rateLimiter';

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Xác thực người dùng (Đăng ký, Đăng nhập, Token)
 *   - name: Auth - Password
 *     description: Quản lý mật khẩu (Forgot Password, Reset Password)
 */

const router = Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     description: Tạo tài khoản và gửi OTP xác thực email. Sau khi đăng ký cần verify-email để kích hoạt.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Nguyen Van A"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "Password123"
 *     responses:
 *       201:
 *         description: Đăng ký thành công — OTP đã gửi tới email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Registration successful. Please verify your email." }
 *                 data: { type: object, nullable: true }
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       409:
 *         description: Email đã được đăng ký
 *       429:
 *         description: Gửi quá nhiều request — rate limit
 */
router.post('/register', authLimiter, validateZod(registerSchema), register);

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Xác thực email bằng OTP
 *     description: Nhập OTP nhận được qua email để kích hoạt tài khoản
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email đã được xác thực thành công
 *       400:
 *         description: OTP không hợp lệ
 *       410:
 *         description: OTP đã hết hạn
 *       429:
 *         description: Rate limit
 */
router.post('/verify-email', authLimiter, validateZod(verifyEmailSchema), verifyEmail);

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     description: Đăng nhập bằng email + password. Trả về accessToken (15 phút) và refreshToken (7 ngày).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 example: "Password123"
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string, example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 *                     refreshToken: { type: string, example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
 *                     user:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         name: { type: string }
 *                         email: { type: string }
 *                         role: { type: string }
 *       400:
 *         description: Email hoặc mật khẩu không đúng
 *       403:
 *         description: Tài khoản đã bị cấm
 *       429:
 *         description: Rate limit
 */
router.post('/login', authLimiter, validateZod(loginSchema), login);
router.post('/verify-mfa', validateZod(verifyMfaSchema), verifyMfa);

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Làm mới Access Token bằng Refresh Token
 *     description: Dùng refreshToken (còn hạn) để lấy accessToken mới. RefreshToken được rotate sau mỗi lần dùng.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Access + Refresh Token mới đã được cấp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string }
 *                     refreshToken: { type: string }
 *       401:
 *         description: Refresh token không hợp lệ hoặc đã hết hạn
 */
router.post("/refresh-token", refreshToken);

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Đăng xuất — thu hồi Access Token và Refresh Token
 *     description: Đưa accessToken vào blacklist, xóa refreshToken trong DB
 *     tags: [Auth]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       401:
 *         description: Chưa đăng nhập
 */
router.post("/logout", verifyToken, logout);

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Yêu cầu đặt lại mật khẩu (gửi OTP qua email)
 *     tags: [Auth - Password]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *     responses:
 *       200:
 *         description: OTP đã được gửi tới email (luôn trả 200 để tránh email enumeration)
 *       429:
 *         description: Rate limit
 */
router.post('/forgot-password', authLimiter, validateZod(forgotPasswordSchema), forgotPassword);

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Đặt lại mật khẩu mới bằng OTP
 *     tags: [Auth - Password]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "user@example.com"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "NewPassword123"
 *     responses:
 *       200:
 *         description: Mật khẩu đã được đặt lại thành công
 *       400:
 *         description: OTP không hợp lệ
 *       410:
 *         description: OTP đã hết hạn
 *       429:
 *         description: Rate limit
 */
router.post('/reset-password', authLimiter, validateZod(resetPasswordSchema), resetPassword);

export default router;
