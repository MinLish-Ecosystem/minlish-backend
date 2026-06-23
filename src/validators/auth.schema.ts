import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string({ message: 'Email is required' })
      .email('Please provide a valid email')
      .trim()
      .toLowerCase(),
    password: z.string({ message: 'Password is required' })
      .min(6, 'Password must be at least 6 characters'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    name: z.string({ message: 'Name is required' })
      .min(2, 'Name must be between 2 and 100 characters')
      .max(100, 'Name must be between 2 and 100 characters')
      .trim(),
    email: z.string({ message: 'Email is required' })
      .email('Please provide a valid email')
      .trim()
      .toLowerCase(),
    password: z.string({ message: 'Password is required' })
      .min(6, 'Password must be at least 6 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z.string({ message: 'Email is required' })
      .email('Please provide a valid email')
      .trim()
      .toLowerCase(),
    otp: z.string({ message: 'OTP is required' })
      .length(6, 'OTP must be exactly 6 characters')
      .regex(/^\d+$/, 'OTP must contain only numbers'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string({ message: 'Email is required' })
      .email('Please provide a valid email')
      .trim()
      .toLowerCase(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string({ message: 'Email is required' })
      .email('Please provide a valid email')
      .trim()
      .toLowerCase(),
    otp: z.string({ message: 'OTP is required' })
      .length(6, 'OTP must be exactly 6 characters')
      .regex(/^\d+$/, 'OTP must contain only numbers'),
    newPassword: z.string({ message: 'New password is required' })
      .min(6, 'Password must be at least 6 characters')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  }),
});
