// ─────────────────────────────────────────────────────────────────────────────
// Stats Service — Phase 4-B
// ─────────────────────────────────────────────────────────────────────────────
import { Types } from 'mongoose';
import { LearningProgress } from '../models/LearningProgress';
import { DailyStats } from '../models/DailyStats';
import { UserProfile } from '../models/UserProfile';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tính current streak và longest streak dựa vào lịch sử DailyStats
 * Streak tính theo ngày liên tiếp có wordsReviewed > 0
 */
function calcStreak(stats: any[]): { current: number; longest: number } {
  let streak = 0;
  let longest = 0;
  const checkDate = new Date();
  checkDate.setHours(0, 0, 0, 0);

  for (const stat of stats) {
    const d = new Date(stat.date);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === checkDate.getTime() && stat.wordsReviewed > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      longest = Math.max(longest, streak);
    } else if (d < checkDate) {
      break;
    }
  }
  return { current: streak, longest };
}

/**
 * Ước tính trình độ dựa vào số từ đã thành thạo và accuracy
 */
function estimateLevel(mastered: number, accuracy: number): { estimated: string; confidence: number } {
  const brackets = [
    { level: 'A1', max: 500 },
    { level: 'A2', max: 1500 },
    { level: 'B1', max: 3000 },
    { level: 'B2', max: 5000 },
    { level: 'C1', max: 8000 },
    { level: 'C2', max: Infinity },
  ];
  const level = brackets.find((b) => mastered < b.max)?.level ?? 'C2';
  return { estimated: level, confidence: Math.min(100, Math.round(accuracy)) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Stats (Priority 1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /stats/dashboard — Tổng hợp stats chính: streak, mastery, accuracy, timeSpent
 */
export async function getDashboardStats(userId: string) {
  const userObjectId = new Types.ObjectId(userId);
  const now = new Date();
  const todayMidnight = new Date(now);
  todayMidnight.setHours(0, 0, 0, 0);

  const [masteredCount, totals, recentStats, todayStats, dueCount, profile] = await Promise.all([
    // Số từ đã mastered
    LearningProgress.countDocuments({ userId: userObjectId, status: 'mastered' }),

    // Tổng review, correct, timeSpent, newWords từ tất cả DailyStats
    DailyStats.aggregate([
      { $match: { userId: userObjectId } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: '$totalAnswers' },
          correctAnswers: { $sum: '$correctAnswers' },
          timeSpent: { $sum: '$timeSpent' },
          totalNew: { $sum: '$newWordsLearned' },
        },
      },
    ]),

    // Lịch sử gần nhất để tính streak (max 400 ngày ~1 năm)
    DailyStats.find({ userId: userObjectId })
      .sort({ date: -1 })
      .limit(400)
      .lean() as Promise<any[]>,

    // Stats hôm nay
    DailyStats.findOne({
      userId: userObjectId,
      date: { $gte: todayMidnight },
    }).lean(),

    // Số từ đến hạn ôn hôm nay
    LearningProgress.countDocuments({
      userId: userObjectId,
      status: { $ne: 'new' },
      nextReviewDate: { $lte: now },
    }),

    // User profile để lấy chỉ tiêu dailyGoal, reviewPerDay
    UserProfile.findOne({ userId: userObjectId }).lean(),
  ]);

  const { current: currentStreak, longest: longestStreak } = calcStreak(recentStats);

  const totalReviews = totals[0]?.totalReviews ?? 0;
  const correctAnswers = totals[0]?.correctAnswers ?? 0;
  const timeSpent = totals[0]?.timeSpent ?? 0;
  const accuracy = totalReviews > 0 ? Math.round((correctAnswers / totalReviews) * 100) : 0;

  const dailyGoal = profile?.dailyGoal ?? 10;
  const reviewPerDay = (profile as any)?.reviewPerDay ?? 20;

  const newWordsLearnedToday = todayStats?.newWordsLearned ?? 0;
  const wordsReviewedToday = todayStats?.wordsReviewed ?? 0;

  return {
    streak: { current: currentStreak, longest: longestStreak },
    totalWordsLearned: totals[0]?.totalNew ?? 0,
    masteredWords: masteredCount,
    totalReviews,
    overallAccuracy: accuracy,
    timeSpent: {
      totalSeconds: timeSpent,
      totalHours: Math.round((timeSpent / 3600) * 10) / 10,
    },
    currentLevel: estimateLevel(masteredCount, accuracy),
    dailyGoal,
    reviewPerDay,
    isNewGoalMet: newWordsLearnedToday >= dailyGoal,
    isReviewGoalMet: wordsReviewedToday >= reviewPerDay,
    todayStats: {
      newLearned: newWordsLearnedToday,
      reviewed: wordsReviewedToday,
      accuracy:
        todayStats && todayStats.totalAnswers > 0
          ? Math.round((todayStats.correctAnswers / todayStats.totalAnswers) * 100)
          : 0,
      dueCount,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily Stats (Priority 2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /stats/daily?days=30 — DailyStats per day, fill zeros cho ngày trống
 */
export async function getDailyStats(userId: string, days: number = 30) {
  const userObjectId = new Types.ObjectId(userId);
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const rawStats = await DailyStats.find({
    userId: userObjectId,
    date: { $gte: since },
  })
    .sort({ date: 1 })
    .lean() as any[];

  // Tạo map để lookup nhanh
  const statsMap = new Map<string, any>();
  for (const s of rawStats) {
    const key = new Date(s.date).toISOString().split('T')[0];
    statsMap.set(key, s);
  }

  // Fill zeros cho ngày không có data
  const result = [];
  const cursor = new Date(since);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  while (cursor <= today) {
    const key = cursor.toISOString().split('T')[0];
    const stat = statsMap.get(key);
    result.push({
      date: key,
      newWordsLearned: stat?.newWordsLearned ?? 0,
      wordsReviewed: stat?.wordsReviewed ?? 0,
      correctAnswers: stat?.correctAnswers ?? 0,
      totalAnswers: stat?.totalAnswers ?? 0,
      accuracy:
        stat && stat.totalAnswers > 0
          ? Math.round((stat.correctAnswers / stat.totalAnswers) * 100)
          : 0,
      timeSpent: stat?.timeSpent ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mastery Distribution (Priority 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /stats/mastery-distribution — GROUP BY word status
 */
export async function getMasteryDistribution(userId: string) {
  const userObjectId = new Types.ObjectId(userId);

  const distribution = await LearningProgress.aggregate([
    { $match: { userId: userObjectId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  // Khởi tạo tất cả status về 0
  const result: Record<string, number> = {
    new: 0,
    learning: 0,
    review: 0,
    mastered: 0,
  };

  for (const item of distribution) {
    if (item._id in result) {
      result[item._id as string] = item.count;
    }
  }

  const total = Object.values(result).reduce((sum, v) => sum + v, 0);

  return {
    new: result.new,
    learning: result.learning,
    review: result.review,
    mastered: result.mastered,
    total,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Heatmap (Priority 4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /stats/heatmap — 90 ngày wordsReviewed count cho heatmap calendar
 */
export async function getHeatmap(userId: string) {
  const userObjectId = new Types.ObjectId(userId);
  const since = new Date();
  since.setDate(since.getDate() - 89); // 90 ngày kể cả hôm nay
  since.setHours(0, 0, 0, 0);

  const rawStats = await DailyStats.find({
    userId: userObjectId,
    date: { $gte: since },
  })
    .select('date wordsReviewed')
    .sort({ date: 1 })
    .lean() as any[];

  // Trả về array dạng [{date, count}] — frontend tự vẽ heatmap
  return rawStats.map((s) => ({
    date: new Date(s.date).toISOString().split('T')[0],
    count: s.wordsReviewed,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Retention (Priority 5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /stats/retention — correctAnswers/totalAnswers per day trong 30 ngày
 */
export async function getRetention(userId: string, days: number = 30) {
  const userObjectId = new Types.ObjectId(userId);
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const rawStats = await DailyStats.find({
    userId: userObjectId,
    date: { $gte: since },
    totalAnswers: { $gt: 0 }, // Chỉ ngày có ôn tập
  })
    .sort({ date: 1 })
    .lean() as any[];

  return rawStats.map((s) => ({
    date: new Date(s.date).toISOString().split('T')[0],
    retention: Math.round((s.correctAnswers / s.totalAnswers) * 100),
    totalAnswers: s.totalAnswers,
    correctAnswers: s.correctAnswers,
  }));
}
