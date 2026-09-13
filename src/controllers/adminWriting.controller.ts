import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import { HttpStatus } from '../constants/httpStatus';
import { listQuestions, createQuestion, updateQuestion, deleteQuestion } from '../services/adminWriting.service';

/**
 * UC-17 Admin Writing controllers (W5 — CAP-06).
 * Route đã qua verifyToken + requireAdmin; validation đã qua Zod tại route layer.
 */

/** GET /api/v1/admin/skills/writing/questions — list + pagination + filter */
export const listQuestionsController = catchAsync(async (req: Request, res: Response) => {
  // validateZod đã ghi đè req.query bằng data đã parse (coerce page/limit + default)
  const { page, limit, examType, taskType } = req.query as unknown as {
    page: number;
    limit: number;
    examType?: string;
    taskType?: string;
  };
  const data = await listQuestions({ page, limit, examType, taskType });
  return sendSuccess(res, 'Lấy danh sách đề Writing thành công', data);
});

/** POST /api/v1/admin/skills/writing/questions — tạo đề mới */
export const createQuestionController = catchAsync(async (req: Request, res: Response) => {
  const data = await createQuestion(req.body);
  return sendSuccess(res, 'Tạo đề Writing thành công', data, HttpStatus.CREATED);
});

/** PUT /api/v1/admin/skills/writing/questions/:id — update field (attempt cũ giữ snapshot BR-08) */
export const updateQuestionController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const data = await updateQuestion(id, req.body);
  return sendSuccess(res, 'Cập nhật đề Writing thành công', data);
});

/** DELETE /api/v1/admin/skills/writing/questions/:id — soft delete (isDeleted=true) */
export const deleteQuestionController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const data = await deleteQuestion(id);
  return sendSuccess(res, 'Xóa đề Writing thành công', data);
});
