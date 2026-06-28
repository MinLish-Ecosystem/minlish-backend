import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string()
      .min(2, 'Name must be between 2 and 100 characters')
      .max(100, 'Name must be between 2 and 100 characters')
      .trim()
      .optional(),
    avatar: z.string()
      .trim()
      .refine(
        (val) => val === '' || val.startsWith('http') || val.startsWith('data:image/'),
        { message: 'Avatar must be a valid URL or Base64 image data' }
      )
      .optional()
      .nullable(),
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

export const updateLearningProfileSchema = z.object({
  body: z.object({
    learningGoal: z.enum(["ielts", "toeic", "business", "travel", "general", "other"]).optional(),
    targetLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).optional(),
    dailyGoal: z.number().min(1).max(100).optional(),
    reviewPerDay: z.number().min(1).max(200).optional(),
    reminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:mm)').optional(),
    timezone: z.string().optional(),
    preferences: z.object({
      pushNotification: z.boolean().optional(),
      emailNotification: z.boolean().optional(),
      soundEffect: z.boolean().optional(),
    }).optional(),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string({ message: 'Current password is required' })
      .min(6, 'Password must be at least 6 characters'),
    newPassword: z.string({ message: 'New password is required' })
      .min(6, 'Password must be at least 6 characters'),
  }),
});

export const verifyChangePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string({ message: 'Current password is required' })
      .min(6, 'Password must be at least 6 characters'),
    newPassword: z.string({ message: 'New password is required' })
      .min(6, 'Password must be at least 6 characters'),
    otp: z.string({ message: 'OTP is required' })
      .min(4, 'OTP must be at least 4 characters')
      .max(8, 'OTP cannot exceed 8 characters')
      .regex(/^\d+$/, 'OTP must contain only numbers'),
  }),
});
