import rateLimit from 'express-rate-limit';

/**
 * Rate limiter cho Auth routes (login, register, forgot password)
 * Giới hạn: tối đa 10 request / 15 phút mỗi IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

/**
 * Rate limiter chung cho toàn bộ API
 * Giới hạn: tối đa 100 request / 15 phút mỗi IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please slow down.',
  },
});
