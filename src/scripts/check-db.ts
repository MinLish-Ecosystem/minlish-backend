/**
 * ─── Check DB Script (READ-ONLY) ─────────────────────────────────────────────
 * Kiểm tra dữ liệu hiện tại trong MongoDB Atlas.
 * Script này KHÔNG ghi, KHÔNG xóa bất kỳ dữ liệu nào.
 *
 * Chạy: npx ts-node --transpile-only src/scripts/check-db.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'node:dns';

dotenv.config();

try { dns.setServers(['1.1.1.1', '8.8.8.8']); } catch (_) {}

// Import models
import { User } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { VocabularySet } from '../models/VocabularySet';
import { Word } from '../models/Word';
import { LearningProgress } from '../models/LearningProgress';
import { DailyStats } from '../models/DailyStats';
import { FCMToken } from '../models/FCMToken';
import { Notification } from '../models/Nofitication';
import { AdminAuditLog } from '../models/AdminAuditLog';

async function checkDb() {
  const mongoUri = process.env.MONGO_URI_ATLAS || process.env.MONGO_URI_LOCAL || '';

  if (!mongoUri) {
    console.error('✗ Không tìm thấy MONGO_URI trong .env');
    process.exit(1);
  }

  console.log('\n🔍 Đang kiểm tra dữ liệu trong MongoDB Atlas...\n');
  console.log(`📡 URI: ${mongoUri.replace(/:([^@]+)@/, ':****@')}\n`);

  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Kết nối thành công\n');
    console.log('═'.repeat(60));

    // ─── 1. Users ──────────────────────────────────────────────────
    const totalUsers = await User.countDocuments();
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const activeUsers = await User.countDocuments({ isActive: { $ne: false } });
    const verifiedUsers = await User.countDocuments({ isVerified: true });

    console.log('\n👤 USERS');
    console.log(`   Tổng: ${totalUsers} | Admin: ${adminUsers} | Active: ${activeUsers} | Verified: ${verifiedUsers}`);

    if (totalUsers > 0) {
      const sampleUsers = await User
        .find()
        .select('name email role isVerified isActive createdAt')
        .sort({ createdAt: 1 })
        .limit(5)
        .lean();
      console.log('   Mẫu (5 đầu tiên):');
      sampleUsers.forEach(u => {
        const flags = [
          u.role === 'admin' ? '👑 ADMIN' : '👤 USER',
          u.isVerified ? '✓verified' : '✗unverified',
          (u as any).isActive === false ? '🔴banned' : '🟢active',
        ].join(' ');
        console.log(`     • ${u.email} — ${u.name} [${flags}]`);
      });
      if (totalUsers > 5) console.log(`     ... và ${totalUsers - 5} user khác`);
    }

    // ─── 2. UserProfiles ───────────────────────────────────────────
    const totalProfiles = await UserProfile.countDocuments();
    console.log('\n📋 USER PROFILES');
    console.log(`   Tổng: ${totalProfiles} (${totalUsers - totalProfiles} users chưa có profile)`);

    // ─── 3. VocabularySets ─────────────────────────────────────────
    const totalSets = await VocabularySet.countDocuments();
    const publicSets = await VocabularySet.countDocuments({ isPublic: true, isDeleted: { $ne: true } });
    const deletedSets = await VocabularySet.countDocuments({ isDeleted: true });

    console.log('\n📚 VOCABULARY SETS');
    console.log(`   Tổng: ${totalSets} | Public: ${publicSets} | Deleted: ${deletedSets}`);

    if (totalSets > 0) {
      const sampleSets = await VocabularySet
        .find({ isDeleted: { $ne: true } })
        .select('name category level isPublic totalWords userId createdAt')
        .sort({ createdAt: 1 })
        .limit(8)
        .lean();
      console.log('   Danh sách sets:');
      sampleSets.forEach(s => {
        const pub = s.isPublic ? '🌐 public' : '🔒 private';
        console.log(`     • [${pub}] "${s.name}" — ${s.category}/${s.level} — ${s.totalWords} từ`);
      });
      if (totalSets > 8) console.log(`     ... và ${totalSets - 8} set khác`);
    }

    // ─── 4. Words ──────────────────────────────────────────────────
    const totalWords = await Word.countDocuments();
    const activeWords = await Word.countDocuments({ isDeleted: { $ne: true } });
    const deletedWords = await Word.countDocuments({ isDeleted: true });
    const wordsWithAudio = await Word.countDocuments({ audioUrl: { $exists: true, $nin: [null, ''] } });
    const wordsWithImage = await Word.countDocuments({ imageUrl: { $exists: true, $nin: [null, ''] } });

    console.log('\n📝 WORDS');
    console.log(`   Tổng: ${totalWords} | Active: ${activeWords} | Deleted: ${deletedWords}`);
    console.log(`   Có audioUrl: ${wordsWithAudio} | Có imageUrl: ${wordsWithImage}`);

    // ─── 5. Learning Progress ──────────────────────────────────────
    const totalProgress = await LearningProgress.countDocuments();
    const masteredCount = await LearningProgress.countDocuments({ status: 'mastered' });
    const learningCount = await LearningProgress.countDocuments({ status: 'learning' });
    const reviewCount   = await LearningProgress.countDocuments({ status: 'review' });

    console.log('\n🎯 LEARNING PROGRESS');
    console.log(`   Tổng records: ${totalProgress}`);
    console.log(`   Mastered: ${masteredCount} | Learning: ${learningCount} | Review: ${reviewCount}`);

    // ─── 6. DailyStats ─────────────────────────────────────────────
    const totalStats = await DailyStats.countDocuments();
    const statsResult = await DailyStats.aggregate([
      { $group: { _id: null, totalReviewed: { $sum: '$wordsReviewed' }, totalNew: { $sum: '$newWordsLearned' } } }
    ]);

    console.log('\n📊 DAILY STATS');
    console.log(`   Tổng records: ${totalStats} ngày`);
    if (statsResult.length > 0) {
      console.log(`   Tổng từ đã ôn: ${statsResult[0].totalReviewed} | Tổng từ mới: ${statsResult[0].totalNew}`);
    }

    // ─── 7. Notifications ──────────────────────────────────────────
    const totalNotifs = await Notification.countDocuments();
    const unreadNotifs = await Notification.countDocuments({ isRead: false });

    console.log('\n🔔 NOTIFICATIONS');
    console.log(`   Tổng: ${totalNotifs} | Chưa đọc: ${unreadNotifs}`);

    // ─── 8. FCM Tokens ─────────────────────────────────────────────
    const totalFCM = await FCMToken.countDocuments();
    console.log('\n📱 FCM TOKENS');
    console.log(`   Tổng thiết bị đăng ký: ${totalFCM}`);

    // ─── 9. Audit Logs ─────────────────────────────────────────────
    const totalAudit = await AdminAuditLog.countDocuments();
    console.log('\n🗃️  AUDIT LOGS');
    console.log(`   Tổng: ${totalAudit}`);

    // ─── Summary ───────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('\n✅ TỔNG KẾT — Dữ liệu hiện tại trong Atlas:\n');
    const summary = [
      ['Collection', 'Số records'],
      ['users', String(totalUsers)],
      ['userprofiles', String(totalProfiles)],
      ['vocabularysets', String(totalSets)],
      ['words', String(totalWords)],
      ['learningprogresses', String(totalProgress)],
      ['dailystats', String(totalStats)],
      ['notifications', String(totalNotifs)],
      ['fcmtokens', String(totalFCM)],
      ['adminauditlogs', String(totalAudit)],
    ];
    summary.forEach(([col, count], i) => {
      if (i === 0) console.log(`   ${'Collection'.padEnd(22)} Records`);
      else console.log(`   ${col.padEnd(22)} ${count}`);
    });
    console.log('');

    const isEmpty = totalUsers === 0 && totalWords === 0;
    if (isEmpty) {
      console.log('   💡 Database trống — có thể chạy seed an toàn\n');
    } else {
      console.log('   ⚠️  Database đã có dữ liệu — seed script nên dùng upsert (bỏ qua bản ghi đã tồn tại)\n');
    }

  } catch (err: any) {
    console.error('✗ Lỗi:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Đã ngắt kết nối\n');
  }
}

checkDb();
