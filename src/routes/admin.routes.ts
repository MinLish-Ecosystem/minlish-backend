import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middlewares/auth.middleware';
import { body } from 'express-validator';
import {
	listUsersController,
	getUserDetailController,
	banUserController,
	unbanUserController,
	deleteUserController,
	getAdminStatsController,
	listPublicSetsController,
	unpublishSetController,
	getAuditLogsController,
	getReportsController,
} from '../controllers/admin.controller';

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Quản trị hệ thống (chỉ Admin)
 */

const router = Router();

router.use(verifyToken, requireAdmin);

router.get('/users', listUsersController);
router.get('/users/:id', getUserDetailController);
router.put('/users/:id/ban', [body('reason').notEmpty().withMessage('reason required')], banUserController);
router.put('/users/:id/unban', unbanUserController);
router.delete('/users/:id', deleteUserController);

router.get('/stats', getAdminStatsController);
router.get('/sets', listPublicSetsController);
router.put('/sets/:id/unpublish', [body('reason').optional().isString()], unpublishSetController);
router.get('/reports', getReportsController);
router.get('/audit-logs', getAuditLogsController);

export default router;
