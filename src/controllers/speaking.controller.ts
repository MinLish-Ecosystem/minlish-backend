import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import { HttpStatus } from '../constants/httpStatus';
import {
  listSpeakingSessions,
  getSpeakingSessionDetail,
  submitSpeakingSession,
  getSpeakingResult,
  listPrompts,
  createPrompt,
  updatePrompt,
  softDeletePrompt,
  SpeakingPromptBody,
} from '../services/speakingSkill.service';
import {
  ListSpeakingSessionsQuery,
  SubmitSpeakingSessionBody,
  ListSpeakingPromptsQuery,
  SpeakingPromptUpdateParsed,
} from '../validators/speaking.schema';
import { toSpeakingPromptDTO } from '../models/SpeakingPrompt';

/**
 * UC-16 Speaking Practice controllers (FR-112/114/115/116)
 * Controller mỏng theo AD-1: req/res → gọi service → sendSuccess; lỗi throw AppError
 * → catchAsync → global error middleware (AD-8). KHÔNG chạm DB trực tiếp.
 */

/** API-01 — GET /api/v1/skills/speaking/sessions (CAP-1, AC-01) */
export const listSpeakingSessionsController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const query = req.query as unknown as ListSpeakingSessionsQuery;
  const data = await listSpeakingSessions({
    userId,
    level: query.level,
    type: query.type,
    page: query.page,
    limit: query.limit,
  });
  return sendSuccess(res, 'Speaking sessions fetched successfully', data);
});

/** API-02 — GET /api/v1/skills/speaking/sessions/:sessionId (CAP-2, AC-02/AC-08) */
export const getSpeakingSessionController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { sessionId } = req.params;
  const data = await getSpeakingSessionDetail(userId, sessionId);
  return sendSuccess(res, 'Speaking session fetched successfully', data);
});

/**
 * API-03 — POST /api/v1/skills/speaking/sessions/:sessionId/submit (CAP-3/4/8, AC-03..09)
 * Server chấm lại toàn bộ — KHÔNG nhận scorePercent từ client (OQ-5).
 * Lần đầu 201; retry cùng groupId + fingerprint 200 replay (BR-07).
 */
export const submitSpeakingSessionController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { sessionId } = req.params;
  const body = req.body as SubmitSpeakingSessionBody;
  const data = await submitSpeakingSession(userId, sessionId, body);
  return sendSuccess(
    res,
    'Speaking session submitted successfully',
    { groupId: data.groupId, totalItems: data.totalItems, skillsSummary: data.skillsSummary },
    data.replay ? HttpStatus.OK : HttpStatus.CREATED
  );
});

/** API-04 — GET /api/v1/skills/speaking/results/:resultId (CAP-5, AC-10/AC-11) */
export const getSpeakingResultController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { resultId } = req.params;
  const data = await getSpeakingResult(userId, resultId);
  return sendSuccess(res, 'Speaking result fetched successfully', data);
});

// ─── Admin CRUD — API-05 (CAP-6) ──────────────────────────────────────────────

/** GET /api/v1/admin/skills/speaking/prompts */
export const listSpeakingPromptsController = catchAsync(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListSpeakingPromptsQuery;
  const data = await listPrompts({
    page: query.page,
    limit: query.limit,
    level: query.level,
    search: query.search,
    hasAudio: query.hasAudio === undefined ? undefined : query.hasAudio === 'true',
    source: query.source,
  });
  return sendSuccess(res, 'Speaking prompts fetched successfully', data);
});

/** POST /api/v1/admin/skills/speaking/prompts — tạo, 201 */
export const createSpeakingPromptController = catchAsync(async (req: Request, res: Response) => {
  const body = req.body as SpeakingPromptBody;
  const prompt = await createPrompt(body);
  return sendSuccess(res, 'Speaking prompt created successfully', { prompt: toSpeakingPromptDTO(prompt) }, HttpStatus.CREATED);
});

/** PUT /api/v1/admin/skills/speaking/prompts/:id — sửa prompt (R8: lịch sử chấm không đổi) */
export const updateSpeakingPromptController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const body = req.body as SpeakingPromptUpdateParsed;
  const prompt = await updatePrompt(id, body);
  return sendSuccess(res, 'Speaking prompt updated successfully', { prompt: toSpeakingPromptDTO(prompt) });
});

/** DELETE /api/v1/admin/skills/speaking/prompts/:id — soft-delete isActive=false (R5) */
export const deleteSpeakingPromptController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const prompt = await softDeletePrompt(id);
  return sendSuccess(res, 'Speaking prompt deleted successfully', { prompt: toSpeakingPromptDTO(prompt) });
});
