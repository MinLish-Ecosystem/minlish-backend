import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { sendError } from '../utils/response.util';
import { ErrorCodes } from '../constants/errorCodes';

/**
 * Middleware bắt lỗi từ express-validator
 * Đặt SAU các validator rules, TRƯỚC controller
 *
 * Cách dùng trong route:
 *   router.post('/login', loginValidator, validate, loginController);
 */
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    // Format lại danh sách lỗi thành mảng đơn giản
    const formattedErrors = errors.array().map((err) => ({
      field: err.type === 'field' ? err.path : 'unknown',
      message: err.msg,
    }));

    sendError(res, 'Validation failed', 422, ErrorCodes.VALIDATION_FAILED, formattedErrors);
    return;
  }

  next();
};
