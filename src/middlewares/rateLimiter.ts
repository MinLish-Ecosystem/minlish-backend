import rateLimit from 'express-rate-limit';
import { Request } from 'express';

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

/**
 * UC-13 Voice AI — Rate limit tải weights (BA chốt 2026-08-29: 3 request/giờ/user)
 * Key theo user id (đã qua verifyToken) thay vì IP — FE dùng chung NAT/mạng công cộng
 */
export const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.id ?? req.ip ?? 'unknown',
  message: {
    success: false,
    errorCode: 'ERR_DOWNLOAD_RATE_LIMITED',
    message: 'Bạn đã vượt giới hạn tải (3 lần/giờ). Vui lòng thử lại sau.',
  },
});

/**
 * UC-13 Voice AI — Rate limit proxy STREAM weights (FR-104 Phase 2).
 * 1 lần bấm tải = tối đa 6 file stream (3 components × encoder/decoder) →
 * 20/giờ đủ headroom cho retry + đổi tier, vẫn chặn lạm dụng băng thông Mega.
 */
export const weightsStreamLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => req.user?.id ?? req.ip ?? 'unknown',
  message: {
    success: false,
    errorCode: 'ERR_DOWNLOAD_RATE_LIMITED',
    message: 'Bạn đã vượt giới hạn tải weights (20 lần/giờ). Vui lòng thử lại sau.',
  },
});
