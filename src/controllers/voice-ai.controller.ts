import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { sendSuccess } from '../utils/response.util';
import { getTier, getTierDownload, listTiers, recordVoiceSession, resolveWeightFile } from '../services/voice-ai.service';
import { streamFromMega } from '../services/mega.service';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';

/**
 * UC-13 Voice AI controllers (FR-100..102)
 * Controller mỏng theo AD-1: nhận req/res → gọi service → trả response qua sendSuccess.
 * Toàn bộ lỗi throw AppError → catchAsync → global error middleware (AD-8).
 */

/**
 * GET /api/v1/voice-ai/models — Danh sách tier + system prompt (CAP-01, AC-01)
 * Public cho user đã đăng nhập; FE dùng systemPrompt mồi cho LLM on-device (BR-02).
 */
export const listTiersController = catchAsync(async (req: Request, res: Response) => {
  const status = req.query.status as 'available' | 'deprecated' | 'updating' | undefined;
  const data = await listTiers(status);
  return sendSuccess(res, 'Lấy danh mục model thành công', data);
});

/**
 * GET /api/v1/voice-ai/models/:id — Chi tiết một tier (CAP-01)
 */
export const getTierController = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const tier = await getTier(id);
  return sendSuccess(res, 'Lấy thông tin model thành công', { tier });
});

/**
 * GET /api/v1/voice-ai/model/file?tier=&component=&file=&src= — Proxy stream weights (FR-104 Phase 2).
 * Mega chặn CORS browser → BE stream bytes đã giải mã từ Mega về FE.
 * Hạ tầng cho wllama (LLM GGUF on-device theo spec) tải weights về Cache Storage.
 */
export const streamWeightFileController = catchAsync(async (req: Request, res: Response) => {
  const tier = req.query.tier as string;
  const component = req.query.component as string;
  const fileName = req.query.file as string;
  const src = req.query.src as string;

  const megaUrl = await resolveWeightFile(tier, component, fileName, src);
  const { stream, contentType } = await streamFromMega(megaUrl);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  // CORS cho dev server FE gọi trực tiếp (production cùng origin thì vô hại)
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL?.split(',')[0] ?? 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(HttpStatus.BAD_GATEWAY).json({
        success: false,
        message: 'Stream weights thất bại',
        errorCode: ErrorCodes.INTERNAL_ERROR,
      });
      return;
    }
    res.end();
  });
  stream.pipe(res);
});

/**
 * GET /api/v1/voice-ai/model/download?tier= — Link tải weights (CAP-04, AC-03/AC-09/AC-11)
 * Route gắn verifyToken + downloadLimiter (3/h/user) trước khi vào controller.
 * req.user chỉ dùng để scope rate limit — KHÔNG dùng lọc dữ liệu.
 * Response URL trỏ vào proxy /model/file (Mega chặn CORS browser trực tiếp).
 */
export const getTierDownloadController = catchAsync(async (req: Request, res: Response) => {
  const tier = req.query.tier as string;
  const data = await getTierDownload(tier);
  return sendSuccess(res, 'Lấy link tải weights thành công', data);
});

/**
 * POST /api/v1/voice-ai/sessions — Ghi nhận 1 phiên voice hoàn thành (đạt targetScore).
 * FE chỉ gọi khi xong phiên để cộng streak; lỗi thì FE bỏ qua, phiên không đứt.
 */
export const recordSessionController = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { utterances, score, timeSpent } = req.body as {
    utterances: number;
    score: number;
    timeSpent: number;
  };
  const data = await recordVoiceSession(userId, { utterances, score, timeSpent });
  return sendSuccess(res, 'Ghi nhận phiên luyện nói thành công', data);
});
