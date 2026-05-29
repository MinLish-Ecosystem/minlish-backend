import { Request, Response, NextFunction } from "express";
import * as syncService from "../services/sync.service";
import { sendSuccess } from "../utils/response.util";

/**
 * GET /api/v1/sync/delta
 * Lấy các thay đổi về bộ từ và từ vựng từ thời điểm đồng bộ gần nhất (lastSyncAt)
 */
export async function getDeltaChangesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const lastSyncAt = req.query.lastSyncAt as string | undefined;

    const delta = await syncService.getDeltaChanges(userId, lastSyncAt);
    sendSuccess(res, "Delta sync changes fetched successfully", delta);
  } catch (err) {
    next(err);
  }
}
