import { Request, Response, NextFunction } from "express";
import * as learningService from "../services/learning.service";
import { sendSuccess } from "../utils/response.util";
import { AppError } from "../utils/AppError";
import { HttpStatus } from "../constants/httpStatus";

/**
 * GET /api/v1/learning/due-summary
 * Lấy tóm tắt số từ đến hạn học và ôn tập hôm nay (Badge count)
 */
export async function getDueSummaryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const summary = await learningService.getDueSummary(userId);
    sendSuccess(res, "Due summary fetched successfully", summary);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/learning/queue
 * Lấy hàng đợi từ vựng ôn tập và học mới hôm nay (Global queue)
 */
export async function getLearningQueueController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const previewOnly = req.query.previewOnly === "true";
    const timezone = req.query.timezone as string | undefined;

    const queue = await learningService.getLearningQueue(userId, { previewOnly, timezone });
    sendSuccess(res, "Learning queue fetched successfully", queue);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/learning/words/:wordId/review
 * Nộp kết quả đánh giá ôn tập/học từ vựng (SRS SM-2)
 */
export async function submitReviewController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { wordId } = req.params;
    const result = await learningService.submitReview(wordId, userId, req.body);
    sendSuccess(res, "Review submitted successfully", result);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/learning/sets/:id/queue
 * Lấy hàng đợi ôn tập riêng cho một bộ từ vựng cụ thể
 */
export async function getSetLearningQueueController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id: setId } = req.params;
    const queue = await learningService.getSetLearningQueue(setId, userId);
    sendSuccess(res, "Set learning queue fetched successfully", queue);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/learning/sets/:id/progress
 * Lấy tóm tắt tiến trình học của 1 bộ từ vựng
 */
export async function getSetProgressSummaryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id: setId } = req.params;
    const summary = await learningService.getSetProgressSummary(setId, userId);
    sendSuccess(res, "Set progress summary fetched successfully", summary);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/learning/words/:wordId/progress
 * Lấy chi tiết SRS tiến độ học của một từ vựng cụ thể
 */
export async function getWordSRSProgressController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { wordId } = req.params;
    const progress = await learningService.getWordSRSProgress(wordId, userId);
    sendSuccess(res, "Word SRS progress fetched successfully", progress);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/learning/sync
 * Đồng bộ hàng loạt lịch sử ôn tập ngoại tuyến (Offline Batch Sync)
 */
export async function batchSyncController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { reviews } = req.body;

    if (!Array.isArray(reviews)) {
      throw new AppError("Invalid payload: reviews array required", HttpStatus.BAD_REQUEST, "ERR_INVALID_PAYLOAD");
    }

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

    sendSuccess(res, "Offline batch sync completed", results);
  } catch (err) {
    next(err);
  }
}
