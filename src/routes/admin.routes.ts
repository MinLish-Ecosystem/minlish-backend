import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middlewares/auth.middleware';

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Quản trị hệ thống (chỉ Admin)
 */

const router = Router();

// Tất cả admin routes đều cần: verifyToken + requireAdmin
// TODO: Thêm các admin routes khi phát triển tính năng quản trị

// Ví dụ:
// router.get('/users', verifyToken, requireAdmin, getAllUsers);
// router.delete('/users/:id', verifyToken, requireAdmin, deleteUser);

export default router;
