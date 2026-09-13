import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import { HttpStatus } from '../constants/httpStatus';
import {
  getQuestions,
  gradeWritingById,
  submitBatch,
  getResult,
} from '../services/writing.service';

/**
 * UC-17 Writing Practice controllers (FR-113, W1–W4).
 * Controller mỏng theo AD-1: nhận req/res → gọi writing.service → trả qua sendSuccess.
 * Toàn bộ lỗi throw AppError → catchAsync → global error middleware (AD-8).
 */

/** GET /api/v1/skills/writing/questions — W1 (CAP-01, AC-01) */
export const getQuestionsController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  // validateZod đã ghi đè req.query bằng data đã parse (coerce limit, default 5)
  const { examType, taskType, limit } = req.query as unknown as {
    examType: 'ielts' | 'toeic';
    taskType?: string;
    limit: number;
  };
  const data = await getQuestions(userId, { examType, taskType, limit });
  return sendSuccess(res, 'Lấy danh sách đề Writing thành công', data);
});

/**
 * POST /api/v1/skills/writing/grade — W2 (CAP-02, AC-03/04/09/12).
 * Chấm từng bài bằng Gemini, KHÔNG ghi DB — kết quả giữ tạm ở FE (BR-04).
 */
export const gradeWritingController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const data = await gradeWritingById(userId, req.body);
  return sendSuccess(res, 'Chấm bài Writing thành công', data);
});

/**
 * POST /api/v1/skills/writing/submit — W3 (CAP-03, AC-08/12/14).
 * Ghi lô all-or-nothing; lần đầu 201, replay 200 (dedupe groupId + fingerprint).
 */
export const submitBatchController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { replayed, data } = await submitBatch(userId, req.body);
  return sendSuccess(res, 'Nộp bài Writing thành công', data, replayed ? HttpStatus.OK : HttpStatus.CREATED);
});

/** GET /api/v1/skills/writing/results/:resultId — W4 (CAP-05) — chỉ chủ sở hữu */
export const getResultController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { resultId } = req.params as { resultId: string };
  const data = await getResult(userId, resultId);
  return sendSuccess(res, 'Lấy kết quả Writing thành công', data);
});
