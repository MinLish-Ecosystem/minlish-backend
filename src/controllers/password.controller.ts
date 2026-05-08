// ─────────────────────────────────────────────────────────────────────────────
// Password Controller — Nhàn phụ trách
// ─────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response.util';

/**
 * @swagger
 * /api/auth/forgot-password:
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
export const forgotPassword = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {

  try {
    sendError(res, 'Not implemented yet', 501);
  } catch (error) {
    next(error);
  }
};

/**
 * @swagger
 * /api/auth/reset-password:
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
export const resetPassword = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {

  try {
    sendError(res, 'Not implemented yet', 501);
  } catch (error) {
    next(error);
  }
};
