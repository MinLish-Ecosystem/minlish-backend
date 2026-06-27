import { Request, Response, NextFunction } from 'express';
import { getOrCreateSystemConfig } from '../models/SystemConfig';
import { verifyAccessToken } from '../utils/jwt.util';
import { AppError } from '../utils/AppError';
import { HttpStatus } from '../constants/httpStatus';

export const checkMaintenanceMode = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  // Bỏ qua kiểm tra cho các route Admin, Auth hoặc Swagger
  if (
    req.path.startsWith('/api/v1/admin') ||
    req.path.startsWith('/api/v1/auth') ||
    req.path === '/' ||
    req.path.startsWith('/api-docs')
  ) {
    return next();
  }

  try {
    const config = await getOrCreateSystemConfig();
    
    if (config.maintenanceMode) {
      const authHeader = req.headers.authorization;
      
      // Nếu có token, giải mã thử xem có phải Admin không
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const payload = verifyAccessToken(token);
          if (payload && payload.role === 'admin') {
            // Cho phép Admin qua ngay cả khi bảo trì
            return next();
          }
        } catch (e) {
          // Bỏ qua lỗi verify token ở đây, sẽ bị bắt bởi verifyToken middleware sau
        }
      }

      // Block các user thường
      return next(
        new AppError(
          'Hệ thống đang bảo trì để nâng cấp. Vui lòng quay lại sau.',
          HttpStatus.SERVICE_UNAVAILABLE,
          'MAINTENANCE_MODE'
        )
      );
    }
  } catch (error) {
    console.error('[Maintenance Middleware] Error checking status:', error);
  }

  return next();
};
