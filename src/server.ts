import './config/env'; // Validate biến môi trường ngay khi khởi động

import app from './app';
import { connectDB } from './config/db';
import { verifyMailer } from './config/mailer';
import { cleanExpiredTokens } from './utils/tokenBlacklist';

const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// ─── Dev Banner: In tài khoản test khi khởi động ──────────────────────────────
function printDevBanner() {
  if (!isDev) return;
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║           🧪  TÀI KHOẢN TEST (DEV ONLY)          ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Role    │ Email                  │ Password      ║');
  console.log('║──────────┼────────────────────────┼───────────────║');
  console.log('║  ADMIN   │ admin@minlish.com       │ Admin@123     ║');
  console.log('║  USER    │ user@minlish.com        │ User@123      ║');
  console.log('║  USER*   │ unverified@minlish.com  │ User@123      ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  * chưa verify email                             ║');
  console.log('║  Chạy `npm run seed` nếu chưa có tài khoản      ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
}

const startServer = async () => {
  try {
    await connectDB();
    await verifyMailer();
    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
      console.log(`📚 Swagger UI: http://localhost:${PORT}/api-docs`);
      printDevBanner();
      
      // Chạy dọn dẹp blacklist mỗi 1 giờ
      setInterval(cleanExpiredTokens, 60 * 60 * 1000);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

