import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import { generalLimiter } from '../middlewares/rateLimiter';
import {
  listSpeakingSessionsSchema,
  speakingSessionParamsSchema,
  submitSpeakingSessionSchema,
  speakingResultParamsSchema,
} from '../validators/speaking.schema';
import {
  listSpeakingSessionsController,
  getSpeakingSessionController,
  submitSpeakingSessionController,
  getSpeakingResultController,
} from '../controllers/speaking.controller';

/**
 * UC-16 Speaking Practice — learner routes (FR-112..116)
 * Namespace Phương án A (OQ-4 đã chốt): /api/v1/skills/speaking/*
 * Mọi route yêu cầu Bearer JWT qua verifyToken (C-2); generalLimiter theo A-2.
 */

/**
 * @swagger
 * tags:
 *   - name: Speaking
 *     description: UC-16 — Luyện nói đọc mẫu & chấm rule-based (yêu cầu đăng nhập + verify email)
 */

const router = Router();

/**
 * @swagger
 * /api/v1/skills/speaking/sessions:
 *   get:
 *     summary: Liệt kê phiên luyện nói active (CAP-1, AC-01)
 *     tags: [Speaking]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: level, schema: { type: string, enum: [A1,A2,B1,B2,C1,C2] } }
 *       - { in: query, name: type, schema: { type: string, enum: [PRACTICE,EXAM] } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Danh sách phiên + pagination }
 *       401: { description: Token thiếu/sai/hết hạn }
 *       403: { description: Chưa verify email hoặc bị ban }
 */
router.get(
  '/sessions',
  verifyToken,
  generalLimiter,
  validateZod(listSpeakingSessionsSchema),
  listSpeakingSessionsController
);

/**
 * @swagger
 * /api/v1/skills/speaking/sessions/{sessionId}:
 *   get:
 *     summary: Chi tiết phiên ref-only + prompts đã lọc soft-delete (CAP-2, AC-02/08)
 *     tags: [Speaking]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: sessionId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Session items ref-only + prompts resolve }
 *       404: { description: ERR_SESSION_NOT_FOUND / ERR_NO_QUESTIONS_AVAILABLE }
 */
router.get(
  '/sessions/:sessionId',
  verifyToken,
  generalLimiter,
  validateZod(speakingSessionParamsSchema),
  getSpeakingSessionController
);

/**
 * @swagger
 * /api/v1/skills/speaking/sessions/{sessionId}/submit:
 *   post:
 *     summary: Nộp lô & chấm khi Finish — all-or-nothing + idempotent theo groupId (CAP-3/4/8)
 *     tags: [Speaking]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: sessionId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [groupId, answers, startedAt, completedAt]
 *             properties:
 *               groupId: { type: string, description: ObjectId FE-gen, giữ nguyên khi retry }
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     skillType: { type: string, enum: [SPEAKING] }
 *                     refId: { type: string }
 *                     transcript: { type: string }
 *                     durationMs: { type: integer }
 *               startedAt: { type: string, format: date-time }
 *               completedAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: Nộp lần đầu thành công }
 *       200: { description: Retry replay — cùng kết quả, không tạo lô mới }
 *       400: { description: VALIDATION_FAILED / ERR_TRANSCRIPT_EMPTY / ERR_TRANSCRIPT_TOO_SHORT }
 *       404: { description: ERR_SESSION_NOT_FOUND }
 *       409: { description: ERR_SUBMIT_IN_PROGRESS / ERR_GROUP_ID_CONFLICT }
 *       500: { description: ERR_SCORING_FAILED — không lưu gì }
 */
router.post(
  '/sessions/:sessionId/submit',
  verifyToken,
  generalLimiter,
  validateZod(submitSpeakingSessionSchema),
  submitSpeakingSessionController
);

/**
 * @swagger
 * /api/v1/skills/speaking/results/{resultId}:
 *   get:
 *     summary: Xem lại kết quả phiên — snapshot referenceText tại lúc chấm (CAP-5, AC-10/11)
 *     tags: [Speaking]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: resultId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Result + attempts với payload snapshot }
 *       403: { description: FORBIDDEN — result thuộc user khác }
 *       404: { description: ERR_RESULT_NOT_FOUND }
 */
router.get(
  '/results/:resultId',
  verifyToken,
  generalLimiter,
  validateZod(speakingResultParamsSchema),
  getSpeakingResultController
);

export default router;
