import { Queue, Worker } from 'bullmq';
import { UserProfile } from '../models/UserProfile';
import { User } from '../models/User';
import { getDueSummary } from './learning.service';
import { sendDailyReminderEmail } from './mail.service';
import { Notification } from '../models/Nofitication';

const REDIS_URL = process.env.REDIS_URL;
const REMINDER_QUEUE_NAME = 'daily-reminders';

export let reminderQueue: Queue | null = null;
export let reminderWorker: Worker | null = null;

const getLocalTimeInTimezone = (timezone: string): string => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    let formatted = formatter.format(new Date());
    if (formatted.startsWith('24:')) {
      formatted = '00:' + formatted.slice(3);
    }
    return formatted;
  } catch (error) {
    const date = new Date();
    const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
    const gmtPlus7 = new Date(utc + (3600000 * 7));
    const h = String(gmtPlus7.getHours()).padStart(2, '0');
    const m = String(gmtPlus7.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
};

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
    console.error('Invalid REDIS_URL:', error);
    return null;
  }
};

async function handleCheckReminders() {
  try {
    const allProfiles = await UserProfile.find({
      reminderTime: { $exists: true }
    }).lean();

    for (const profile of allProfiles) {
      const tz = profile.timezone || 'Asia/Ho_Chi_Minh';
      const localTime = getLocalTimeInTimezone(tz);

      if (localTime === profile.reminderTime) {
        const userId = profile.userId.toString();

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const recentNotification = await Notification.findOne({
          userId: profile.userId,
          type: 'daily_reminder',
          createdAt: { $gte: fiveMinutesAgo }
        }).lean();

        if (recentNotification) {
          continue;
        }

        const dueSummary = await getDueSummary(userId);
        const dueCount = dueSummary.dueReviewsCount;

        if (dueCount > 0) {
          // 1. In-App Notification
          await Notification.create({
            userId: profile.userId,
            type: 'daily_reminder',
            title: '⏰ Đến giờ ôn tập rồi!',
            message: `Bạn có ${dueCount} từ cần ôn tập hôm nay. Hãy học ngay để giữ chuỗi streak nhé!`,
            isRead: false,
          });

          // 2. Email Notification
          if (profile.preferences?.emailNotification) {
            const userDoc = await User.findById(profile.userId).lean();
            if (userDoc && userDoc.email) {
              try {
                await sendDailyReminderEmail(userDoc.email, userDoc.name, dueCount);
              } catch (err) {
                console.error(`Failed to send daily reminder email to ${userDoc.email}:`, err);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error running handleCheckReminders job:', error);
  }
}

export function initReminderWorker() {
  if (!REDIS_URL) {
    console.log('⚠ REDIS_URL not set in environment. Realtime background reminder worker is disabled.');
    return;
  }

  try {
    const redisOpts = parseRedisUrl(REDIS_URL);
    if (!redisOpts) {
      console.error('❌ Failed to parse REDIS_URL.');
      return;
    }

    reminderQueue = new Queue(REMINDER_QUEUE_NAME, { connection: redisOpts });

    reminderWorker = new Worker(
      REMINDER_QUEUE_NAME,
      async (job) => {
        if (job.name === 'check-reminders') {
          await handleCheckReminders();
        }
      },
      { connection: redisOpts, concurrency: 1 }
    );

    // Add repeatable job to run every minute
    reminderQueue.add(
      'check-reminders',
      {},
      {
        repeat: {
          pattern: '* * * * *',
        },
        jobId: 'check-reminders-job',
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    console.log('⏰ BullMQ Realtime Reminder Worker & Queue initialized successfully!');
  } catch (error) {
    console.error('❌ Failed to initialize BullMQ Reminder Worker:', error);
  }
}
