import { Router } from 'express';
import { verifyToken, requireVerifiedUser } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import { writingGradeLimiter } from '../middlewares/rateLimiter';
import {
  writingQuestionsQuerySchema,
  writingGradeBodySchema,
  writingSubmitBodySchema,
  writingResultParamSchema,
} from '../validators/writing.schema';
import {
  getQuestionsController,
  gradeWritingController,
  submitBatchController,
  getResultController,
} from '../controllers/writing.controller';

/**
 * UC-17 Writing Practice routes (FR-113) — namespace /api/v1/skills/writing
 * (Phương án A, tách biệt /api/v1/practice của UC-05).
 * Mọi route private: verifyToken → requireVerifiedUser (chặn isVerified=false /
 * isActive=false — CON-04) → validateZod (CON-05).
 */

/**
 * @swagger
 * tags:
 *   - name: Writing Practice
 *     description: UC-17 — Luyện viết theo kỳ thi TOEIC/IELTS, chấm bằng AI Gemini
 */

const router = Router();

/**
 * @swagger
 * /api/v1/skills/writing/questions:
 *   get:
 *     summary: W1 — Lấy danh sách đề Writing theo examType (CAP-01)
 *     tags: [Writing Practice]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: examType
 *         required: true
 *         schema: { type: string, enum: [ielts, toeic] }
 *       - in: query
 *         name: taskType
 *         schema: { type: string, enum: [email, letter, essay, report, picture, sentence] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 5, maximum: 20 }
 *     responses:
 *       200:
 *         description: Danh sách đề (metadata only, đã loại đề user đã Hoàn thành)
 */
router.get(
  '/questions',
  verifyToken,
  requireVerifiedUser,
  validateZod(writingQuestionsQuerySchema),
  getQuestionsController,
);

/**
 * @swagger
 * /api/v1/skills/writing/grade:
 *   post:
 *     summary: W2 — Chấm 1 bài bằng Gemini (CAP-02) — stateless, KHÔNG ghi DB
 *     tags: [Writing Practice]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionId, userText]
 *             properties:
 *               questionId: { type: string }
 *               userText: { type: string, maxLength: 10000 }
 *     responses:
 *       200: { description: aiResult (band + feedback + correctedText) + durationMs }
 *       400: { description: VALIDATION_FAILED / WRITING_TOO_SHORT }
 *       404: { description: WRITING_QUESTION_NOT_FOUND }
 *       409: { description: WRITING_ALREADY_SUBMITTED }
 *       429: { description: RATE_LIMIT_EXCEEDED (10 req/phút + 20 lượt/ngày) }
 *       502: { description: AI_GRADING_FAILED }
 */
router.post(
  '/grade',
  verifyToken,
  requireVerifiedUser,
  writingGradeLimiter, // AF-06: 10 req/phút/user — quota ngày check trong service
  validateZod(writingGradeBodySchema),
  gradeWritingController,
);

/**
 * @swagger
 * /api/v1/skills/writing/submit:
 *   post:
 *     summary: W3 — Ghi lô khi Hoàn thành (CAP-03) — all-or-nothing transaction
 *     tags: [Writing Practice]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201: { description: "Lần đầu: {groupId, totalQuestions, correctCount}" }
 *       200: { description: "Retry y hệt: replay idempotent" }
 *       409: { description: ERR_SUBMIT_IN_PROGRESS / ERR_GROUP_ID_CONFLICT / WRITING_ALREADY_SUBMITTED }
 */
router.post(
  '/submit',
  verifyToken,
  requireVerifiedUser,
  validateZod(writingSubmitBodySchema),
  submitBatchController,
);

/**
 * @swagger
 * /api/v1/skills/writing/results/{resultId}:
 *   get:
 *     summary: W4 — Xem lại kết quả phiên (CAP-05) — chỉ chủ sở hữu
 *     tags: [Writing Practice]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resultId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: "{result, attempts[] — payload snapshot}" }
 *       403: { description: ERR_FORBIDDEN (không phải chủ sở hữu) }
 *       404: { description: ERR_RESULT_NOT_FOUND }
 */
router.get(
  '/results/:resultId',
  verifyToken,
  requireVerifiedUser,
  validateZod(writingResultParamSchema),
  getResultController,
);

export default router;
