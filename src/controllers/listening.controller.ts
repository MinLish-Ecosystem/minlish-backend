import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import { HttpStatus } from '../constants/httpStatus';
import * as listeningService from '../services/listening.service';
import type {
  AdminListQuery,
  CreateQuestionDto,
  GetSessionQuery,
  SubmitSessionDto,
  UpdateQuestionDto,
} from '../services/listening.service';

/**
 * UC-15 Listening Practice controllers (FR-111).
 * Controller mỏng theo AD-1: nhận req/res → gọi service → trả response qua sendSuccess.
 * Lỗi throw AppError → catchAsync → global error middleware (AD-8).
 * Input đã qua validateZod ở route layer (AD-7) nên cast về DTO của service là an toàn.
 */

// ─── Learner ──────────────────────────────────────────────────────────────────

/** GET /api/v1/skills/listening/session — CAP-1. */
export const getSessionController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = req.query as GetSessionQuery;
  const data = await listeningService.getSession(userId, query);
  return sendSuccess(res, 'Lấy phiên Listening thành công', data);
});

/** POST /api/v1/skills/listening/audio — CAP-2. */
export const getAudioController = catchAsync(async (req: Request, res: Response) => {
  const { questionId } = req.body as { questionId: string };
  const data = await listeningService.getAudio(questionId);
  return sendSuccess(res, 'Lấy nội dung audio thành công', data);
});

/** POST /api/v1/skills/listening/submit — CAP-5 (ghi lô 1 lần khi Finish). */
export const submitSessionController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const data = await listeningService.submitSession(userId, req.body as SubmitSessionDto);
  return sendSuccess(res, 'Nộp kết quả phiên Listening thành công', data, HttpStatus.CREATED);
});

// ─── Admin CRUD (CAP-6) ───────────────────────────────────────────────────────

/** GET /api/v1/admin/skills/listening/questions */
export const adminListQuestionsController = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as AdminListQuery;
  const data = await listeningService.adminListQuestions(query);
  return sendSuccess(res, 'Lấy danh sách câu hỏi Listening thành công', data);
});

/** POST /api/v1/admin/skills/listening/questions */
export const adminCreateQuestionController = catchAsync(async (req: Request, res: Response) => {
  const question = await listeningService.adminCreateQuestion(req.body as CreateQuestionDto);
  return sendSuccess(res, 'Tạo câu hỏi Listening thành công', { question }, HttpStatus.CREATED);
});

/** PUT /api/v1/admin/skills/listening/questions/:questionId */
export const adminUpdateQuestionController = catchAsync(async (req: Request, res: Response) => {
  const { questionId } = req.params;
  const question = await listeningService.adminUpdateQuestion(questionId, req.body as UpdateQuestionDto);
  return sendSuccess(res, 'Cập nhật câu hỏi Listening thành công', { question });
});

/** DELETE /api/v1/admin/skills/listening/questions/:questionId (soft delete) */
export const adminDeleteQuestionController = catchAsync(async (req: Request, res: Response) => {
  const { questionId } = req.params;
  await listeningService.adminDeleteQuestion(questionId);
  return sendSuccess(res, 'Đã xóa câu hỏi Listening');
});
