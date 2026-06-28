// ─────────────────────────────────────────────────────────────────────────────
// Stats Controller — Phase 4-B
// ─────────────────────────────────────────────────────────────────────────────
import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';
import {
  getDashboardStats,
  getDailyStats,
  getMasteryDistribution,
  getHeatmap,
  getRetention,
} from '../services/stats.service';

/**
 * @swagger
 * /api/v1/stats/dashboard:
 *   get:
 *     tags: [Stats]
 *     summary: Lấy tổng quan thống kê học tập (streak, mastery, accuracy, timeSpent, todayStats)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     streak:
 *                       type: object
 *                       properties:
 *                         current:
 *                           type: integer
 *                         longest:
 *                           type: integer
 *                     totalWordsLearned:
 *                       type: integer
 *                     masteredWords:
 *                       type: integer
 *                     totalReviews:
 *                       type: integer
 *                     overallAccuracy:
 *                       type: integer
 *                       description: Phần trăm 0-100
 *                     timeSpent:
 *                       type: object
 *                       properties:
 *                         totalSeconds:
 *                           type: integer
 *                         totalHours:
 *                           type: number
 *                     currentLevel:
 *                       type: object
 *                       properties:
 *                         estimated:
 *                           type: string
 *                           enum: [A1, A2, B1, B2, C1, C2]
 *                         confidence:
 *                           type: integer
 *                     todayStats:
 *                       type: object
 *                       properties:
 *                         newLearned:
 *                           type: integer
 *                         reviewed:
 *                           type: integer
 *                         accuracy:
 *                           type: integer
 *                         dueCount:
 *                           type: integer
 *       401:
 *         description: Chưa đăng nhập
 */
export const getDashboardStatsController = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as string | undefined)?.toString();
  if (!userId)
    throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);

  const daysQuery = req.query.days as string | undefined;
  const days = daysQuery ? parseInt(daysQuery, 10) : undefined;

  const stats = await getDashboardStats(userId, days);
  sendSuccess(res, 'Dashboard stats fetched', stats);
});

/**
 * @swagger
 * /api/v1/stats/daily:
 *   get:
 *     tags: [Stats]
 *     summary: Lấy thống kê theo ngày (mặc định 30 ngày)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Số ngày muốn lấy (tối đa 365)
 *     responses:
 *       200:
 *         description: Daily stats array (có fill zeros ngày trống)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       newWordsLearned:
 *                         type: integer
 *                       wordsReviewed:
 *                         type: integer
 *                       correctAnswers:
 *                         type: integer
 *                       totalAnswers:
 *                         type: integer
 *                       accuracy:
 *                         type: integer
 *                       timeSpent:
 *                         type: integer
 *                         description: Seconds
 *       400:
 *         description: Tham số days không hợp lệ
 *       401:
 *         description: Chưa đăng nhập
 */
export const getDailyStatsController = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as string | undefined)?.toString();
  if (!userId)
    throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);

  const days = Math.min(3650, Math.max(1, parseInt(req.query.days as string) || 30));
  const stats = await getDailyStats(userId, days);
  sendSuccess(res, 'Daily stats fetched', stats);
});

/**
 * @swagger
 * /api/v1/stats/mastery-distribution:
 *   get:
 *     tags: [Stats]
 *     summary: Lấy phân bố từ theo trạng thái học (new/learning/review/mastered)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Mastery distribution
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     new:
 *                       type: integer
 *                     learning:
 *                       type: integer
 *                     review:
 *                       type: integer
 *                     mastered:
 *                       type: integer
 *                     total:
 *                       type: integer
 *       401:
 *         description: Chưa đăng nhập
 */
export const getMasteryDistributionController = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as string | undefined)?.toString();
  if (!userId)
    throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);

  const distribution = await getMasteryDistribution(userId);
  sendSuccess(res, 'Mastery distribution fetched', distribution);
});

/**
 * @swagger
 * /api/v1/stats/heatmap:
 *   get:
 *     tags: [Stats]
 *     summary: Lấy dữ liệu heatmap 90 ngày (số từ ôn tập mỗi ngày)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Heatmap data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       count:
 *                         type: integer
 *                         description: Số từ đã ôn tập ngày đó
 *       401:
 *         description: Chưa đăng nhập
 */
export const getHeatmapController = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as string | undefined)?.toString();
  if (!userId)
    throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);

  const heatmap = await getHeatmap(userId);
  sendSuccess(res, 'Heatmap data fetched', heatmap);
});

/**
 * @swagger
 * /api/v1/stats/retention:
 *   get:
 *     tags: [Stats]
 *     summary: Lấy tỷ lệ ghi nhớ (retention rate) theo ngày
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 90
 *           default: 30
 *         description: Số ngày muốn lấy (tối đa 90)
 *     responses:
 *       200:
 *         description: Retention data (chỉ ngày có ôn tập)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date:
 *                         type: string
 *                         format: date
 *                       retention:
 *                         type: integer
 *                         description: Phần trăm 0-100
 *                       totalAnswers:
 *                         type: integer
 *                       correctAnswers:
 *                         type: integer
 *       401:
 *         description: Chưa đăng nhập
 */
export const getRetentionController = catchAsync(async (req: Request, res: Response) => {
  const userId = (req.user?._id as string | undefined)?.toString();
  if (!userId)
    throw new AppError('Unauthorized', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);

  const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 30));
  const retention = await getRetention(userId, days);
  sendSuccess(res, 'Retention data fetched', retention);
});
