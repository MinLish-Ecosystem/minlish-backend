import { VoiceAITier, IVoiceAITier, ComponentFormat } from '../models/Model';
import { getOrCreateSystemConfig } from '../models/SystemConfig';
import { DailyStats } from '../models/DailyStats';
import { Types } from 'mongoose';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';
import { ErrorCodes } from '../constants/errorCodes';
import { TIER_ORDER, DifficultyLevel, DEFAULT_VOICE_AI_SYSTEM_PROMPT } from '../constants/voiceAi';
import { buildMegaLink } from '../utils/mega.util';
import { env } from '../config/env';

/**
 * UC-13 Voice AI — Model Registry service (FR-100..102)
 *
 * Ownership (AD-3): đây là nơi duy nhất đọc VoiceAITier + đọc SystemConfig
 * (qua helper AD-11) cho UC-13. BE KHÔNG xử lý audio, KHÔNG chấm điểm,
 * KHÔNG lưu session — toàn bộ pipeline STT→LLM→TTS + scoring chạy on-device (C-2).
 */

export interface ComponentFileDownload {
  role: 'model' | 'encoder' | 'decoder' | 'config' | 'tokenizer';
  fileName: string;
  url: string;
  sizeMB: number;
}

export interface ComponentDownload {
  url: string;         // legacy: file chính (megaFileId) — back-compat FE cũ
  format: ComponentFormat;
  files: ComponentFileDownload[]; // NEW: đầy đủ các file — ONNX encoder/decoder 2 file, GGUF 1 file
}

export interface TierDownloadResponse {
  downloads: {
    stt: ComponentDownload;
    llm: ComponentDownload;
    tts: ComponentDownload;
  };
  totalSizeMB: number;
}

/** Catalog DTO — đã strip megaFileId/files (api-spec §1.1: ComponentDto = {name, sizeMB} + format). */
export interface SanitizedTier {
  _id: string;
  name: string;
  difficultyLevel: IVoiceAITier['difficultyLevel'];
  requirements: IVoiceAITier['requirements'];
  components: {
    stt: { name: string; sizeMB: number; format: ComponentFormat };
    llm: { name: string; sizeMB: number; format: ComponentFormat };
    tts: { name: string; sizeMB: number; format: ComponentFormat };
  };
  totalSizeMB: number;
  status: IVoiceAITier['status'];
  createdAt: Date;
  updatedAt: Date;
}

export interface TierCatalogResponse {
  tiers: SanitizedTier[];
  systemPrompt: string;
}

/**
 * Sort tiers theo TIER_ORDER (light → extreme).
 * F9 — KHÔNG dùng .sort({difficultyLevel: 1}) của Mongoose vì enum string
 * sort theo alphabet (extreme, high, light, medium, ultra) → sai AC-01.
 */
function sortTiersByOrder(tiers: IVoiceAITier[]): IVoiceAITier[] {
  return [...tiers].sort(
    (a, b) => TIER_ORDER.indexOf(a.difficultyLevel as DifficultyLevel) - TIER_ORDER.indexOf(b.difficultyLevel as DifficultyLevel),
  );
}

/**
 * Build system prompt để trả về catalog (OQ-11 resolved).
 * Thứ tự ưu tiên (thấp → cao): DEFAULT constant → env VOICE_AI_SYSTEM_PROMPT → SystemConfig (admin chỉnh)
 */
function resolveSystemPrompt(): string {
  const fromEnv = (env.VOICE_AI_SYSTEM_PROMPT || '').trim();
  return fromEnv || DEFAULT_VOICE_AI_SYSTEM_PROMPT;
}

/**
 * CAP-01 — Danh sách model tiers + system prompt (OQ-11 resolved: systemPrompt
 * include trong catalog response, nguồn SystemConfig.voiceAiSystemPrompt).
 * KHÔNG expose megaFileId/files trên catalog — chỉ trả trong download link (api-spec §2.1).
 */
export async function listTiers(status?: 'available' | 'deprecated' | 'updating'): Promise<TierCatalogResponse> {
  const docs = await VoiceAITier.find({ ...(status ? { status } : {}) });
  const tiers = sortTiersByOrder(docs).map(sanitizeTier);

  const config = await getOrCreateSystemConfig();
  const fromDb = (config.voiceAiSystemPrompt || '').trim();
  const systemPrompt = fromDb || resolveSystemPrompt();

  return { tiers, systemPrompt };
}

/**
 * CAP-01 — Chi tiết một tier (cũng KHÔNG expose link tải — chỉ download endpoint trả).
 */
export async function getTier(id: string): Promise<SanitizedTier> {
  const tier = await VoiceAITier.findById(id);
  if (!tier) {
    throw new AppError('Model not found', HttpStatus.NOT_FOUND, ErrorCodes.MODEL_NOT_FOUND);
  }
  return sanitizeTier(tier);
}

/**
 * Strip fields nhạy cảm khỏi response catalog/detail (api-spec §1.1 ComponentDto = {name, sizeMB}).
 * megaFileId + files[].megaFileId chỉ expose qua GET /model/download (đã qua verifyToken + rate limit).
 */
function sanitizeTier(tier: IVoiceAITier): SanitizedTier {
  const t = tier.toObject() as any;
  for (const key of ['stt', 'llm', 'tts'] as const) {
    if (t.components?.[key]) {
      const { name, sizeMB, format } = t.components[key];
      t.components[key] = { name, sizeMB, format };
    }
  }
  return t as SanitizedTier;
}

/**
 * Map files[] của component sang response download.
 * URL trả về là PROXY BE (stream Mega qua BE — Mega chặn CORS browser trực tiếp).
 * Link gốc Mega encode base64url vào `src=` để proxy resolve lại + verify với DB.
 * - Component KHÔNG có files[] → dùng megaFileId làm file chính (role 'model', back-compat)
 * - Component CÓ files[] (ONNX encoder/decoder) → trả đầy đủ từng file
 */
function toComponentDownload(
  tierId: string,
  componentName: string,
  component: { name: string; megaFileId: string; format: ComponentFormat; files?: { role: string; fileName: string; megaFileId: string; sizeMB: number }[] },
): ComponentDownload {
  const buildProxyUrl = (fileName: string, megaFileId: string) => {
    const encoded = Buffer.from(buildMegaLink(megaFileId)).toString('base64url');
    return `/api/v1/voice-ai/model/file?tier=${tierId}&component=${componentName}&file=${encodeURIComponent(fileName)}&src=${encoded}`;
  };
  const files: ComponentFileDownload[] =
    Array.isArray(component.files) && component.files.length > 0
      ? component.files.map((f) => ({
          role: f.role as ComponentFileDownload['role'],
          fileName: f.fileName,
          url: buildProxyUrl(f.fileName, f.megaFileId),
          sizeMB: f.sizeMB,
        }))
      : [{ role: 'model', fileName: `${component.name}.${component.format}`, url: buildProxyUrl(`${component.name}.${component.format}`, component.megaFileId), sizeMB: 0 }];

  return {
    url: files[0].url, // legacy field: file chính
    format: component.format,
    files,
  };
}

/**
 * CAP-04 — Lấy link tải weights 3 components của tier.
 * Chỉ tier status='available' được tải mới (AF-08); KHÔNG increment downloadCount
 * (field đã loại bỏ theo BA decision 2026-08-29).
 */
export async function getTierDownload(id: string): Promise<TierDownloadResponse> {
  const tier = await VoiceAITier.findById(id);
  if (!tier) {
    throw new AppError('Model not found', HttpStatus.NOT_FOUND, ErrorCodes.MODEL_NOT_FOUND);
  }
  if (tier.status !== 'available') {
    throw new AppError(
      'Model tier is deprecated or updating. Please choose another tier.',
      HttpStatus.CONFLICT,
      ErrorCodes.MODEL_UNAVAILABLE,
    );
  }

  return {
    downloads: {
      stt: toComponentDownload(tier._id.toString(), 'stt', tier.components.stt as any),
      llm: toComponentDownload(tier._id.toString(), 'llm', tier.components.llm as any),
      tts: toComponentDownload(tier._id.toString(), 'tts', tier.components.tts as any),
    },
    totalSizeMB: tier.totalSizeMB,
  };
}

/**
 * PROXY resolve: xác thực (tier, component, fileName, src) khớp nhau trong DB rồi
 * trả mega URL gốc để route mở stream. Chặn path traversal + src giả mạo.
 */
export async function resolveWeightFile(
  tierId: string,
  component: string,
  fileName: string,
  encodedSrc: string,
): Promise<string> {
  if (!['stt', 'llm', 'tts'].includes(component)) {
    throw new AppError('Invalid component', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  if (!/^[A-Za-z0-9._-]+$/.test(fileName)) {
    throw new AppError('Invalid file name', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  const tier = await VoiceAITier.findById(tierId);
  if (!tier) {
    throw new AppError('Model not found', HttpStatus.NOT_FOUND, ErrorCodes.MODEL_NOT_FOUND);
  }

  const comp = tier.components[component as 'stt' | 'llm' | 'tts'] as any;
  const candidates: Array<{ fileName: string; megaFileId: string }> = Array.isArray(comp?.files) && comp.files.length > 0
    ? comp.files
    : [{ fileName: `${comp.name}.${comp.format}`, megaFileId: comp.megaFileId }];

  const match = candidates.find((f) => f.fileName === fileName);
  if (!match) {
    throw new AppError('File not found in tier', HttpStatus.NOT_FOUND, ErrorCodes.MODEL_NOT_FOUND);
  }

  // Verify src khớp link thật của file này — không cho dùng src tùy ý
  const expected = Buffer.from(buildMegaLink(match.megaFileId)).toString('base64url');
  if (expected !== encodedSrc) {
    throw new AppError('Source mismatch', HttpStatus.FORBIDDEN, ErrorCodes.VALIDATION_ERROR);
  }
  return buildMegaLink(match.megaFileId);
}

export interface RecordVoiceSessionInput {
  utterances: number;
  score: number;
  timeSpent: number;
}

/**
 * POST /voice-ai/sessions — ghi nhận 1 phiên voice hoàn thành vào DailyStats.
 * FE chỉ gọi khi phiên đạt targetScore (không gọi từng câu) nên không spam được
 * bằng cách mở phiên rồi thoát. Điểm từng câu vẫn ephemeral phía FE (C-11 giữ nguyên).
 */
export async function recordVoiceSession(userId: string, input: RecordVoiceSessionInput) {
  const userObjectId = new Types.ObjectId(userId);
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const updated = await DailyStats.findOneAndUpdate(
    { userId: userObjectId, date: todayMidnight },
    {
      $inc: {
        voiceUtterances: input.utterances,
        voiceSessions: 1,
        timeSpent: input.timeSpent,
      },
    },
    { upsert: true, new: true },
  ).lean();

  return {
    date: todayMidnight.toISOString(),
    voiceUtterances: (updated as any)?.voiceUtterances ?? input.utterances,
    voiceSessions: (updated as any)?.voiceSessions ?? 1,
  };
}
