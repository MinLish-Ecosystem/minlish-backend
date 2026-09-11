import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import { downloadLimiter, generalLimiter, weightsStreamLimiter } from '../middlewares/rateLimiter';
import {
  listTiersQuerySchema,
  getTierParamsSchema,
  downloadQuerySchema,
  recordSessionBodySchema,
  weightFileQuerySchema,
} from '../validators/voice-ai.schema';
import {
  listTiersController,
  getTierController,
  getTierDownloadController,
  recordSessionController,
  streamWeightFileController,
} from '../controllers/voice-ai.controller';

/**
 * UC-13 Voice AI — Model Registry routes (FR-100..102)
 * Base URL: /api/v1/voice-ai (remount từ /api/v1/models theo C-5)
 *
 * Endpoint admin PATCH /models/:id (OQ-12) KHÔNG mount ở đây —
 * chờ BA chốt ownership UC-13 vs UC-11 mới build (api-spec §2.5).
 */

/**
 * @swagger
 * tags:
 *   - name: Voice AI
 *     description: UC-13 — Model registry cho luyện nói on-device (catalog + link tải weights)
 */

const router = Router();

// ─── Public (user đã đăng nhập) — catalog + chi tiết ───────────────────────────
// Thứ tự route: '/models' TRƯỚC '/models/:id' để tránh path nuốt request
router.get('/models', validateZod(listTiersQuerySchema), listTiersController);
router.get('/models/:id', validateZod(getTierParamsSchema), getTierController);

// ─── Protected + rate limit — link tải weights (3 request/giờ/user) ────────────
// '/model/download' (số ít) tách biệt '/models' (số nhiều) — giữ theo chuẩn FE đã chốt
router.get(
  '/model/download',
  verifyToken,
  downloadLimiter,
  validateZod(downloadQuerySchema),
  getTierDownloadController,
);

// ─── Protected — ghi nhận phiên hoàn thành để cộng streak (FE gọi khi đạt targetScore) ─
/**
 * @swagger
 * /api/v1/voice-ai/sessions:
 *   post:
 *     tags: [Voice AI]
 *     summary: Ghi nhận 1 phiên luyện nói hoàn thành (đạt targetScore FE)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [utterances, score]
 *             properties:
 *               utterances: { type: integer, minimum: 1, maximum: 500 }
 *               score: { type: integer, minimum: 0 }
 *               timeSpent: { type: integer, minimum: 0 }
 *               tierId: { type: string }
 *     responses:
 *       200: { description: Ghi nhận thành công (cộng voiceUtterances/voiceSessions vào DailyStats) }
 *       401: { description: Token thiếu/hết hạn }
 *       422: { description: Dữ liệu không hợp lệ }
 */
router.post(
  '/sessions',
  verifyToken,
  generalLimiter,
  validateZod(recordSessionBodySchema),
  recordSessionController,
);

// ─── Protected + rate limit — proxy STREAM weights từ Mega (FR-104 Phase 2) ────
// Mega chặn CORS browser → BE stream bytes. FE fetch URL này gắn Bearer token.
router.get(
  '/model/file',
  verifyToken,
  weightsStreamLimiter,
  validateZod(weightFileQuerySchema),
  streamWeightFileController,
);

export default router;
