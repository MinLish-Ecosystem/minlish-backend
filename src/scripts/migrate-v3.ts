/**
 * ─── Migration Script v3 ──────────────────────────────────────────────────────
 * Khởi tạo giá trị mặc định cho các trường mới trong v3 trên database hiện tại.
 *
 * Chạy: npx ts-node src/scripts/migrate-v3.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { VocabularySet } from '../models/VocabularySet';
import { Word } from '../models/Word';

dotenv.config();

// Fix DNS cho MongoDB Atlas (giống db.ts)
try {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
} catch (_) {}

async function migrate() {
  const mongoUri =
    process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL || '';

  if (!mongoUri) {
    console.error('✗ Không tìm thấy MONGO_URI trong .env');
    process.exit(1);
  }

  console.log('\n⚙️ Bắt đầu chạy DB Migration v3...\n');

  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Đã kết nối database\n');

    // 1. Migrate User: isActive = true
    const userRes = await User.updateMany(
      { isActive: { $exists: false } },
      { $set: { isActive: true } }
    );
    console.log(`✓ Users updated: matched ${userRes.matchedCount}, modified ${userRes.modifiedCount}`);

    // 2. Migrate UserProfile: reviewPerDay = 20
    const profileRes = await UserProfile.updateMany(
      { reviewPerDay: { $exists: false } },
      { $set: { reviewPerDay: 20 } }
    );
    console.log(`✓ UserProfiles updated: matched ${profileRes.matchedCount}, modified ${profileRes.modifiedCount}`);

    // 3. Migrate VocabularySet: isDeleted = false
    const setRes = await VocabularySet.updateMany(
      { isDeleted: { $exists: false } },
      { $set: { isDeleted: false } }
    );
    console.log(`✓ VocabularySets updated: matched ${setRes.matchedCount}, modified ${setRes.modifiedCount}`);

    // 4. Migrate Word: isDeleted = false
    const wordRes = await Word.updateMany(
      { isDeleted: { $exists: false } },
      { $set: { isDeleted: false } }
    );
    console.log(`✓ Words updated: matched ${wordRes.matchedCount}, modified ${wordRes.modifiedCount}`);

    console.log('\n🎉 DB Migration v3 hoàn thành thành công!\n');
  } catch (err: any) {
    console.error('✗ Migration thất bại:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Đã ngắt kết nối database');
  }
}

migrate();
