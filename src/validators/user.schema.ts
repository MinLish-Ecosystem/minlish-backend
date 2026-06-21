import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string()
      .min(2, 'Name must be between 2 and 100 characters')
      .max(100, 'Name must be between 2 and 100 characters')
      .trim()
      .optional(),
    avatar: z.string()
      .url('Avatar must be a valid URL')
      .trim()
      .optional(),
  }),
});

export const requestEmailChangeSchema = z.object({
  body: z.object({
    newEmail: z.string({ message: 'New email is required' })
      .email('Please provide a valid email')
      .trim()
      .toLowerCase(),
  }),
});

export const confirmEmailChangeSchema = z.object({
  body: z.object({
    newEmail: z.string({ message: 'New email is required' })
      .email('Please provide a valid email')
      .trim()
      .toLowerCase(),
    otp: z.string({ message: 'OTP is required' })
      .length(6, 'OTP must be exactly 6 characters')
      .regex(/^\d+$/, 'OTP must contain only numbers'),
  }),
});
