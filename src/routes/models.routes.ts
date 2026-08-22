import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { verifyToken } from '../middlewares/auth.middleware';
import {
  listModels,
  getModel,
  getModelDownload,
} from '../controllers/models.controller';

const router = Router();

const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: 'Too many download attempts. Please wait an hour.',
  },
});

// Public routes
router.get('/', listModels);
router.get('/:id', getModel);

// Protected routes
router.use(verifyToken);
router.get('/download/:id', downloadLimiter, getModelDownload);

export default router;
