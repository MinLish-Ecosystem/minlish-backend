import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';
import { isBlacklisted } from '../utils/tokenBlacklist';
import { AppError } from '../utils/AppError';
import { ErrorCodes } from '../constants/errorCodes';
import { HttpStatus } from '../constants/httpStatus';
import { User } from '../models/User';

/**
 * Middleware xác thực Access Token
 * Gắn vào bất kỳ route nào cần đăng nhập
 */
export const verifyToken = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    // Kiểm tra header có tồn tại và đúng format "Bearer <token>"
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Access denied. No token provided.', HttpStatus.UNAUTHORIZED, ErrorCodes.TOKEN_MISSING);
    }

    const token = authHeader.split(' ')[1];
    
    // Kiểm tra token có nằm trong blacklist không (đã logout)
    if (isBlacklisted(token)) {
      throw new AppError('Token has been revoked. Please log in again.', HttpStatus.UNAUTHORIZED, ErrorCodes.TOKEN_REVOKED);
    }

    const payload = verifyAccessToken(token);

    // Gắn thông tin user vào request để controller dùng
    req.user = {
      _id: payload.userId as any,
      id: payload.userId,
      email: payload.email,
      role: payload.role as any,
      name: '',
    };

    next();
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      next(new AppError('Token has expired. Please refresh your token.', HttpStatus.UNAUTHORIZED, ErrorCodes.TOKEN_EXPIRED));
    } else if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Invalid token.', HttpStatus.UNAUTHORIZED, ErrorCodes.TOKEN_INVALID));
    }
  }
};

/**
 * Middleware kiểm tra quyền Admin
 * PHẢI đặt SAU verifyToken
 */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    return next(new AppError('Access denied. Admin role required.', HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN));
  }
  next();
};

/**
 * Middleware gating Learner cho tính năng học (UC-14 Reading, FR-110/FR-114).
 * PHẢI đặt SAU verifyToken. JWT payload không chứa isVerified/isActive
 * → phải tra DB để chặn tài khoản chưa xác thực hoặc bị ban (api-spec UC-14 §Common).
 */
export const verifyLearner = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.id) {
      return next(new AppError('Access denied. No token provided.', HttpStatus.UNAUTHORIZED, ErrorCodes.TOKEN_MISSING));
    }
    const user = await User.findById(req.user.id).select('isVerified isActive').lean();
    if (!user) {
      return next(new AppError('User not found.', HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED));
    }
    if (!user.isVerified) {
      return next(new AppError('Email not verified.', HttpStatus.FORBIDDEN, ErrorCodes.EMAIL_NOT_VERIFIED));
    }
    if (!user.isActive) {
      return next(new AppError('Account has been banned.', HttpStatus.FORBIDDEN, ErrorCodes.USER_BANNED));
    }
    next();
  } catch (error) {
    next(error);
  }
};
