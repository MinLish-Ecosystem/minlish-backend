import { Request, Response } from "express";
import { DailyChallenge } from "../models/DailyChallenge";
import { DailyPracticeResult } from "../models/DailyPracticeResult";
import { User } from "../models/User";
import { generateChallengeForDate } from "../services/practice.worker";
import { redis } from "../config/redis";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess, sendError } from "../utils/response.util";
import { HttpStatus } from "../constants/httpStatus";
import { ErrorCodes } from "../constants/errorCodes";
import { AppError } from "../utils/AppError";
import { z } from "zod";

// Help function to get YYYY-MM-DD in user's timezone
function getDateInTimezone(timezone: string = "Asia/Ho_Chi_Minh"): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    return `${year}-${month}-${day}`;
  } catch (err) {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Zod validation schema for submitting score
 */
export const submitPracticeSchema = z.object({
  body: z.object({
    timezone: z.string().optional().default("Asia/Ho_Chi_Minh"),
    timeTaken: z.number().min(1, "Time taken must be at least 1 second"),
    answers: z.array(
      z.object({
        questionIndex: z.number(),
        userSpelling: z.string().optional(),
        userChoice: z.number().optional(),
        userSentence: z.string().optional(),
      })
    ),
  }),
});

/**
 * GET /api/v1/practice/daily
 * Get today's daily challenge
 */
export const getDailyChallenge = catchAsync(async (req: Request, res: Response) => {
  const timezone = (req.query.timezone as string) || "Asia/Ho_Chi_Minh";
  const userDate = getDateInTimezone(timezone);
  const userId = req.user?.id;

  const redisKey = `challenge:daily:${userDate}`;
  let challengeData: any = null;

  // 1. Try reading from Redis Cache
  if (redis) {
    try {
      const cached = await redis.get(redisKey);
      if (cached) {
        challengeData = JSON.parse(cached);
      }
    } catch (err) {
      console.error("Redis read error in getDailyChallenge:", err);
    }
  }

  // 2. Fallback to MongoDB
  if (!challengeData) {
    let challenge = await DailyChallenge.findOne({ date: userDate }).lean();
    
    // 3. If challenge does not exist, generate it on-the-fly
    if (!challenge) {
      console.log(`[Practice Controller] Challenge for ${userDate} not found. Generating on the fly...`);
      try {
        await generateChallengeForDate(userDate);
        challenge = await DailyChallenge.findOne({ date: userDate }).lean();
      } catch (err) {
        console.error(`[Practice Controller] Failed to generate challenge on the fly:`, err);
        return sendError(res, "Failed to generate daily challenge. Please try again later.", HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }

    if (challenge) {
      challengeData = challenge;
      // Write to Redis cache with TTL ~41.6 hours (150000 seconds)
      if (redis) {
        try {
          await redis.set(redisKey, JSON.stringify(challenge), "EX", 150000);
        } catch (err) {
          console.error("Redis write error in getDailyChallenge:", err);
        }
      }
    }
  }

  if (!challengeData) {
    return sendError(res, "No challenge available for today.", HttpStatus.NOT_FOUND);
  }

  // 4. Check if user already submitted score for this date
  const completed = await DailyPracticeResult.findOne({
    userId,
    date: userDate,
  }).lean();

  return sendSuccess(res, "Daily challenge fetched successfully", {
    challenge: challengeData,
    completed: !!completed,
  });
});

/**
 * POST /api/v1/practice/submit
 * Submit user answers and calculate score
 */
export const submitDailyChallenge = catchAsync(async (req: Request, res: Response) => {
  const { timezone, timeTaken, answers } = submitPracticeSchema.shape.body.parse(req.body);
  const userId = req.user?.id;
  const userDate = getDateInTimezone(timezone);

  // 1. Enforce single submission per user per day
  const existingResult = await DailyPracticeResult.findOne({
    userId,
    date: userDate,
  }).lean();

  if (existingResult) {
    throw new AppError(
      "You have already completed today's practice challenge.",
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_FAILED
    );
  }

  // 2. Fetch challenge to grade answers
  const challenge = await DailyChallenge.findOne({ date: userDate }).lean();
  if (!challenge) {
    throw new AppError("Challenge not found for today", HttpStatus.NOT_FOUND, ErrorCodes.VALIDATION_FAILED);
  }

  let correctCount = 0;
  const gradedQuestions = challenge.questions;

  // 3. Grade each answer
  answers.forEach((ans) => {
    const question = gradedQuestions[ans.questionIndex];
    if (!question) return;

    if (question.type === "DICTATION") {
      const cleanUser = (ans.userSpelling || "").trim().toLowerCase();
      const cleanCorrect = question.word.trim().toLowerCase();
      if (cleanUser === cleanCorrect) {
        correctCount++;
      }
    } else if (question.type === "MULTIPLE_CHOICE") {
      if (ans.userChoice === question.correctAnswerIndex) {
        correctCount++;
      }
    } else if (question.type === "SCRAMBLE") {
      // Remove punctuation and compare case-insensitively
      const cleanUser = (ans.userSentence || "")
        .trim()
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .replace(/\s+/g, " ");
      const cleanCorrect = (question.correctSentence || "")
        .trim()
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .replace(/\s+/g, " ");
      if (cleanUser === cleanCorrect) {
        correctCount++;
      }
    }
  });

  // 4. Calculate Score: Correct answers prioritize; speed breaks ties
  // Score = correctCount * 10,000,000 + (86,400 - timeTaken)
  const safeTimeTaken = Math.min(86400, Math.max(1, timeTaken));
  const score = correctCount * 10000000 + (86400 - safeTimeTaken);

  // 5. Save score in MongoDB
  const result = await new DailyPracticeResult({
    userId,
    date: userDate,
    score,
    correctAnswers: correctCount,
    timeTaken: safeTimeTaken,
  }).save();

  // 6. Push to Redis Sorted Set Leaderboard
  if (redis) {
    try {
      const user = await User.findById(userId).lean();
      const username = user?.name || user?.email?.split("@")[0] || "Learner";
      const redisLeaderboardKey = `leaderboard:daily:${userDate}`;
      const member = `${userId}:${username}`;

      // Save to Sorted Set
      await redis.zadd(redisLeaderboardKey, score, member);
      // Set TTL to 150000 seconds (41.6 hours)
      await redis.expire(redisLeaderboardKey, 150000);
    } catch (err) {
      console.error("Redis write error in submitDailyChallenge:", err);
    }
  }

  return sendSuccess(res, "Answers submitted and scored successfully", {
    correctAnswers: correctCount,
    totalQuestions: gradedQuestions.length,
    score,
    timeTaken: safeTimeTaken,
  });
});

/**
 * GET /api/v1/practice/leaderboard
 * Fetch today's leaderboard (Top 10)
 */
export const getDailyLeaderboard = catchAsync(async (req: Request, res: Response) => {
  const timezone = (req.query.timezone as string) || "Asia/Ho_Chi_Minh";
  const userDate = getDateInTimezone(timezone);
  const userId = req.user?.id;

  const redisLeaderboardKey = `leaderboard:daily:${userDate}`;
  let list: Array<{ rank: number; name: string; score: number; isMe: boolean; correctAnswers: number; timeTaken: number }> = [];

  // 1. Primary: Try fetching from Redis Sorted Set
  if (redis) {
    try {
      const rawScores = await redis.zrevrange(redisLeaderboardKey, 0, 9, "WITHSCORES");
      // rawScores is [member1, score1, member2, score2, ...]
      for (let i = 0; i < rawScores.length; i += 2) {
        const member = rawScores[i];
        const score = Number(rawScores[i + 1]);
        const parts = member.split(":");
        const scoreUserId = parts[0];
        const username = parts[1] || "Learner";

        // De-serialize score to extract correct answers and timeTaken
        // Score = correctCount * 10,000,000 + (86,400 - timeTaken)
        const correctAnswers = Math.floor(score / 10000000);
        const timeTaken = 86400 - (score % 10000000);

        list.push({
          rank: Math.floor(i / 2) + 1,
          name: username,
          score,
          isMe: scoreUserId === userId,
          correctAnswers,
          timeTaken,
        });
      }
    } catch (err) {
      console.error("Redis read error in getDailyLeaderboard:", err);
    }
  }

  // 2. Fallback: If Redis returns empty or error, fetch from MongoDB
  if (list.length === 0) {
    const mongoResults = await DailyPracticeResult.find({ date: userDate })
      .sort({ score: -1 })
      .limit(10)
      .populate("userId", "name email")
      .lean();

    list = mongoResults.map((item: any, idx) => {
      const username = item.userId?.name || item.userId?.email?.split("@")[0] || "Learner";
      return {
        rank: idx + 1,
        name: username,
        score: item.score,
        isMe: item.userId?._id?.toString() === userId,
        correctAnswers: item.correctAnswers,
        timeTaken: item.timeTaken,
      };
    });
  }

  // Get current user rank
  let myRank = -1;
  let myResult = await DailyPracticeResult.findOne({ userId, date: userDate }).lean();
  
  if (myResult) {
    if (redis) {
      try {
        const user = await User.findById(userId).lean();
        const username = user?.name || user?.email?.split("@")[0] || "Learner";
        const member = `${userId}:${username}`;
        const rankIndex = await redis.zrevrank(redisLeaderboardKey, member);
        if (rankIndex !== null) {
          myRank = rankIndex + 1;
        }
      } catch (err) {
        console.error("Redis zrevrank error in getDailyLeaderboard:", err);
      }
    }

    // MongoDB fallback for user rank
    if (myRank === -1) {
      const betterScores = await DailyPracticeResult.countDocuments({
        date: userDate,
        score: { $gt: myResult.score },
      });
      myRank = betterScores + 1;
    }
  }

  return sendSuccess(res, "Daily leaderboard fetched successfully", {
    leaderboard: list,
    myScore: myResult
      ? {
          rank: myRank,
          score: myResult.score,
          correctAnswers: myResult.correctAnswers,
          timeTaken: myResult.timeTaken,
        }
      : null,
  });
});
