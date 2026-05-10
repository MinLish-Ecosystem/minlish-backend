import { Router } from 'express';
import { login, register, refreshToken, logout } from '../controllers/auth.controller';
import { forgotPassword, resetPassword } from '../controllers/password.controller';
<<<<<<< Updated upstream
import { loginValidator, registerValidator } from '../validators/auth.validator';
=======
import { loginValidator, registerValidator, verifyEmailValidator, forgotPasswordValidator, resetPasswordValidator } from '../validators/auth.validator';
>>>>>>> Stashed changes
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
// POST /api/v1/auth/register
router.post('/register', authLimiter, registerValidator, validate, register);

<<<<<<< Updated upstream
// POST /api/auth/login
=======
// POST /api/v1/auth/verify-email
router.post('/verify-email', authLimiter, verifyEmailValidator, validate, verifyEmail);

// POST /api/v1/auth/login
>>>>>>> Stashed changes
router.post('/login', authLimiter, loginValidator, validate, login);

// POST /api/v1/auth/refresh-token
router.post('/refresh-token', refreshToken);

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', authLimiter, forgotPasswordValidator, validate, forgotPassword);

// POST /api/v1/auth/reset-password
router.post('/reset-password', authLimiter, resetPasswordValidator, validate, resetPassword);

// ─── Protected Routes (cần đăng nhập) ────────────────────────────────────────
// POST /api/v1/auth/logout
router.post('/logout', verifyToken, logout);

export default router;
