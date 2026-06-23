import { z } from 'zod';

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.preprocess(
      (val) => (val ? parseInt(val as string, 10) : undefined),
      z.number().int().min(1, 'page must be at least 1').optional()
    ),
    limit: z.preprocess(
      (val) => (val ? parseInt(val as string, 10) : undefined),
      z.number().int().min(1, 'limit must be at least 1').max(100, 'limit cannot exceed 100').optional()
    ),
    type: z.enum(['srs_reminder', 'achievement', 'system']).optional(),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid notification id'),
  }),
});
