import { Response } from 'express';

interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  errorCode?: string; // Bổ sung errorCode cho Mobile dễ parse
  data?: T;
  meta?: Record<string, any>;
  errors?: any;
}

/**
 * Trả về response thành công chuẩn hóa
 */
export const sendSuccess = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200,
  meta?: Record<string, any>
): Response => {
  const body: ApiResponse<T> = { success: true, message };
  if (data !== undefined && data !== null) body.data = data;
  if (meta !== undefined && meta !== null) body.meta = meta;
  return res.status(statusCode).json(body);
};

/**
 * Trả về response lỗi chuẩn hóa
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 500,
  errorCode?: string,
  errors?: any
): Response => {
  const body: ApiResponse = { success: false, message };
  if (errorCode) body.errorCode = errorCode;
  if (errors !== undefined) body.errors = errors;
  return res.status(statusCode).json(body);
};
