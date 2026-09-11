/**
 * UC-14 Reading Admin controllers (CAP-6, FR-114).
 * Route đã qua verifyToken + requireAdmin; mọi mutation ghi AdminAuditLog qua service.
 */
import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import {
  adminCreateQuestion,
  adminListQuestions,
  adminSoftDeleteQuestion,
  adminUpdateQuestion,
} from '../services/reading.service';
import type { AdminReadingListQueryDto, ReadingAdminQuestionDto } from '../validators/reading.schema';

/**
 * GET /api/v1/admin/skills/reading/questions — Danh sách phân trang (CAP-6).
 * Filter `isDeleted:false`, type/level tùy chọn, sort `createdAt desc`.
 */
export const adminListQuestionsController = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as AdminReadingListQueryDto;
  const data = await adminListQuestions(query);
  return sendSuccess(res, 'Lấy danh sách câu hỏi Reading thành công', data);
});

/**
 * POST /api/v1/admin/skills/reading/questions — Tạo câu hỏi (CAP-6).
 * Discriminated union theo `type` đã validate tại route (AD-7); audit bắt buộc trước success.
 */
export const adminCreateQuestionController = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const dto = req.body as ReadingAdminQuestionDto;
  const question = await adminCreateQuestion(dto, adminId);
  return sendSuccess(res, 'Tạo câu hỏi Reading thành công', { question }, 201);
});

/**
 * PUT /api/v1/admin/skills/reading/questions/:id — Cập nhật câu hỏi (CAP-6).
 * `type` immutable; merge partial với document hiện có rồi validate toàn bộ trong service.
 */
export const adminUpdateQuestionController = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const { id } = req.params;
  const dto = req.body as Record<string, unknown>;
  const question = await adminUpdateQuestion(id, dto, adminId);
  return sendSuccess(res, 'Cập nhật câu hỏi Reading thành công', { question });
});

/**
 * DELETE /api/v1/admin/skills/reading/questions/:id — Soft delete (CAP-6, NFR-037).
 * Câu đã xóa không vào pool Learner; PracticeAttempt cũ giữ nguyên.
 */
export const adminSoftDeleteQuestionController = catchAsync(async (req: Request, res: Response) => {
  const adminId = req.user!.id;
  const { id } = req.params;
  const question = await adminSoftDeleteQuestion(id, adminId);
  return sendSuccess(res, 'Đã xóa câu hỏi Reading', { question });
});
