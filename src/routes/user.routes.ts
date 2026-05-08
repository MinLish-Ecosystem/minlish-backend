import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { updateProfileValidator } from '../validators/user.validator';
import { validate } from '../middlewares/validate.middleware';

/**
 * @swagger
 * tags:
 *   - name: User
 *     description: Quản lý thông tin cá nhân (yêu cầu đăng nhập)
 */

const router = Router();

// Tất cả routes trong file này đều yêu cầu đăng nhập
// verifyToken được áp dụng cho từng route để rõ ràng

// GET /api/user/profile
router.get('/profile', verifyToken, getProfile);

// PUT /api/user/profile
router.put('/profile', verifyToken, updateProfileValidator, validate, updateProfile);

export default router;
