import { Router } from 'express';
import { getProfile, updateProfile, requestEmailChangeController, confirmEmailChangeController, getLearningProfileController, updateLearningProfileController } from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import { updateProfileSchema, requestEmailChangeSchema, confirmEmailChangeSchema, updateLearningProfileSchema } from '../validators/user.schema';
import { validateZod } from '../middlewares/validate.middleware';

/**
 * @swagger
 * tags:
 *   - name: User
 *     description: Quản lý thông tin cá nhân (yêu cầu đăng nhập)
 */

const router = Router();

// Tất cả routes trong file này đều yêu cầu đăng nhập
// verifyToken được áp dụng cho từng route để rõ ràng

// GET /api/v1/user/profile
router.get('/profile', verifyToken, getProfile);

// PUT /api/v1/user/profile
router.put('/profile', verifyToken, validateZod(updateProfileSchema), updateProfile);

// POST /api/v1/user/request-email-change
router.post('/request-email-change', verifyToken, validateZod(requestEmailChangeSchema), requestEmailChangeController);

// POST /api/v1/user/confirm-email-change
router.post('/confirm-email-change', verifyToken, validateZod(confirmEmailChangeSchema), confirmEmailChangeController);

// GET /api/v1/user/learning-profile
router.get('/learning-profile', verifyToken, getLearningProfileController);

// PUT /api/v1/user/learning-profile
router.put('/learning-profile', verifyToken, validateZod(updateLearningProfileSchema), updateLearningProfileController);

export default router;
