import { Request, Response, NextFunction } from 'express';
import { ZodType } from 'zod';
import { sendError } from '../utils/response.util';
import { ErrorCodes } from '../constants/errorCodes';

/**
 * Middleware validate request dùng Zod
 * Tự động coerce và ghi đè req.body, req.query, req.params bằng dữ liệu đã parsed thành công
 *
 * @param statusCode - HTTP status khi validate fail (mặc định 422 theo convention hiện có;
 *   UC-14 truyền 400 để khớp api-spec riêng)
 */
export const validateZod =
  (schema: ZodType, statusCode: number = 422) =>
  (req: Request, res: Response, next: NextFunction): void => {
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

      sendError(res, 'Validation failed', statusCode, ErrorCodes.VALIDATION_FAILED, errors);
      return;
    }

    const data = result.data as any;
    if (data.body) req.body = data.body;
    if (data.query) req.query = data.query;
    if (data.params) req.params = data.params;

    next();
  };
