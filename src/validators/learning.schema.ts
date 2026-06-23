import { z } from 'zod';

const objectIdSchema = (fieldName: string) =>
  z.string()
    .regex(/^[0-9a-fA-F]{24}$/, { message: `Invalid ${fieldName}` });

// ─── Queue Query Schema ──────────────────────────────────────────────────────

export const getQueueSchema = z.object({
  query: z.object({
    previewOnly: z.string()
      .optional()
      .transform(v => v === 'true' || v === '1'),
    timezone: z.string().optional(),
  }),
});

// ─── Submit Review Schema ────────────────────────────────────────────────────

export const submitReviewSchema = z.object({
  params: z.object({
    wordId: objectIdSchema('wordId'),
  }),
  body: z.object({
    setId: objectIdSchema('setId'),
    rating: z.enum(['again', 'hard', 'good', 'easy'], {
      message: 'Invalid rating value',
    }),
    timeSpent: z.coerce.number().int().min(0).optional(),
    reviewedAt: z.string()
      .refine(val => !isNaN(Date.parse(val)), {
        message: 'reviewedAt must be ISO8601 date format',
      })
      .optional(),
  }),
});

// ─── Set Param Schema ────────────────────────────────────────────────────────

export const setParamSchema = z.object({
  params: z.object({
    id: objectIdSchema('setId'),
  }),
});

// ─── Word Param Schema ───────────────────────────────────────────────────────

export const wordParamSchema = z.object({
  params: z.object({
    wordId: objectIdSchema('wordId'),
  }),
});

// ─── Batch Sync Schema ───────────────────────────────────────────────────────

export const batchSyncSchema = z.object({
  body: z.object({
    reviews: z.array(
      z.object({
        wordId: objectIdSchema('wordId in reviews'),
        setId: objectIdSchema('setId in reviews'),
        rating: z.enum(['again', 'hard', 'good', 'easy'], {
          message: 'Invalid rating in reviews',
        }),
        timeSpent: z.coerce.number().int().min(0).optional(),
        reviewedAt: z.string()
          .refine(val => !isNaN(Date.parse(val)), {
            message: 'reviewedAt must be ISO8601 date',
          })
          .optional(),
      })
    ).min(1, 'reviews must be an array'), // Đảm bảo reviews phải là mảng
  }),
});
