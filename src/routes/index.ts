import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import adminRoutes from './admin.routes';

/**
 * Router gốc — Mount tất cả sub-routers vào đây
 *
 * Cấu trúc URL:
 *   /api/v1/auth/...  → auth.routes.ts
 *   /api/v1/user/...  → user.routes.ts
 *   /api/v1/admin/... → admin.routes.ts
 *
 * Khi thêm module mới (ví dụ: lessons, vocabulary...):
 *   1. Tạo file src/routes/lesson.routes.ts
 *   2. Import ở đây và thêm dòng: router.use('/lessons', lessonRoutes);
 */

const router = Router();

router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);

export default router;
