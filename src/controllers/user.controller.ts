import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response.util';
import { getUserById, updateUserProfile, requestEmailChange, confirmEmailChange, getLearningProfile, updateLearningProfile } from '../services/user.service';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';
import { catchAsync } from '../utils/catchAsync';

/**
 * @swagger
 * /api/v1/user/profile:
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
export const getProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();

  if (!userId) {
    throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const profile = await getUserById(userId);
  return sendSuccess(res, 'Profile fetched successfully', profile);
});

/**
 * @swagger
 * /api/v1/user/profile:
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
 *               avatar:
 *                 type: string
 *                 format: uri
 *                 description: URL to avatar image
 *     description: Email cannot be changed via this endpoint. To change email use `/user/request-email-change` and `/user/confirm-email-change`.
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       401:
 *         description: Chưa đăng nhập
 */
export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();

  if (!userId) {
    throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  const profile = await updateUserProfile(userId, req.body);
  return sendSuccess(res, 'Profile updated successfully', profile);
});

/**
 * @swagger
 * /api/v1/user/request-email-change:
 *   post:
 *     tags: [User]
 *     summary: Yêu cầu thay đổi email (gửi OTP tới email mới)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newEmail]
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP đã được gửi tới email mới
 *       400:
 *         description: Email đã có người sử dụng
 */
export const requestEmailChangeController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);

  const { newEmail } = req.body as { newEmail: string };
  const result = await requestEmailChange(userId, newEmail);
  return sendSuccess(res, result.message);
});

/**
 * @swagger
 * /api/v1/user/confirm-email-change:
 *   post:
 *     tags: [User]
 *     summary: Xác nhận thay đổi email bằng OTP
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newEmail, otp]
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Email được cập nhật thành công
 *       400:
 *         description: OTP không hợp lệ hoặc email đã tồn tại
 */
export const confirmEmailChangeController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  if (!userId) throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);

  const { newEmail, otp } = req.body as { newEmail: string; otp: string };
  const result = await confirmEmailChange(userId, newEmail, otp);
  return sendSuccess(res, result.message);
});

/**
 * GET /api/v1/user/learning-profile
 * Lấy learning profile (mục tiêu học tập, cài đặt ôn tập)
 */
export const getLearningProfileController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id || req.user?._id?.toString();
  if (!userId) {
    throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const profile = await getLearningProfile(userId);
  return sendSuccess(res, 'Learning profile fetched successfully', profile);
});

/**
 * PUT /api/v1/user/learning-profile
 * Cập nhật learning profile
 */
export const updateLearningProfileController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id || req.user?._id?.toString();
  if (!userId) {
    throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }
  const profile = await updateLearningProfile(userId, req.body);
  return sendSuccess(res, 'Learning profile updated successfully', profile);
});

