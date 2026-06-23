import { Request, Response } from "express";
import {
  loginUser,
  registerUser,
  refreshTokenService,
  logoutUser,
  verifyEmailOTP,
} from "../services/auth.service";
import { sendSuccess } from "../utils/response.util";
import { catchAsync } from "../utils/catchAsync";
import { AppError } from "../utils/AppError";
import { HttpStatus } from "../constants/httpStatus";
import { ErrorCodes } from "../constants/errorCodes";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng nhập và nhận Access + Refresh Token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         description: Email hoặc mật khẩu không đúng
 *       422:
 *         description: Dữ liệu đầu vào không hợp lệ
 */
export const login = catchAsync(async (req: Request, res: Response) => {
  const result = await loginUser(req.body);
  sendSuccess(res, "Login successful", result);
});

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Lấy Access Token mới bằng Refresh Token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Trả về Access + Refresh Token mới
 *       401:
 *         description: Refresh Token không hợp lệ hoặc đã hết hạn
 */
export const refreshToken = catchAsync(async (req: Request, res: Response) => {
  const { refreshToken: token } = req.body;
  if (!token) {
    throw new AppError(
      "Refresh token is required",
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED,
    );
  }
  const result = await refreshTokenService(token);
  sendSuccess(res, "Token refreshed successfully", result);
});

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng xuất (xóa Refresh Token)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *       401:
 *         description: Chưa đăng nhập
 */
export const logout = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as any)?.toString();
  if (!userId) {
    throw new AppError(
      "Unauthorized",
      HttpStatus.UNAUTHORIZED,
      ErrorCodes.UNAUTHORIZED,
    );
  }

  // Lấy access token từ header
  const authHeader = req.headers.authorization;
  const accessToken =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : "";

  await logoutUser(userId, accessToken);
  sendSuccess(res, "Logged out successfully");
});

// ─────────────────────────────────────────────────────────────────────────────
// REGISTER CONTROLLER — Minh phụ trách
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Đăng ký tài khoản mới
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Nguyen Van A
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: Password123
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       409:
 *         description: Email đã tồn tại
 *       422:
 *         description: Dữ liệu đầu vào không hợp lệ
 */
export const register = catchAsync(async (req: Request, res: Response) => {
  const result = await registerUser(req.body);
  sendSuccess(res, "Registration successful", result, HttpStatus.CREATED);
});

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     tags: [Auth]
 *     summary: Xác thực email bằng OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               otp:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Xác thực thành công
 *       400:
 *         description: Mã OTP không hợp lệ hoặc đã hết hạn
 *       404:
 *         description: Không tìm thấy người dùng
 *       422:
 *         description: Dữ liệu đầu vào không hợp lệ
 */
export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const result = await verifyEmailOTP(email, otp);
  sendSuccess(res, result.message, null, HttpStatus.OK);
});
