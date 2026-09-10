import { Router } from 'express';
import { verifyToken, verifyLearner } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import { generalLimiter } from '../middlewares/rateLimiter';
import { HttpStatus } from '../constants/httpStatus';
import { readingSessionQuerySchema, readingSubmitSchema } from '../validators/reading.schema';
import {
  getReadingSessionController,
  submitReadingSessionController,
} from '../controllers/reading.controller';

/**
 * @swagger
 * tags:
 *   - name: Skills - Reading
 *     description: UC-14 Reading Practice — phiên đề + submit kết quả (Learner)
 */

const router = Router();

// Learner phải verified + active (api-spec UC-14 §Common); rate limit chung AD-6
router.use(verifyToken, verifyLearner, generalLimiter);

/**
 * @swagger
 * /api/v1/skills/reading/session:
 *   get:
 *     tags: [Skills - Reading]
 *     summary: Lấy phiên Reading tối đa 15 câu random (UC-14 / FR-110)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [A1, A2, B1, B2, C1, C2] }
 *     responses:
 *       200: { description: Phiên đề Reading, số câu = min(15, pool khả dụng) }
 *       403: { description: Chưa xác thực email hoặc tài khoản bị khóa }
 *       404: { description: ERR_NO_QUESTIONS_AVAILABLE — pool rỗng sau filter }
 */
router.get('/session', validateZod(readingSessionQuerySchema, HttpStatus.BAD_REQUEST), getReadingSessionController);

/**
 * @swagger
 * /api/v1/skills/reading/submit:
 *   post:
 *     tags: [Skills - Reading]
 *     summary: Nộp kết quả phiên Reading — ghi lô 1 lần khi Finish (UC-14 / FR-114)
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [groupId, results, startedAt, completedAt]
 *             properties:
 *               groupId: { type: string }
 *               startedAt: { type: string, format: date-time }
 *               completedAt: { type: string, format: date-time }
 *               results:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 15
 *                 items:
 *                   type: object
 *                   required: [questionId, selectedAnswer, timeSpent]
 *                   properties:
 *                     questionId: { type: string }
 *                     selectedAnswer: {}
 *                     timeSpent: { type: integer, minimum: 0 }
 *     responses:
 *       201: { description: Ghi lô thành công — trả summary server chấm lại }
 *       200: { description: Replay idempotent cùng groupId + fingerprint }
 *       400: { description: ERR_VALIDATION_FAILED }
 *       409: { description: ERR_SUBMIT_IN_PROGRESS / ERR_GROUP_ID_CONFLICT }
 *       500: { description: ERR_INTERNAL — ghi lô/cleanup thất bại }
 */
router.post('/submit', validateZod(readingSubmitSchema, HttpStatus.BAD_REQUEST), submitReadingSessionController);

export default router;
