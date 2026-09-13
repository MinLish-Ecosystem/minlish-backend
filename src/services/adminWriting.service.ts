import { WritingQuestion } from '../models/WritingQuestion';
import type { WritingAdminQuestionInput } from '../validators/writing.schema';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';

/**
 * Admin Writing Questions service (UC-17 CAP-06, W5).
 * Ownership (AD-3): duy nhất nơi WRITE WritingQuestion — CRUD manual + soft delete.
 * Không AI sinh đề, không moderation (SPEC Non-goals) — admin tự chịu trách nhiệm nội dung.
 * Attempt cũ giữ snapshot trong payload nên update/delete đề không đổi review (BR-08/R8).
 */

export async function listQuestions(query: {
  page: number;
  limit: number;
  examType?: string;
  taskType?: string;
}) {
  const filter: Record<string, unknown> = { isDeleted: { $ne: true } }; // mặc định loại đề đã soft-delete
  if (query.examType) {
    filter.examType = query.examType;
  }
  if (query.taskType) {
    filter.taskType = query.taskType;
  }

  const total = await WritingQuestion.countDocuments(filter);
  const questions = await WritingQuestion.find(filter)
    .sort({ createdAt: -1 })
    .skip((query.page - 1) * query.limit)
    .limit(query.limit)
    .lean();

  return { questions, total, page: query.page, limit: query.limit };
}

export async function createQuestion(body: WritingAdminQuestionInput) {
  const question = await WritingQuestion.create(body);
  return { question };
}

export async function updateQuestion(id: string, body: WritingAdminQuestionInput) {
  // Field whitelist: chỉ nhận các field của WritingQuestion — reject field lạ qua Zod .strict()
  const existing = await WritingQuestion.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: body },
    { new: true },
  ).lean();
  if (!existing) {
    throw new AppError('Writing question not found', HttpStatus.NOT_FOUND, ErrorCodes.WRITING_QUESTION_NOT_FOUND);
  }
  return { question: existing };
}

export async function deleteQuestion(id: string) {
  // Soft delete — đề đã nộp vẫn đọc được qua attempt payload (BR-08, NFR-037)
  const existing = await WritingQuestion.findOneAndUpdate(
    { _id: id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true } },
    { new: true },
  ).lean();
  if (!existing) {
    throw new AppError('Writing question not found', HttpStatus.NOT_FOUND, ErrorCodes.WRITING_QUESTION_NOT_FOUND);
  }
  return { question: existing };
}
