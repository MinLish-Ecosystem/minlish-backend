import { z } from 'zod';

const objectIdSchema = (fieldName: string) =>
  z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: `Invalid ${fieldName}` });

// ─── Param Schema ────────────────────────────────────────────────────────────

export const adminIdParamSchema = z.object({
  params: z.object({
    id: objectIdSchema('id'),
  }),
});

// ─── Ban User Schema ─────────────────────────────────────────────────────────

export const banUserSchema = z.object({
  params: z.object({
    id: objectIdSchema('id'),
  }),
  body: z.object({
    reason: z.string({ message: 'reason required' })
      .trim()
      .min(1, 'reason required'),
  }),
});

// ─── Unpublish Set Schema ────────────────────────────────────────────────────

export const unpublishSetSchema = z.object({
  params: z.object({
    id: objectIdSchema('id'),
  }),
  body: z.object({
    reason: z.string().trim().optional(),
  }),
});

// ─── Pagination Query Schema ──────────────────────────────────────────────────

export const adminPaginationSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1, 'Page must be >= 1').optional(),
    limit: z.coerce.number().int().min(1).max(100, 'Limit must be <= 100').optional(),
    q: z.string().optional(),
    category: z.string().optional(),
    status: z.string().optional(),
  }),
});

// ─── Update System Config Schema ─────────────────────────────────────────────
// Whitelist các field admin được sửa qua PUT /admin/config (chặn ghi bậy field lạ).
// voiceAiSystemPrompt (UC-13 BR-02): prompt hội thoại Voice AI, FE kéo về mỗi lần mở voice-chat.

export const updateConfigSchema = z.object({
  body: z.object({
    maintenanceMode: z.boolean().optional(),
    mailerActive: z.boolean().optional(),
    cloudinaryActive: z.boolean().optional(),
    otpLength: z.union([z.literal(4), z.literal(6), z.literal(8)]).optional(),
    sessionExpiry: z.enum(['1h', '4h', '12h', '24h', '7d']).optional(),
    enforceMfaAdmin: z.boolean().optional(),
    srsGlobalRetentionTarget: z.number().int().min(70).max(95).optional(),
    srsInitialInterval: z.number().int().min(4).max(48).optional(),
    moderationInterval: z.number().int().min(1).max(24).optional(),
    aiModerationGuidelines: z.string().trim().max(5000).optional(),
    voiceAiSystemPrompt: z.string().trim().min(10).max(4000).optional(),
  }),
});

// ─── Reset Auth Schema ───────────────────────────────────────────────────────

export const resetUserAuthSchema = z.object({
  params: z.object({
    id: objectIdSchema('id'),
  }),
  body: z.object({
    email: z.string({ message: 'Email là bắt buộc' })
      .trim()
      .email('Email không đúng định dạng'),
  }),
});

