import { z } from 'zod';

export const deltaSyncSchema = z.object({
  query: z.object({
    lastSyncAt: z.string()
      .refine(val => !isNaN(Date.parse(val)), {
        message: 'lastSyncAt must be ISO8601 date-time format',
      })
      .optional(),
  }),
});
