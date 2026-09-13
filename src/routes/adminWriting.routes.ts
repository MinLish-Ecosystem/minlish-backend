import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import {
  writingAdminQuestionSchema,
  writingAdminListQuerySchema,
  writingAdminIdParamSchema,
} from '../validators/writing.schema';
import {
  listQuestionsController,
  createQuestionController,
  updateQuestionController,
  deleteQuestionController,
} from '../controllers/adminWriting.controller';

/**
 * UC-17 Admin Writing routes (W5 — CAP-06) — namespace /api/v1/admin/skills/writing.
 * Chain: verifyToken → requireAdmin → validateZod. Manual CRUD, soft delete only.
 */

/**
 * @swagger
 * tags:
 *   - name: Admin Writing
 *     description: UC-17 — Quản lý ngân hàng đề Writing (admin only, manual CRUD)
 */

const router = Router();

// Toàn bộ route yêu cầu admin — áp dụng 1 lần cho cả router
router.use(verifyToken, requireAdmin);

/**
 * @swagger
 * /api/v1/admin/skills/writing/questions:
 *   get:
 *     summary: W5 — List đề Writing (pagination + filter examType/taskType)
 *     tags: [Admin Writing]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: "{questions, total, page, limit}" }
 *       403: { description: ERR_FORBIDDEN (non-admin) }
 */
router.get('/questions', validateZod(writingAdminListQuerySchema), listQuestionsController);

/**
 * @swagger
 * /api/v1/admin/skills/writing/questions:
 *   post:
 *     summary: W5 — Tạo đề Writing mới
 *     tags: [Admin Writing]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       201: { description: Đề đã tạo }
 *       400: { description: VALIDATION_FAILED }
 */
router.post('/questions', validateZod(writingAdminQuestionSchema), createQuestionController);

/**
 * @swagger
 * /api/v1/admin/skills/writing/questions/{id}:
 *   put:
 *     summary: W5 — Cập nhật đề (attempt cũ giữ snapshot — BR-08)
 *     tags: [Admin Writing]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: Đề đã cập nhật }
 *       404: { description: WRITING_QUESTION_NOT_FOUND }
 */
router.put(
  '/questions/:id',
  validateZod(writingAdminIdParamSchema),
  validateZod(writingAdminQuestionSchema),
  updateQuestionController,
);

/**
 * @swagger
 * /api/v1/admin/skills/writing/questions/{id}:
 *   delete:
 *     summary: W5 — Soft delete đề (isDeleted=true)
 *     tags: [Admin Writing]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200: { description: Đề đã soft-delete }
 *       404: { description: WRITING_QUESTION_NOT_FOUND }
 */
router.delete(
  '/questions/:id',
  validateZod(writingAdminIdParamSchema),
  deleteQuestionController,
);

export default router;
