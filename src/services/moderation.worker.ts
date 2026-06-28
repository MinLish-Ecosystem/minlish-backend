import { Queue, Worker } from 'bullmq';
import { getOrCreateSystemConfig } from '../models/SystemConfig';
import { runAutoModerationBatch, runAutoModerationPostsBatch } from './moderation.service';
import { VocabularySet } from '../models/VocabularySet';
import { Post } from '../models/Post';

const REDIS_URL = process.env.REDIS_URL;
const MODERATION_QUEUE_NAME = 'auto-moderation';

export let moderationQueue: Queue | null = null;
export let moderationWorker: Worker | null = null;

// Lưu trữ timer fallback cho môi trường không có Redis (dev mode)
let fallbackTimerId: NodeJS.Timeout | null = null;

const parseRedisUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username || undefined,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  } catch (error) {
    console.error('Invalid REDIS_URL for Moderation Worker:', error);
    return null;
  }
};

/**
 * Khởi chạy Worker kiểm duyệt tự động lúc server boot.
 */
export async function initModerationWorker() {
  // Sync legacy public sets and posts without moderationStatus to 'approved'
  try {
    const setsSync = await VocabularySet.updateMany(
      { isPublic: true, moderationStatus: { $exists: false } },
      { $set: { moderationStatus: 'approved' } }
    );
    const postsSync = await Post.updateMany(
      { isPublic: true, moderationStatus: { $exists: false } },
      { $set: { moderationStatus: 'approved' } }
    );
    if (setsSync.modifiedCount > 0 || postsSync.modifiedCount > 0) {
      console.log(`[Moderation Boot Sync] Synced legacy data: ${setsSync.modifiedCount} sets, ${postsSync.modifiedCount} posts.`);
    }
  } catch (err) {
    console.error('[Moderation Boot Sync] Failed to sync legacy public content:', err);
  }

  const config = await getOrCreateSystemConfig();
  const interval = config.moderationInterval || 3;

  if (!REDIS_URL) {
    console.log(`⚠ REDIS_URL not set. Auto-moderation will run in local fallback mode (Timer: every ${interval} hour(s)).`);
    
    // Khởi chạy đợt duyệt thô lúc boot (chạy bất đồng bộ)
    runAutoModerationBatch().catch(err => console.error('Error in fallback moderation boot run:', err));
    runAutoModerationPostsBatch().catch(err => console.error('Error in fallback post moderation boot run:', err));

    // Thiết lập timer lặp
    fallbackTimerId = setInterval(() => {
      console.log('[Auto Moderation Fallback] Running periodic auto-moderation batch...');
      runAutoModerationBatch().catch(err => console.error('Error in fallback moderation run:', err));
      runAutoModerationPostsBatch().catch(err => console.error('Error in fallback post moderation run:', err));
    }, interval * 60 * 60 * 1000);

    return;
  }

  try {
    const redisOpts = parseRedisUrl(REDIS_URL);
    if (!redisOpts) {
      console.error('❌ Failed to parse REDIS_URL for moderation worker.');
      return;
    }

    moderationQueue = new Queue(MODERATION_QUEUE_NAME, { connection: redisOpts });

    moderationWorker = new Worker(
      MODERATION_QUEUE_NAME,
      async (job) => {
        if (job.name === 'run-moderation-batch') {
          console.log('[Moderation Worker] Starting auto-moderation batch job...');
          await runAutoModerationBatch();
          await runAutoModerationPostsBatch();
        }
      },
      { connection: redisOpts, concurrency: 1 }
    );

    // Xóa job lặp cũ nếu có và lên lịch chạy mới
    await rescheduleModerationJob(interval);

    console.log(`⏰ BullMQ Auto-Moderation Worker & Queue initialized successfully! Cycle: ${interval}h`);

    // Duyệt nhanh lúc khởi động để xử lý các bộ từ đang ứ đọng
    runAutoModerationBatch().catch(err => console.error('Error in boot moderation run:', err));
    runAutoModerationPostsBatch().catch(err => console.error('Error in boot post moderation run:', err));

  } catch (error) {
    console.error('❌ Failed to initialize BullMQ Moderation Worker:', error);
  }
}

/**
 * Lên lịch lại thời gian chạy kiểm duyệt tự động khi Admin thay đổi cài đặt.
 */
export async function rescheduleModerationJob(intervalHours: number): Promise<void> {
  console.log(`[Moderation Worker] Rescheduling job to run every ${intervalHours} hour(s)...`);

  // 1. Trường hợp dùng timer fallback
  if (!REDIS_URL) {
    if (fallbackTimerId) {
      clearInterval(fallbackTimerId);
    }
    fallbackTimerId = setInterval(() => {
      console.log('[Auto Moderation Fallback] Running periodic auto-moderation batch...');
      runAutoModerationBatch().catch(err => console.error('Error in fallback moderation run:', err));
      runAutoModerationPostsBatch().catch(err => console.error('Error in fallback post moderation run:', err));
    }, intervalHours * 60 * 60 * 1000);
    console.log(`[Moderation Worker] Fallback timer successfully rescheduled to every ${intervalHours} hour(s).`);
    return;
  }

  // 2. Trường hợp dùng BullMQ
  if (!moderationQueue) return;

  try {
    // Tìm các job lặp hiện tại của moderation-queue
    const repeatableJobs = await moderationQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      if (job.name === 'run-moderation-batch') {
        // Xóa cấu hình lặp cũ
        await moderationQueue.removeRepeatableByKey(job.key);
        console.log(`[Moderation Worker] Removed old repeatable job key: ${job.key}`);
      }
    }

    // Cron pattern chạy mỗi X tiếng: '0 */X * * *'
    const cronPattern = `0 */${intervalHours} * * *`;

    // Thêm job lặp mới
    await moderationQueue.add(
      'run-moderation-batch',
      {},
      {
        repeat: {
          pattern: cronPattern,
        },
        jobId: 'run-moderation-batch-job',
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    console.log(`[Moderation Worker] BullMQ repeatable job rescheduled with cron pattern: "${cronPattern}"`);
  } catch (error) {
    console.error('[Moderation Worker] Failed to reschedule repeatable job:', error);
  }
}
