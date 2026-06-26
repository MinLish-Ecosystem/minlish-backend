import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { setupSwagger } from './config/swagger';
import router from './routes/index';
import { errorHandler } from './middlewares/error.middleware';
import { checkMaintenanceMode } from './middlewares/maintenance.middleware';

dotenv.config();

const app = express();

// ─── CORS — Whitelist các origin được phép ────────────────────────────────────
// FRONTEND_URL set trên Render/Vercel dashboard, có thể nhiều URL cách nhau dấu phẩy
const rawOrigins = process.env.FRONTEND_URL || '';
const allowedOrigins: string[] = [
  'http://localhost:5173',  // Vite dev server
  'http://localhost:5174',  // Vite dev server (port thay thế)
  'http://localhost:3000',  // fallback local
  ...rawOrigins.split(',').map((o) => o.trim()).filter(Boolean),
];

// ─── Middleware toàn cục ─────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép requests không có origin (mobile app, Postman, curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Swagger UI ──────────────────────────────────────────────────────────────
setupSwagger(app);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use(checkMaintenanceMode);
app.use('/api/v1', router);

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({ message: '🚀 Minlish API is running!', version: '1.0.0' });
});

// ─── Error Handler (phải đặt CUỐI CÙNG) ─────────────────────────────────────
app.use(errorHandler);

export default app;
