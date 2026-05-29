import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { query } from "express-validator";
import { getDeltaChangesController } from "../controllers/sync.controller";

/**
 * @swagger
 * tags:
 *   - name: Sync
 *     description: Hệ thống đồng bộ dữ liệu ngoại tuyến (Offline Sync & Delta Sync)
 */

const router = Router();

// Yêu cầu xác thực Token
router.use(verifyToken);

/**
 * @swagger
 * /api/v1/sync/delta:
 *   get:
 *     summary: Lấy danh sách các bộ từ và từ vựng thay đổi kể từ mốc đồng bộ trước (Delta Sync)
 *     tags: [Sync]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lastSyncAt
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Mốc thời gian đồng bộ cuối cùng của thiết bị di động (ISO 8601)
 *         example: "2026-05-24T12:00:00.000Z"
 *     responses:
 *       200:
 *         description: Trả về cục thay đổi bao gồm danh sách sets và words mới cập nhật hoặc đã bị xóa mềm
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Delta sync changes fetched successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     lastSyncAt: { type: string, format: date-time, example: "2026-05-24T14:25:44.000Z" }
 *                     changes:
 *                       type: object
 *                       properties:
 *                         sets:
 *                           type: array
 *                           items:
 *                             type: object
 *                         words:
 *                           type: array
 *                           items:
 *                             type: object
 */
router.get(
  "/delta",
  [query("lastSyncAt").optional().isISO8601().withMessage("lastSyncAt must be ISO8601 date-time format")],
  validate,
  getDeltaChangesController
);

export default router;
