import { Types } from "mongoose";
import { LearningProgress } from "../models/LearningProgress";
import { VocabularySet } from "../models/VocabularySet";
import { Word } from "../models/Word";
import { UserProfile } from "../models/UserProfile";
import { DailyStats } from "../models/DailyStats";
import { applyReview } from "../utils/sm2";
import { AppError } from "../utils/AppError";
import { HttpStatus } from "../constants/httpStatus";
import { ErrorCodes } from "../constants/errorCodes";
import {
  LearningQueueFilters,
  LearningQueueResponse,
  DueSummaryResponse,
  SubmitReviewDTO,
  SubmitReviewResponse,
  SetProgressSummary,
  WordSRSProgress,
  LearningCard,
  QueueSummary
} from "../types/learning.types";

/**
 * 1. Lấy nhanh tóm tắt số từ đến hạn học và ôn tập hôm nay (Badge count)
 */
export async function getDueSummary(userId: string): Promise<DueSummaryResponse> {
  const userObjectId = new Types.ObjectId(userId);
  const now = new Date();

  // Đọc User Profile cấu hình để lấy chỉ tiêu
  const profile = await UserProfile.findOne({ userId: userObjectId }).lean();
  const dailyGoal = profile?.dailyGoal ?? 10;
  const reviewPerDay = (profile as any)?.reviewPerDay ?? 20;

  // 1. Đếm từ cần ôn tập đến hạn
  const dueReviewsCount = await LearningProgress.countDocuments({
    userId: userObjectId,
    status: { $ne: "new" },
    nextReviewDate: { $lte: now }
  });

  // 2. Đếm từ mới chưa từng học (thuộc các bộ từ trong library của user)
  const userSetIds = await VocabularySet.find({
    userId: userObjectId,
    isDeleted: { $ne: true }
  }).distinct("_id");

  const newWordsCountResult = await Word.aggregate([
    { $match: { setId: { $in: userSetIds }, isDeleted: { $ne: true } } },
    {
      $lookup: {
        from: "learningprogresses",
        let: { wordId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$wordId", "$$wordId"] },
                  { $eq: ["$userId", userObjectId] }
                ]
              }
            }
          }
        ],
        as: "progress"
      }
    },
    { $match: { "progress.0": { $exists: false } } }, // Words chưa có tiến trình học
    { $count: "count" }
  ]);

  const rawNewWordsCount = newWordsCountResult[0]?.count ?? 0;

  // Áp dụng giới hạn hàng ngày để ra badge thực tế hiển thị
  const actualNew = Math.min(dailyGoal, rawNewWordsCount);
  const actualReview = Math.min(reviewPerDay, dueReviewsCount);

  return {
    newWordsCount: actualNew,
    dueReviewsCount: actualReview,
    totalDueCount: actualNew + actualReview
  };
}

/**
 * 2. Lấy hàng đợi từ vựng học và ôn tập hôm nay (Global queue)
 * Tối ưu hóa JOIN qua $lookup để tránh N+1 và loại bỏ hoàn toàn dùng $nin với mảng lớn.
 */
export async function getLearningQueue(
  userId: string,
  filters: LearningQueueFilters
): Promise<LearningQueueResponse> {
  const userObjectId = new Types.ObjectId(userId);
  const now = new Date();

  // Đọc chỉ tiêu hàng ngày của User
  const profile = await UserProfile.findOne({ userId: userObjectId }).lean();
  const dailyGoal = profile?.dailyGoal ?? 10;
  const reviewPerDay = (profile as any)?.reviewPerDay ?? 20;

  // Lấy các SetId trong thư viện để chỉ học các từ thuộc thư viện cá nhân
  const userSetIds = await VocabularySet.find({
    userId: userObjectId,
    isDeleted: { $ne: true }
  }).distinct("_id");

  // ─── PHẦN 1: QUÂN BÀI CẦN ÔN (REVIEW CARDS) ───
  const reviewProgress = await LearningProgress.find({
    userId: userObjectId,
    setId: { $in: userSetIds },
    status: { $ne: "new" },
    nextReviewDate: { $lte: now }
  })
    .sort({ nextReviewDate: 1 })
    .limit(reviewPerDay)
    .populate("wordId")
    .populate("setId", "name colorTheme")
    .lean();

  // ─── PHẦN 2: QUÂN BÀI MỚI (NEW CARDS) ───
  // Dùng $lookup loại trừ tiến trình đã học, cực kỳ nhanh chóng và an toàn hiệu năng
  const newWords = await Word.aggregate([
    { $match: { setId: { $in: userSetIds }, isDeleted: { $ne: true } } },
    {
      $lookup: {
        from: "learningprogresses",
        let: { wordId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$wordId", "$$wordId"] },
                  { $eq: ["$userId", userObjectId] }
                ]
              }
            }
          }
        ],
        as: "progress"
      }
    },
    { $match: { "progress.0": { $exists: false } } }, // Chỉ lấy từ chưa học
    { $limit: dailyGoal }
  ]);

  const summary: QueueSummary = {
    newCount: newWords.length,
    reviewCount: reviewProgress.length,
    totalToday: newWords.length + reviewProgress.length,
    estimatedMinutes: Math.ceil(newWords.length * 2 + reviewProgress.length * 1.2)
  };

  if (filters.previewOnly) {
    return { newCards: [], reviewCards: [], summary };
  }

  // Lấy map bối cảnh bộ từ vựng
  const setMap = new Map(
    (await VocabularySet.find({ _id: { $in: userSetIds } }).select("name colorTheme").lean())
      .map((s) => [s._id.toString(), s])
  );

  const newCards: LearningCard[] = newWords.map((w) => ({
    id: w._id.toString(),
    word: w.word,
    pronunciation: w.pronunciation,
    partOfSpeech: w.partOfSpeech,
    meaning: w.meaning,
    examples: w.examples ?? [],
    audioUrl: w.audioUrl,
    status: "new",
    setContext: {
      setId: w.setId.toString(),
      setName: setMap.get(w.setId.toString())?.name,
      colorTheme: setMap.get(w.setId.toString())?.colorTheme
    }
  }));

  const reviewCards: LearningCard[] = reviewProgress.map((p: any) => {
    const word = p.wordId;
    const set = p.setId;
    return {
      id: word._id.toString(),
      word: word.word,
      pronunciation: word.pronunciation,
      partOfSpeech: word.partOfSpeech,
      meaning: word.meaning,
      examples: word.examples ?? [],
      audioUrl: word.audioUrl,
      status: p.status,
      easeFactor: p.easeFactor,
      interval: p.interval,
      nextReviewDate: p.nextReviewDate.toISOString(),
      setContext: {
        setId: set._id.toString(),
        setName: set.name,
        colorTheme: set.colorTheme
      }
    };
  });

  return { newCards, reviewCards, summary };
}

/**
 * 3. Nộp kết quả ôn tập/học từ vựng (Spaced Repetition SM-2 Submit)
 */
export async function submitReview(
  wordId: string,
  userId: string,
  data: SubmitReviewDTO
): Promise<SubmitReviewResponse> {
  const wordObjectId = new Types.ObjectId(wordId);
  const userObjectId = new Types.ObjectId(userId);
  const setObjectId = new Types.ObjectId(data.setId);

  // 1. Kiểm tra Clock Skew bảo vệ tiến độ (lệch tối đa 30 phút)
  if (data.reviewedAt) {
    const timeDiff = Math.abs(Date.now() - new Date(data.reviewedAt).getTime());
    if (timeDiff > 30 * 60 * 1000) {
      throw new AppError("Clock skew detected (> 30 min)", HttpStatus.BAD_REQUEST, "ERR_CLOCK_SKEW");
    }
  }

  // 2. Xác thực quyền sở hữu bộ từ của User
  const setExists = await VocabularySet.findOne({
    _id: setObjectId,
    userId: userObjectId,
    isDeleted: { $ne: true }
  }).lean();

  if (!setExists) {
    throw new AppError("Set not found or unauthorized", HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
  }

  // 3. Tìm tiến trình cũ hoặc khởi tạo mặc định cho từ
  const progress = await LearningProgress.findOne({ userId: userObjectId, wordId: wordObjectId });
  const previousStatus = progress?.status ?? "new";

  const sm2Input = {
    easeFactor: progress?.easeFactor ?? 2.5,
    interval: progress?.interval ?? 0,
    repetitions: progress?.repetitions ?? 0
  };

  // 4. Áp dụng thuật toán SM-2 tính khoảng cách ôn tiếp theo
  const sm2Result = applyReview(sm2Input, data.rating);
  const isCorrect = ["good", "easy"].includes(data.rating);

  // 5. Cập nhật cơ sở dữ liệu tiến trình học
  const updatedProgress = await LearningProgress.findOneAndUpdate(
    { userId: userObjectId, wordId: wordObjectId },
    {
      $set: {
        setId: setObjectId,
        easeFactor: sm2Result.easeFactor,
        interval: sm2Result.interval,
        repetitions: sm2Result.repetitions,
        status: sm2Result.status,
        nextReviewDate: sm2Result.nextReviewDate,
        lastReviewDate: data.reviewedAt ? new Date(data.reviewedAt) : new Date(),
        lastRating: data.rating
      },
      $inc: {
        totalReviews: 1,
        correctReviews: isCorrect ? 1 : 0
      }
    },
    { new: true, upsert: true }
  );

  // 6. Ghi nhận số liệu vào DailyStats phục vụ Person B tính Streak
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  await DailyStats.findOneAndUpdate(
    { userId: userObjectId, date: todayMidnight },
    {
      $inc: {
        wordsReviewed: 1,
        correctAnswers: isCorrect ? 1 : 0,
        totalAnswers: 1,
        timeSpent: data.timeSpent ?? 0,
        newWordsLearned: previousStatus === "new" ? 1 : 0
      }
    },
    { upsert: true }
  );

  return {
    wordId: updatedProgress.wordId.toString(),
    previousStatus,
    newStatus: updatedProgress.status,
    easeFactor: updatedProgress.easeFactor,
    interval: updatedProgress.interval,
    repetitions: updatedProgress.repetitions,
    nextReviewDate: updatedProgress.nextReviewDate.toISOString(),
    totalReviews: updatedProgress.totalReviews,
    correctReviews: updatedProgress.correctReviews
  };
}

/**
 * 4. Lấy hàng đợi ôn tập theo từng bộ từ vựng cụ thể
 */
export async function getSetLearningQueue(
  setId: string,
  userId: string
): Promise<LearningQueueResponse> {
  const userObjectId = new Types.ObjectId(userId);
  const setObjectId = new Types.ObjectId(setId);
  const now = new Date();

  // Xác thực quyền sở hữu bộ từ
  await VocabularySet.findOne({
    _id: setObjectId,
    userId: userObjectId,
    isDeleted: { $ne: true }
  }).lean();

  // Đọc chỉ tiêu
  const profile = await UserProfile.findOne({ userId: userObjectId }).lean();
  const dailyGoal = profile?.dailyGoal ?? 10;
  const reviewPerDay = (profile as any)?.reviewPerDay ?? 20;

  // ─── REVIEW CARDS TRONG SET ───
  const reviewProgress = await LearningProgress.find({
    userId: userObjectId,
    setId: setObjectId,
    status: { $ne: "new" },
    nextReviewDate: { $lte: now }
  })
    .sort({ nextReviewDate: 1 })
    .limit(reviewPerDay)
    .populate("wordId")
    .lean();

  // ─── NEW CARDS TRONG SET ───
  const newWords = await Word.aggregate([
    { $match: { setId: setObjectId, isDeleted: { $ne: true } } },
    {
      $lookup: {
        from: "learningprogresses",
        let: { wordId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$wordId", "$$wordId"] },
                  { $eq: ["$userId", userObjectId] }
                ]
              }
            }
          }
        ],
        as: "progress"
      }
    },
    { $match: { "progress.0": { $exists: false } } },
    { $limit: dailyGoal }
  ]);

  const summary: QueueSummary = {
    newCount: newWords.length,
    reviewCount: reviewProgress.length,
    totalToday: newWords.length + reviewProgress.length,
    estimatedMinutes: Math.ceil(newWords.length * 2 + reviewProgress.length * 1.2)
  };

  const setContextSet = await VocabularySet.findById(setId).select("name colorTheme").lean();

  const newCards: LearningCard[] = newWords.map((w) => ({
    id: w._id.toString(),
    word: w.word,
    pronunciation: w.pronunciation,
    partOfSpeech: w.partOfSpeech,
    meaning: w.meaning,
    examples: w.examples ?? [],
    audioUrl: w.audioUrl,
    status: "new",
    setContext: {
      setId,
      setName: setContextSet?.name,
      colorTheme: setContextSet?.colorTheme
    }
  }));

  const reviewCards: LearningCard[] = reviewProgress.map((p: any) => {
    const word = p.wordId;
    return {
      id: word._id.toString(),
      word: word.word,
      pronunciation: word.pronunciation,
      partOfSpeech: word.partOfSpeech,
      meaning: word.meaning,
      examples: word.examples ?? [],
      audioUrl: word.audioUrl,
      status: p.status,
      easeFactor: p.easeFactor,
      interval: p.interval,
      nextReviewDate: p.nextReviewDate.toISOString(),
      setContext: {
        setId,
        setName: setContextSet?.name,
        colorTheme: setContextSet?.colorTheme
      }
    };
  });

  return { newCards, reviewCards, summary };
}

/**
 * 5. Lấy tóm tắt tiến trình học của 1 bộ từ vựng
 */
export async function getSetProgressSummary(
  setId: string,
  userId: string
): Promise<SetProgressSummary> {
  const userObjectId = new Types.ObjectId(userId);
  const setObjectId = new Types.ObjectId(setId);
  const now = new Date();

  // Đọc set gốc
  const set = await VocabularySet.findOne({
    _id: setObjectId,
    userId: userObjectId,
    isDeleted: { $ne: true }
  }).lean();

  if (!set) {
    throw new AppError("Vocabulary set not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  // Đếm tiến độ thực tế
  const progressList = await LearningProgress.find({
    userId: userObjectId,
    setId: setObjectId
  }).lean();

  const progressMap = new Map(progressList.map((p) => [p.status, p]));
  const countByStatus = (status: string) => progressList.filter((p) => p.status === status).length;

  const masteredCount = countByStatus("mastered");
  const learningCount = countByStatus("learning");
  const reviewCount = countByStatus("review");

  // Đếm số từ đến hạn ôn tập
  const dueCount = progressList.filter(
    (p) => p.status !== "new" && p.nextReviewDate.getTime() <= now.getTime()
  ).length;

  const totalWords = set.totalWords ?? 0;
  const newCount = Math.max(0, totalWords - masteredCount - learningCount - reviewCount);

  return {
    setId,
    totalWords,
    masteredCount,
    masteredPct: totalWords > 0 ? Math.round((masteredCount / totalWords) * 100) : 0,
    learningCount,
    reviewCount,
    newCount,
    dueCount
  };
}

/**
 * 6. Lấy chi tiết SRS tiến độ học của một từ vựng cụ thể
 */
export async function getWordSRSProgress(
  wordId: string,
  userId: string
): Promise<WordSRSProgress> {
  const wordObjectId = new Types.ObjectId(wordId);
  const userObjectId = new Types.ObjectId(userId);

  // Tìm từ
  const word = await Word.findOne({ _id: wordObjectId, isDeleted: { $ne: true } }).lean();
  if (!word) {
    throw new AppError("Word not found", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  // Lấy tiến độ SRS
  const progress = await LearningProgress.findOne({ userId: userObjectId, wordId: wordObjectId }).lean();

  return {
    wordId,
    word: word.word,
    status: progress?.status ?? "new",
    easeFactor: progress?.easeFactor ?? 2.5,
    interval: progress?.interval ?? 0,
    repetitions: progress?.repetitions ?? 0,
    totalReviews: progress?.totalReviews ?? 0,
    correctReviews: progress?.correctReviews ?? 0,
    nextReviewDate: progress?.nextReviewDate?.toISOString(),
    lastReviewDate: progress?.lastReviewDate?.toISOString(),
    lastRating: progress?.lastRating
  };
}
