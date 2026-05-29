// ─────────────────────────────────────────────────────────────────────────────
// Stats Routes — Phase 4-B
// ─────────────────────────────────────────────────────────────────────────────
import { Router } from 'express';
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
 * GET /api/v1/stats/dashboard
 * Tổng quan dashboard: streak, mastery, accuracy, timeSpent, todayStats
 */
router.get('/dashboard', getDashboardStatsController);

/**
 * GET /api/v1/stats/daily?days=30
 * Thống kê theo ngày — fill zeros cho ngày không học
 */
router.get('/daily', getDailyStatsController);

/**
 * GET /api/v1/stats/mastery-distribution
 * Phân bố từ theo trạng thái: new / learning / review / mastered
 */
router.get('/mastery-distribution', getMasteryDistributionController);

/**
 * GET /api/v1/stats/heatmap
 * Heatmap 90 ngày — số từ ôn tập mỗi ngày
 */
router.get('/heatmap', getHeatmapController);

/**
 * GET /api/v1/stats/retention?days=30
 * Tỷ lệ ghi nhớ (retention rate) theo ngày
 */
router.get('/retention', getRetentionController);

export default router;
