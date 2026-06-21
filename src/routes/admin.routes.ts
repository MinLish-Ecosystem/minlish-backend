import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middlewares/auth.middleware';
import { validateZod } from '../middlewares/validate.middleware';
import {
  banUserSchema,
  unpublishSetSchema,
  adminPaginationSchema,
  adminIdParamSchema,
} from '../validators/admin.schema';
import {
	listUsersController,
	getUserDetailController,
	banUserController,
	unbanUserController,
	deleteUserController,
	getAdminStatsController,
	listPublicSetsController,
	unpublishSetController,
	getReportsController,
	getAuditLogsController,
} from '../controllers/admin.controller';

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Quản trị hệ thống (chỉ Admin)
 */

const router = Router();

router.use(verifyToken, requireAdmin);

router.get('/users', validateZod(adminPaginationSchema), listUsersController);
router.get('/users/:id', validateZod(adminIdParamSchema), getUserDetailController);
router.put('/users/:id/ban', validateZod(banUserSchema), banUserController);
router.put('/users/:id/unban', validateZod(adminIdParamSchema), unbanUserController);
router.delete('/users/:id', validateZod(adminIdParamSchema), deleteUserController);

router.get('/stats', getAdminStatsController);
router.get('/sets', validateZod(adminPaginationSchema), listPublicSetsController);
router.put('/sets/:id/unpublish', validateZod(unpublishSetSchema), unpublishSetController);
router.get('/reports', getReportsController);
router.get('/audit-logs', getAuditLogsController);

export default router;
