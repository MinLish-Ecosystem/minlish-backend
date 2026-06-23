import { z } from 'zod';

export const getStatsDaysSchema = z.object({
  query: z.object({
    days: z.preprocess(
      (val) => (val ? parseInt(val as string, 10) : undefined),
      z.number().int().min(7, 'days must be at least 7').max(365, 'days cannot exceed 365').optional()
    ),
  }),
});
