/**
 * ─── Seed Script ─────────────────────────────────────────────────────────────
 * Tạo tài khoản mẫu để test chức năng đăng nhập và phân quyền.
 *
 * Chạy: npx ts-node src/scripts/seed.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';
import { User } from '../models/User';

dotenv.config();

// Fix DNS cho MongoDB Atlas (giống db.ts)
try {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
} catch (_) {}

// ─── Danh sách tài khoản mẫu ─────────────────────────────────────────────────
const SEED_USERS = [
  {
    name: 'Admin Minlish',
    email: 'admin@minlish.com',
    password: 'Admin@123',
    role: 'admin' as const,
    isVerified: true,
  },
  {
    name: 'Test User',
    email: 'user@minlish.com',
    password: 'User@123',
    role: 'user' as const,
    isVerified: true,
  },
  {
    name: 'Unverified User',
    email: 'unverified@minlish.com',
    password: 'User@123',
    role: 'user' as const,
    isVerified: false, // Test trường hợp chưa verify email
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  const mongoUri =
    process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL || '';

  if (!mongoUri) {
    console.error('✗ Không tìm thấy MONGO_URI trong .env');
    process.exit(1);
  }

  console.log('\n🌱 Bắt đầu seed dữ liệu mẫu...\n');

  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Đã kết nối database\n');

    for (const userData of SEED_USERS) {
      const existing = await User.findOne({ email: userData.email });

      if (existing) {
        console.log(`⚠  Đã tồn tại: ${userData.email} — bỏ qua`);
        continue;
      }

      const user = new User(userData);
      await user.save(); // pre-save hook sẽ tự hash password

      console.log(`✓  Đã tạo [${userData.role.toUpperCase()}]: ${userData.email}`);
    }

    console.log('\n─────────────────────────────────────────────');
    console.log('📋 Tài khoản test sẵn sàng:\n');
    console.log('  Role   │ Email                    │ Password');
    console.log('─────────┼──────────────────────────┼──────────────');
    console.log('  ADMIN  │ admin@minlish.com         │ Admin@123');
    console.log('  USER   │ user@minlish.com          │ User@123');
    console.log('  USER*  │ unverified@minlish.com    │ User@123');
    console.log('\n  * chưa verify email\n');
    console.log('─────────────────────────────────────────────\n');
  } catch (err: any) {
    console.error('✗ Seed thất bại:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Đã ngắt kết nối database');
  }
}

seed();
