import { z } from 'zod';

export const getStatsDaysSchema = z.object({
  query: z.object({
    days: z.preprocess(
      (val) => (val ? parseInt(val as string, 10) : undefined),
      z.number().int().min(1, 'days must be at least 1').max(3650, 'days cannot exceed 3650').optional()
    ),
  }),
});
