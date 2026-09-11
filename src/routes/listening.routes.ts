import { Router } from 'express';
import { verifyToken, requireAdmin, requireActiveVerified } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import {
  getListeningSessionQuerySchema,
  getListeningAudioSchema,
  submitListeningSchema,
  adminListQuestionsQuerySchema,
  adminQuestionIdParamSchema,
  adminCreateQuestionSchema,
  adminUpdateQuestionSchema,
} from '../validators/listening.schema';
import {
  getSessionController,
  getAudioController,
  submitSessionController,
  adminListQuestionsController,
  adminCreateQuestionController,
  adminUpdateQuestionController,
  adminDeleteQuestionController,
} from '../controllers/listening.controller';

/**
 * UC-15 Listening Practice routes (FR-111).
 *
 * Learner — base `/api/v1/skills/listening` (verifyToken + gate verified/active):
 *   GET  /session · POST /audio · POST /submit
 * Admin — base `/api/v1/admin/skills/listening` (verifyToken + requireAdmin):
 *   GET/POST /questions · PUT/DELETE /questions/:questionId
 *
 * Middleware stack: verifyToken (AD-4) → [gate|authorize] → validateZod (AD-7) → controller.
 */

/**
 * @swagger
 * tags:
 *   - name: Listening
 *     description: UC-15 — Luyện nghe với 3 dạng câu, feedback từng câu và ghi kết quả theo lô
 */

const learnerRouter = Router();

// Gate email verified + tài khoản active cho toàn bộ endpoint learner (AC-13).
learnerRouter.use(verifyToken, requireActiveVerified);

/**
 * @swagger
 * /api/v1/skills/listening/session:
 *   get:
 *     summary: Lấy phiên đề Listening (10-20 câu, random theo level)
 *     tags: [Listening]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: count
 *         schema: { type: integer, minimum: 10, maximum: 20 }
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [A1, A2, B1, B2, C1, C2] }
 *     responses:
 *       200: { description: "Danh sách câu hỏi (không kèm transcript/đáp án)" }
 *       401: { description: Token thiếu/hết hạn }
 *       403: { description: Chưa verify email / tài khoản bị khóa }
 *       404: { description: ERR_NO_QUESTIONS_AVAILABLE }
 */
learnerRouter.get('/session', validateZod(getListeningSessionQuerySchema), getSessionController);

/**
 * @swagger
 * /api/v1/skills/listening/audio:
 *   post:
 *     summary: Lấy text nguồn để client TTS on-device (transcript)
 *     tags: [Listening]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionId]
 *             properties:
 *               questionId: { type: string }
 *     responses:
 *       200: { description: "{text} - nguồn TTS cho client" }
 *       404: { description: ERR_QUESTION_NOT_FOUND }
 */
learnerRouter.post('/audio', validateZod(getListeningAudioSchema), getAudioController);

/**
 * @swagger
 * /api/v1/skills/listening/submit:
 *   post:
 *     summary: Nộp kết quả phiên (chấm lại theo DB, ghi lô 1 lần khi Finish)
 *     tags: [Listening]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [results, startedAt, completedAt]
 *             properties:
 *               results:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [questionId, selectedAnswer, durationMs]
 *                   properties:
 *                     questionId: { type: string }
 *                     selectedAnswer: {}
 *                     durationMs: { type: integer, minimum: 0 }
 *               startedAt: { type: string, format: date-time }
 *               completedAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: "{groupId, correctCount, totalQuestions, accuracy}" }
 *       400: { description: ERR_VALIDATION_FAILED }
 */
learnerRouter.post('/submit', validateZod(submitListeningSchema), submitSessionController);

export const listeningAdminRouter = Router();

// Toàn bộ admin endpoint yêu cầu role=admin (CAP-6, API-04).
listeningAdminRouter.use(verifyToken, requireAdmin);

listeningAdminRouter.get(
  '/questions',
  validateZod(adminListQuestionsQuerySchema),
  adminListQuestionsController,
);

listeningAdminRouter.post(
  '/questions',
  validateZod(adminCreateQuestionSchema),
  adminCreateQuestionController,
);

listeningAdminRouter.put(
  '/questions/:questionId',
  validateZod(adminUpdateQuestionSchema),
  adminUpdateQuestionController,
);

listeningAdminRouter.delete(
  '/questions/:questionId',
  validateZod(adminQuestionIdParamSchema),
  adminDeleteQuestionController,
);

export default learnerRouter;
