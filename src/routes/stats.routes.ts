// ─────────────────────────────────────────────────────────────────────────────
// Stats Routes — Phase 4-B
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
import { validateZod } from '../middlewares/validate.middleware';
import { getStatsDaysSchema } from '../validators/stats.schema';
import { verifyToken } from '../middlewares/auth.middleware';
import {
  getDashboardStatsController,
  getDailyStatsController,
  getMasteryDistributionController,
  getHeatmapController,
  getRetentionController,
} from '../controllers/stats.controller';

/**
 * @swagger
 * tags:
 *   - name: Stats
 *     description: Thống kê và phân tích tiến trình học tập
 */

const router = Router();

// Tất cả stats routes đều yêu cầu đăng nhập
router.use(verifyToken);

/**
 * @swagger
 * /api/v1/stats/dashboard:
 *   get:
 *     summary: Lấy tổng quan dashboard học tập
 *     description: Trả về streak, số từ đã mastered, accuracy tổng, thời gian học, thống kê hôm nay và ước tính trình độ
 *     tags: [Stats]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê dashboard đầy đủ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Dashboard stats fetched" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     streak:
 *                       type: object
 *                       properties:
 *                         current: { type: number, example: 7 }
 *                         longest: { type: number, example: 21 }
 *                     totalWordsLearned: { type: number, example: 350 }
 *                     masteredWords: { type: number, example: 120 }
 *                     totalReviews: { type: number, example: 980 }
 *                     overallAccuracy: { type: number, example: 82 }
 *                     timeSpent:
 *                       type: object
 *                       properties:
 *                         totalSeconds: { type: number, example: 72000 }
 *                         totalHours: { type: number, example: 20 }
 *                     currentLevel:
 *                       type: object
 *                       properties:
 *                         estimated: { type: string, example: "B1" }
 *                         confidence: { type: number, example: 82 }
 *                     todayStats:
 *                       type: object
 *                       properties:
 *                         newLearned: { type: number, example: 5 }
 *                         reviewed: { type: number, example: 15 }
 *                         accuracy: { type: number, example: 80 }
 *                         dueCount: { type: number, example: 8 }
 *       401:
 *         description: Chưa đăng nhập
 */
router.get('/dashboard', getDashboardStatsController);

/**
 * @swagger
 * /api/v1/stats/daily:
 *   get:
 *     summary: Lấy thống kê theo ngày (biểu đồ daily activity)
 *     description: Trả về dữ liệu học tập từng ngày trong N ngày gần nhất, tự động fill 0 cho ngày không học
 *     tags: [Stats]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 7
 *           maximum: 365
 *           default: 30
 *         description: Số ngày muốn lấy dữ liệu (7, 30, 90, 365)
 *     responses:
 *       200:
 *         description: Mảng dữ liệu theo ngày
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string, example: "2026-05-29" }
 *                       newWordsLearned: { type: number, example: 10 }
 *                       wordsReviewed: { type: number, example: 25 }
 *                       correctAnswers: { type: number, example: 20 }
 *                       totalAnswers: { type: number, example: 25 }
 *                       accuracy: { type: number, example: 80 }
 *                       timeSpent: { type: number, example: 900, description: "Giây" }
 *       401:
 *         description: Chưa đăng nhập
 */
router.get(
  '/daily',
  validateZod(getStatsDaysSchema),
  getDailyStatsController,
);

/**
 * @swagger
 * /api/v1/stats/mastery-distribution:
 *   get:
 *     summary: Lấy phân bố từ theo trạng thái học (Mastery Distribution)
 *     description: Trả về số lượng từ theo từng trạng thái new / learning / review / mastered
 *     tags: [Stats]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Phân bố mastery
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     new: { type: number, example: 200 }
 *                     learning: { type: number, example: 80 }
 *                     review: { type: number, example: 50 }
 *                     mastered: { type: number, example: 120 }
 *                     total: { type: number, example: 450 }
 *       401:
 *         description: Chưa đăng nhập
 */
router.get('/mastery-distribution', getMasteryDistributionController);

/**
 * @swagger
 * /api/v1/stats/heatmap:
 *   get:
 *     summary: Lấy dữ liệu heatmap 90 ngày
 *     description: Trả về số từ ôn tập mỗi ngày trong 90 ngày gần nhất để hiển thị heatmap calendar
 *     tags: [Stats]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Mảng dữ liệu heatmap
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string, example: "2026-05-29" }
 *                       count: { type: number, example: 25, description: "Số từ đã ôn trong ngày" }
 *       401:
 *         description: Chưa đăng nhập
 */
router.get('/heatmap', getHeatmapController);

/**
 * @swagger
 * /api/v1/stats/retention:
 *   get:
 *     summary: Lấy tỷ lệ ghi nhớ (Retention Rate) theo ngày
 *     description: Trả về correctAnswers/totalAnswers mỗi ngày trong N ngày gần nhất (chỉ ngày có ôn tập)
 *     tags: [Stats]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 7
 *           maximum: 365
 *           default: 30
 *         description: Số ngày muốn xem retention
 *     responses:
 *       200:
 *         description: Mảng retention theo ngày
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string, example: "2026-05-29" }
 *                       retention: { type: number, example: 84, description: "% câu trả lời đúng" }
 *                       totalAnswers: { type: number, example: 25 }
 *                       correctAnswers: { type: number, example: 21 }
 *       401:
 *         description: Chưa đăng nhập
 */
router.get(
  '/retention',
  validateZod(getStatsDaysSchema),
  getRetentionController,
);

export default router;
