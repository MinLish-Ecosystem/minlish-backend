import { Request, Response } from "express";
import * as learningService from "../services/learning.service";
import { sendSuccess } from "../utils/response.util";
import { catchAsync } from "../utils/catchAsync";

/**
 * GET /api/v1/learning/due-summary
 * Lấy tóm tắt số từ đến hạn học và ôn tập hôm nay (Badge count)
 */
export const getDueSummaryController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const summary = await learningService.getDueSummary(userId);
  return sendSuccess(res, "Due summary fetched successfully", summary);
});

/**
 * GET /api/v1/learning/queue
 * Lấy hàng đợi từ vựng ôn tập và học mới hôm nay (Global queue)
 */
export const getLearningQueueController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  // req.query.previewOnly is already transformed to boolean by Zod middleware
  const previewOnly = (req.query.previewOnly as unknown) === true;
  const timezone = req.query.timezone as string | undefined;

  const queue = await learningService.getLearningQueue(userId, { previewOnly, timezone });
  return sendSuccess(res, "Learning queue fetched successfully", queue);
});

/**
 * POST /api/v1/learning/words/:wordId/review
 * Nộp kết quả đánh giá ôn tập/học từ vựng (SRS SM-2)
 */
export const submitReviewController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { wordId } = req.params;
  const result = await learningService.submitReview(wordId, userId, req.body);
  return sendSuccess(res, "Review submitted successfully", result);
});

/**
 * GET /api/v1/learning/sets/:id/queue
 * Lấy hàng đợi ôn tập riêng cho một bộ từ vựng cụ thể
 */
export const getSetLearningQueueController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id: setId } = req.params;
  const queue = await learningService.getSetLearningQueue(setId, userId);
  return sendSuccess(res, "Set learning queue fetched successfully", queue);
});

/**
 * GET /api/v1/learning/sets/:id/progress
 * Lấy tóm tắt tiến trình học của 1 bộ từ vựng
 */
export const getSetProgressSummaryController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id: setId } = req.params;
  const summary = await learningService.getSetProgressSummary(setId, userId);
  return sendSuccess(res, "Set progress summary fetched successfully", summary);
});

/**
 * GET /api/v1/learning/words/:wordId/progress
 * Lấy chi tiết SRS tiến độ học của một từ vựng cụ thể
 */
export const getWordSRSProgressController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { wordId } = req.params;
  const progress = await learningService.getWordSRSProgress(wordId, userId);
  return sendSuccess(res, "Word SRS progress fetched successfully", progress);
});

/**
 * POST /api/v1/learning/sync
 * Đồng bộ hàng loạt lịch sử ôn tập ngoại tuyến (Offline Batch Sync)
 */
export const batchSyncController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { reviews } = req.body as { reviews: any[] };

  const results = [];
  for (const review of reviews) {
    try {
      const resObj = await learningService.submitReview(review.wordId, userId, {
        setId: review.setId,
        rating: review.rating,
        timeSpent: review.timeSpent,
        reviewedAt: review.reviewedAt
      });
      results.push({ wordId: review.wordId, success: true, data: resObj });
    } catch (err: any) {
      results.push({ wordId: review.wordId, success: false, error: err.message || "Failed to sync" });
    }
  }

  return sendSuccess(res, "Offline batch sync completed successfully", results);
});
