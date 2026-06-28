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

