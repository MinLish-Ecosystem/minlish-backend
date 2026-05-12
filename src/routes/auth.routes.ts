import { Router } from 'express';
import { login, register, refreshToken, logout, verifyEmail } from '../controllers/auth.controller';
import { forgotPassword, resetPassword } from '../controllers/password.controller';
import { loginValidator, registerValidator, verifyEmailValidator } from '../validators/auth.validator';
import { validate } from '../middlewares/validate.middleware';
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
// POST /api/auth/register
router.post('/register', authLimiter, registerValidator, validate, register);

// POST /api/auth/verify-email
router.post('/verify-email', authLimiter, verifyEmailValidator, validate, verifyEmail);

// POST /api/auth/login
router.post('/login', authLimiter, loginValidator, validate, login);

// POST /api/auth/refresh-token
router.post('/refresh-token', refreshToken);

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, forgotPassword);

// POST /api/auth/reset-password
router.post('/reset-password', resetPassword);

// ─── Protected Routes (cần đăng nhập) ────────────────────────────────────────
// POST /api/auth/logout
router.post('/logout', verifyToken, logout);

export default router;
