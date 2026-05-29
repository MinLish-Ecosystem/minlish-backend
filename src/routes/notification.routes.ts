import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware';
import {
  getNotificationsController,
  getUnreadCountController,
  markReadController,
  markAllReadController,
  deleteNotificationController,
} from '../controllers/notification.controller';

const router = Router();

router.get('/', verifyToken, getNotificationsController);
router.get('/unread-count', verifyToken, getUnreadCountController);
router.put('/:id/read', verifyToken, markReadController);
router.put('/read-all', verifyToken, markAllReadController);
router.delete('/:id', verifyToken, deleteNotificationController);

export default router;
