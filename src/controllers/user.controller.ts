// ─────────────────────────────────────────────────────────────────────────────
// User Controller — Nhàn phụ trách
// ─────────────────────────────────────────────────────────────────────────────
import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../utils/response.util';

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     tags: [User]
 *     summary: Lấy thông tin profile của người dùng hiện tại
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Thông tin profile
 *       401:
 *         description: Chưa đăng nhập
 */
export const getProfile = async (
  req: Request,
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
 * /api/user/profile:
 *   put:
 *     tags: [User]
 *     summary: Cập nhật thông tin profile
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
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       401:
 *         description: Chưa đăng nhập
 */
export const updateProfile = async (
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
