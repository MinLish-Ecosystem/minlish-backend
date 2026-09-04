import { z } from 'zod';

/**
 * UC-13 Voice AI — Zod validation schemas (AD-7: validate tại route layer)
 * Endpoint admin PATCH /models/:id thuộc OQ-12 — CHƯA build, chờ BA chốt ownership.
 */

const objectId24 = /^[0-9a-fA-F]{24}$/;

/** GET /voice-ai/models?status=available */
export const listTiersQuerySchema = z.object({
  query: z.object({
    status: z.enum(['available', 'deprecated', 'updating']).optional(),
  }),
});

/** GET /voice-ai/models/:id */
export const getTierParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(objectId24, 'Invalid id'),
  }),
});

/** GET /voice-ai/model/download?tier={id} */
export const downloadQuerySchema = z.object({
  query: z.object({
    tier: z.string().regex(objectId24, 'Invalid tier id'),
  }),
});

/** GET /voice-ai/model/file?tier&component&file&src — proxy stream weights (FR-104 Phase 2) */
export const weightFileQuerySchema = z.object({
  query: z.object({
    tier: z.string().regex(objectId24, 'Invalid tier id'),
    component: z.enum(['stt', 'llm', 'tts']),
    file: z.string().regex(/^[A-Za-z0-9._-]+$/, 'Invalid file name'),
    src: z.string().min(10, 'Invalid src'),
  }),
});

/**
 * POST /voice-ai/sessions — ghi nhận 1 phiên voice hoàn thành (đạt targetScore FE)
 * vào DailyStats để tính streak. FE chỉ gọi khi xong phiên, không gọi từng câu.
 */
export const recordSessionBodySchema = z.object({
  body: z.object({
    utterances: z.number().int().min(1).max(500),
    score: z.number().int().min(0).max(100000),
    timeSpent: z.number().int().min(0).max(86400).optional().default(0),
    tierId: z.string().regex(objectId24, 'Invalid tier id').optional(),
  }),
});
