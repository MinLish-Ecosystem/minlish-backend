import { Router } from "express";
import { verifyToken } from "../middlewares/auth.middleware";
import { validateZod } from "../middlewares/validate.middleware";
import {
  getQueueSchema,
  submitReviewSchema,
  setParamSchema,
  wordParamSchema,
  batchSyncSchema,
} from "../validators/learning.schema";
import {
  getDueSummaryController,
  getLearningQueueController,
  submitReviewController,
  getSetLearningQueueController,
  getSetProgressSummaryController,
  getWordSRSProgressController,
  batchSyncController
} from "../controllers/learning.controller";

/**
 * @swagger
 * tags:
 *   - name: Learning
 *     description: Hệ thống học tập Spaced Repetition (SRS) bằng thuật toán SM-2
 */

const router = Router();

// Tất cả các route bên dưới đều bắt buộc xác thực Token
router.use(verifyToken);

/**
 * @swagger
 * /api/v1/learning/due-summary:
 *   get:
 *     summary: Lấy nhanh số từ đến hạn học và ôn tập hôm nay (Badge count)
 *     tags: [Learning]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về số từ mới và số từ cần ôn đến hạn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Due summary fetched successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     newWordsCount: { type: number, example: 10 }
 *                     dueReviewsCount: { type: number, example: 15 }
 *                     totalDueCount: { type: number, example: 25 }
 */
router.get("/due-summary", getDueSummaryController);

/**
 * @swagger
 * /api/v1/learning/queue:
 *   get:
 *     summary: Lấy hàng đợi từ vựng học mới và ôn tập hôm nay (Global queue)
 *     tags: [Learning]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: previewOnly
 *         schema:
 *           type: boolean
 *         description: Nếu là true chỉ trả về số lượng tóm tắt, không trả về chi tiết từ
 *       - in: query
 *         name: timezone
 *         schema:
 *           type: string
 *           default: "Asia/Ho_Chi_Minh"
 *     responses:
 *       200:
 *         description: Trả về hàng đợi học tập chi tiết phân loại New và Review
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     newCards:
 *                       type: array
 *                       items:
 *                         type: object
 *                     reviewCards:
 *                       type: array
 *                       items:
 *                         type: object
 *                     summary:
 *                       type: object
 */
router.get(
  "/queue",
  validateZod(getQueueSchema),
  getLearningQueueController
);

/**
 * @swagger
 * /api/v1/learning/words/{wordId}/review:
 *   post:
 *     summary: Nộp kết quả ôn tập/học từ vựng (SRS SM-2)
 *     tags: [Learning]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: wordId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - setId
 *               - rating
 *             properties:
 *               setId:
 *                 type: string
 *                 example: "660c1abf8c0288219..."
 *               rating:
 *                 type: string
 *                 enum: [again, hard, good, easy]
 *                 example: "good"
 *               timeSpent:
 *                 type: number
 *                 description: Số giây dùng để học từ này
 *                 example: 7
 *               reviewedAt:
 *                 type: string
 *                 format: date-time
 *                 description: Mốc thời gian thực hiện (hỗ trợ offline sync)
 *     responses:
 *       200:
 *         description: Trả về kết quả SRS mới của từ vựng vừa đánh giá
 */
router.post(
  "/words/:wordId/review",
  validateZod(submitReviewSchema),
  submitReviewController
);

/**
 * @swagger
 * /api/v1/learning/sets/{id}/queue:
 *   get:
 *     summary: Lấy hàng đợi ôn tập/học từ riêng cho một bộ từ vựng cụ thể
 *     tags: [Learning]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trả về hàng đợi học tập chi tiết thuộc bộ từ vựng
 */
router.get(
  "/sets/:id/queue",
  validateZod(setParamSchema),
  getSetLearningQueueController
);

/**
 * @swagger
 * /api/v1/learning/sets/{id}/progress:
 *   get:
 *     summary: Lấy tóm tắt tiến trình học của 1 bộ từ vựng
 *     tags: [Learning]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trả về tóm tắt thống kê các số từ theo status
 */
router.get(
  "/sets/:id/progress",
  validateZod(setParamSchema),
  getSetProgressSummaryController
);

/**
 * @swagger
 * /api/v1/learning/words/{wordId}/progress:
 *   get:
 *     summary: Lấy chi tiết SRS tiến độ học của một từ vựng cụ thể
 *     tags: [Learning]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: wordId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trả về các chỉ số easeFactor, interval, repetitions của từ vựng
 */
router.get(
  "/words/:wordId/progress",
  validateZod(wordParamSchema),
  getWordSRSProgressController
);

/**
 * @swagger
 * /api/v1/learning/sync:
 *   post:
 *     summary: Đồng bộ hàng loạt lịch sử ôn tập ngoại tuyến (Offline Batch Sync)
 *     tags: [Learning]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reviews
 *             properties:
 *               reviews:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - wordId
 *                     - setId
 *                     - rating
 *                   properties:
 *                     wordId: { type: string }
 *                     setId: { type: string }
 *                     rating: { type: string, enum: [again, hard, good, easy] }
 *                     timeSpent: { type: number }
 *                     reviewedAt: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Trả về danh sách kết quả đồng bộ của từng từ
 */
router.post(
  "/sync",
  validateZod(batchSyncSchema),
  batchSyncController
);

export default router;
