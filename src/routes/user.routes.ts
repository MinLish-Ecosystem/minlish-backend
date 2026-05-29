import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  requestEmailChangeController,
  confirmEmailChangeController,
  getLearningProfileController,
  updateLearningProfileController,
  registerFCMTokenController,
  deleteFCMTokenController,
} from '../controllers/user.controller';
import { verifyToken } from '../middlewares/auth.middleware';
import {
  updateProfileValidator,
  requestEmailChangeValidator,
  confirmEmailChangeValidator,
  learningProfileValidator,
  fcmTokenValidator,
} from '../validators/user.validator';
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

// GET /api/v1/user/profile
router.get('/profile', verifyToken, getProfile);

// PUT /api/v1/user/profile
router.put('/profile', verifyToken, updateProfileValidator, validate, updateProfile);

// POST /api/v1/user/request-email-change
router.post('/request-email-change', verifyToken, requestEmailChangeValidator, validate, requestEmailChangeController);

// POST /api/v1/user/confirm-email-change
router.post('/confirm-email-change', verifyToken, confirmEmailChangeValidator, validate, confirmEmailChangeController);

// ─── Phase 2-B: Learning Profile ────────────────────────────────────────────

// GET /api/v1/user/learning-profile
router.get('/learning-profile', verifyToken, getLearningProfileController);

// PUT /api/v1/user/learning-profile
router.put('/learning-profile', verifyToken, learningProfileValidator, validate, updateLearningProfileController);

// ─── Phase 5-B: FCM Token ───────────────────────────────────────────────────

// POST /api/v1/user/fcm-token
router.post('/fcm-token', verifyToken, fcmTokenValidator, validate, registerFCMTokenController);

// DELETE /api/v1/user/fcm-token
router.delete('/fcm-token', verifyToken, deleteFCMTokenController);

export default router;
