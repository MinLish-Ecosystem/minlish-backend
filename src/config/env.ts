import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Định nghĩa schema cho các biến môi trường
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  
  // MongoDB
  MONGO_URI_LOCAL: z.string().optional(),
  MONGO_URI_ATLAS: z.string().optional(),
  
  // JWT
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // GMAIL SMTP
  MAIL_USER: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() : value),
    z.string().email()
  ),
  MAIL_PASS: z.preprocess(
    (value) => (typeof value === 'string' ? value.replace(/\s+/g, '').trim() : value),
    z.string().min(1)
  ),
}).refine(data => data.MONGO_URI_LOCAL || data.MONGO_URI_ATLAS, {
  message: "Either MONGO_URI_LOCAL or MONGO_URI_ATLAS must be provided",
  path: ["MONGO_URI"],
});

// Validate process.env
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Cấu hình môi trường (.env) không hợp lệ:');
  _env.error.issues.forEach(issue => {
    console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = _env.data;
