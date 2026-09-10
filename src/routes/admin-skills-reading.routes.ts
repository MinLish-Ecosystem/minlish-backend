import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import { generalLimiter } from '../middlewares/rateLimiter';
import { HttpStatus } from '../constants/httpStatus';
import {
  adminReadingListQuerySchema,
  readingAdminQuestionSchema,
  readingAdminQuestionUpdateSchema,
  readingQuestionIdParamSchema,
} from '../validators/reading.schema';
import {
  adminCreateQuestionController,
  adminListQuestionsController,
  adminSoftDeleteQuestionController,
  adminUpdateQuestionController,
} from '../controllers/reading.admin.controller';

/**
 * @swagger
 * tags:
 *   - name: Admin - Reading
 *     description: UC-14 — Quản lý ngân hàng câu hỏi Reading (Admin CRUD thủ công)
 */

const router = Router();

// Toàn bộ route yêu cầu Bearer token + role admin (api-spec UC-14 §Common)
router.use(verifyToken, requireAdmin, generalLimiter);

/**
 * @swagger
 * /api/v1/admin/skills/reading/questions:
 *   get:
 *     tags: [Admin - Reading]
 *     summary: Danh sách câu hỏi Reading (phân trang + filter type/level)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50, default: 20 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [short-sentence-mcq, main-idea-mcq, word-bank-fill] }
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [A1, A2, B1, B2, C1, C2] }
 *     responses:
 *       200:
 *         description: "{ questions, total, page, limit, totalPages }"
 *       403: { description: ERR_FORBIDDEN — không phải admin }
 */
router.get('/questions', validateZod(adminReadingListQuerySchema, HttpStatus.BAD_REQUEST), adminListQuestionsController);

/**
 * @swagger
 * /api/v1/admin/skills/reading/questions:
 *   post:
 *     tags: [Admin - Reading]
 *     summary: Tạo câu hỏi Reading (discriminated union theo type)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201: { description: Câu hỏi đã tạo }
 *       400: { description: ERR_VALIDATION_FAILED }
 */
router.post('/questions', validateZod(readingAdminQuestionSchema, HttpStatus.BAD_REQUEST), adminCreateQuestionController);

/**
 * @swagger
 * /api/v1/admin/skills/reading/questions/{id}:
 *   put:
 *     tags: [Admin - Reading]
 *     summary: Cập nhật câu hỏi Reading (type immutable, merge rồi validate toàn bộ)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Câu hỏi đã cập nhật }
 *       400: { description: ERR_VALIDATION_FAILED }
 *       404: { description: ERR_QUESTION_NOT_FOUND }
 */
router.put(
  '/questions/:id',
  validateZod(readingAdminQuestionUpdateSchema, HttpStatus.BAD_REQUEST),
  validateZod(readingQuestionIdParamSchema, HttpStatus.BAD_REQUEST),
  adminUpdateQuestionController,
);

/**
 * @swagger
 * /api/v1/admin/skills/reading/questions/{id}:
 *   delete:
 *     tags: [Admin - Reading]
 *     summary: Soft delete câu hỏi Reading
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Câu hỏi đã soft delete }
 *       404: { description: ERR_QUESTION_NOT_FOUND }
 */
router.delete(
  '/questions/:id',
  validateZod(readingQuestionIdParamSchema, HttpStatus.BAD_REQUEST),
  adminSoftDeleteQuestionController,
);

export default router;
