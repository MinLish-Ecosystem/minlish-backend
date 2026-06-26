import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.util';

import { AppError } from '../utils/AppError';
import { ErrorCodes } from '../constants/errorCodes';

/**
 * Global Error Handler Middleware
 * Phải đặt CUỐI CÙNG trong app.ts (sau tất cả routes)
 */
export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log lỗi chi tiết (trên môi trường dev hoặc test)
  if (process.env.NODE_ENV !== 'test') {
    console.error('❌ Error caught by Middleware:', err);
  }

  // 1. Xử lý lỗi do AppError ném ra (Lỗi nghiệp vụ đã dự tính)
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode, err.errorCode);
    return;
  }

  // 2. Xử lý lỗi từ MongoDB / Mongoose
  // Lỗi Duplicate Key (ví dụ: email đã tồn tại)
  if (err.code === 11000) {
    let message = "";
    if (err.keyValue && err.keyValue.setId && err.keyValue.word !== undefined) {
      message = `Word "${err.keyValue.word}" already exists in this vocabulary set.`;
    } else {
      const field = Object.keys(err.keyValue)[0];
      message = `${field} already exists. Please use another value.`;
    }
    sendError(res, message, 409, ErrorCodes.VALIDATION_FAILED);
    return;
  }
  
  // Lỗi CastError (ID không hợp lệ)
  if (err.name === 'CastError') {
    sendError(res, 'Invalid ID format', 400, ErrorCodes.VALIDATION_FAILED);
    return;
  }

  // 3. Xử lý lỗi hệ thống chưa biết (Lỗi crash, lỗi 500)
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const errorCode = err.errorCode || ErrorCodes.INTERNAL_ERROR;

  // Ẩn chi tiết lỗi nội bộ trên môi trường production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    sendError(res, 'Internal Server Error', 500, errorCode);
  } else {
    sendError(res, message, statusCode, errorCode);
  }
};
