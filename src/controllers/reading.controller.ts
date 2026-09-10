/**
 * UC-14 Reading controllers — Learner (FR-110..FR-114).
 * Controller mỏng theo AD-1: nhận req/res → gọi service → trả response qua sendSuccess.
 */
import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import { getSession, submitSession, CefrLevel } from '../services/reading.service';
import { HttpStatus } from '../constants/httpStatus';
import type { ReadingSubmitDto } from '../validators/reading.schema';

/**
 * GET /api/v1/skills/reading/session?level= — Lấy phiên tối đa 15 câu (CAP-1, FR-110, AC-01/AC-15).
 * Route đã qua verifyToken + verifyLearner; pool rỗng → 404 ERR_NO_QUESTIONS_AVAILABLE.
 */
export const getReadingSessionController = catchAsync(async (req: Request, res: Response) => {
  const level = req.query.level as CefrLevel | undefined;
  const questions = await getSession(level);
  return sendSuccess(res, 'Lấy phiên Reading thành công', { questions });
});

/**
 * POST /api/v1/skills/reading/submit — Finish phiên, ghi lô kết quả (CAP-5, FR-114, AC-13).
 * 201 lần ghi đầu tiên; 200 khi replay idempotent cùng `groupId` (R7).
 */
export const submitReadingSessionController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const dto = req.body as ReadingSubmitDto;
  const { summary, replayed } = await submitSession(userId, dto);
  return sendSuccess(
    res,
    replayed ? 'Phiên đã được ghi nhận trước đó' : 'Nộp kết quả phiên Reading thành công',
    summary,
    replayed ? HttpStatus.OK : HttpStatus.CREATED,
  );
});
