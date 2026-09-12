import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import { generalLimiter } from '../middlewares/rateLimiter';
import {
  listSpeakingPromptsSchema,
  speakingPromptBodySchema,
  speakingPromptUpdateSchema,
  speakingPromptParamsSchema,
} from '../validators/speaking.schema';
import {
  listSpeakingPromptsController,
  createSpeakingPromptController,
  updateSpeakingPromptController,
  deleteSpeakingPromptController,
} from '../controllers/speaking.controller';

/**
 * UC-16 Speaking Practice — admin routes quản lý ngân hàng mẫu (FR-114, CAP-6).
 * Base: /api/v1/admin/skills/speaking/prompts (Phương án A, OQ-7 đã chốt).
 * Toàn bộ route yêu cầu verifyToken + requireAdmin (C-2) — sai role 403 FORBIDDEN.
 * DELETE = soft-delete isActive=false (R5), không xóa cứng.
 */

/**
 * @swagger
 * tags:
 *   - name: Speaking Admin
 *     description: UC-16 — Admin quản lý ngân hàng câu mẫu luyện nói (role=admin)
 */

const router = Router();

// Áp middleware admin cho cả file (giống admin.routes.ts pattern)
router.use(verifyToken, requireAdmin);

/**
 * @swagger
 * /api/v1/admin/skills/speaking/prompts:
 *   get:
 *     summary: List prompts có filter level/search/hasAudio/source + pagination (OQ-3 chốt 6 param)
 *     tags: [Speaking Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20, maximum: 100 } }
 *       - { in: query, name: level, schema: { type: string, enum: [A1,A2,B1,B2,C1,C2] } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: hasAudio, schema: { type: string, enum: ['true','false'] } }
 *       - { in: query, name: source, schema: { type: string, enum: [seed,admin,ai] } }
 *     responses:
 *       200: { description: Danh sách prompts + pagination }
 *       403: { description: Không phải admin }
 */
router.get(
  '/',
  generalLimiter,
  validateZod(listSpeakingPromptsSchema),
  listSpeakingPromptsController
);

/**
 * @swagger
 * /api/v1/admin/skills/speaking/prompts:
 *   post:
 *     summary: Tạo prompt mới (source mặc định admin)
 *     tags: [Speaking Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Prompt đã tạo }
 *       400: { description: VALIDATION_FAILED }
 *       403: { description: Không phải admin }
 */
router.post(
  '/',
  generalLimiter,
  validateZod(speakingPromptBodySchema),
  createSpeakingPromptController
);

/**
 * @swagger
 * /api/v1/admin/skills/speaking/prompts/{id}:
 *   put:
 *     summary: Sửa prompt — lịch sử chấm giữ snapshot riêng (R8)
 *     tags: [Speaking Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Prompt đã sửa }
 *       404: { description: ERR_PROMPT_NOT_FOUND }
 */
router.put(
  '/:id',
  generalLimiter,
  validateZod(speakingPromptParamsSchema),
  validateZod(speakingPromptUpdateSchema),
  updateSpeakingPromptController
);

/**
 * @swagger
 * /api/v1/admin/skills/speaking/prompts/{id}:
 *   delete:
 *     summary: Soft-delete prompt (isActive=false) — phiên render co lại (R5)
 *     tags: [Speaking Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Prompt đã isActive=false }
 *       404: { description: ERR_PROMPT_NOT_FOUND }
 */
router.delete(
  '/:id',
  generalLimiter,
  validateZod(speakingPromptParamsSchema),
  deleteSpeakingPromptController
);

export default router;
