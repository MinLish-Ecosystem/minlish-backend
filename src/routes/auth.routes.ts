import { Router } from 'express';
import { login, register, refreshToken, logout, verifyEmail } from '../controllers/auth.controller';
import { forgotPassword, resetPassword } from '../controllers/password.controller';
import {
  loginSchema,
  registerSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.schema';
import { validateZod } from '../middlewares/validate.middleware';
import { verifyToken } from '../middlewares/auth.middleware';
import { authLimiter } from '../middlewares/rateLimiter';

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Xác thực người dùng (Login, Register, Token)
 *   - name: Auth - Password
 *     description: Quản lý mật khẩu (Forgot, Reset)
 */

const router = Router();

// ─── Public Routes ────────────────────────────────────────────────────────────
// POST /api/v1/auth/register
router.post('/register', authLimiter, validateZod(registerSchema), register);

// POST /api/v1/auth/verify-email
router.post('/verify-email', authLimiter, validateZod(verifyEmailSchema), verifyEmail);

// POST /api/v1/auth/login
router.post('/login', authLimiter, validateZod(loginSchema), login);

// POST /api/v1/auth/refresh-token
router.post('/refresh-token', refreshToken);

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', authLimiter, validateZod(forgotPasswordSchema), forgotPassword);

// POST /api/v1/auth/reset-password
router.post('/reset-password', authLimiter, validateZod(resetPasswordSchema), resetPassword);

// ─── Protected Routes (cần đăng nhập) ────────────────────────────────────────
// POST /api/v1/auth/logout
router.post('/logout', verifyToken, logout);

export default router;
