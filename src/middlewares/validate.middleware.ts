import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { sendError } from '../utils/response.util';
import { ErrorCodes } from '../constants/errorCodes';

/**
 * Middleware validate request dùng Zod
 * Tự động coerce và ghi đè req.body, req.query, req.params bằng dữ liệu đã parsed thành công
 */
export const validateZod = (schema: ZodType) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  if (!result.success) {
    const errors = result.error.issues.map((e) => ({
      field: e.path.length > 1 ? e.path.slice(1).join('.') : String(e.path[0] || 'unknown'),
      message: e.message,
    }));

    sendError(res, 'Validation failed', 422, ErrorCodes.VALIDATION_FAILED, errors);
    return;
  }

  const data = result.data as any;
  if (data.body) req.body = data.body;
  if (data.query) req.query = data.query;
  if (data.params) req.params = data.params;

  next();
};
