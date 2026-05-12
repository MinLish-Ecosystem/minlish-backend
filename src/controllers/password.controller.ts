// ─────────────────────────────────────────────────────────────────────────────
// Password Controller — Nhàn phụ trách
// ─────────────────────────────────────────────────────────────────────────────
import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response.util';
import { requestPasswordReset, resetPasswordWithOTP } from '../services/auth.service';
import { HttpStatus } from '../constants/httpStatus';
import { catchAsync } from '../utils/catchAsync';

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     tags: [Auth - Password]
 *     summary: Yêu cầu đặt lại mật khẩu (gửi OTP qua email)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: OTP đã được gửi qua email
 */
export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await requestPasswordReset(req.body);
  sendSuccess(res, result.message, null, HttpStatus.OK);
});

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     tags: [Auth - Password]
 *     summary: Đặt lại mật khẩu bằng OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *                 example: "123456"
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đặt lại mật khẩu thành công
 *       400:
 *         description: OTP không hợp lệ hoặc đã hết hạn
 */
export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const result = await resetPasswordWithOTP(req.body);
  sendSuccess(res, result.message, null, HttpStatus.OK);
});
