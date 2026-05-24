import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { setupSwagger } from './config/swagger';
import router from './routes/index';
import { errorHandler } from './middlewares/error.middleware';

dotenv.config();

const app = express();

// ─── Middleware toàn cục ─────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Swagger UI ──────────────────────────────────────────────────────────────
setupSwagger(app);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/v1', router);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ message: '🚀 Minlish API is running!', version: '1.0.0' });
});

// ─── Error Handler (phải đặt CUỐI CÙNG) ─────────────────────────────────────
app.use(errorHandler);

export default app;
