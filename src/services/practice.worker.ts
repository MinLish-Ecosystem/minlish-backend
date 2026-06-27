import { Queue, Worker } from "bullmq";
import { Types } from "mongoose";
import { Word } from "../models/Word";
import { DailyChallenge, IQuestion } from "../models/DailyChallenge";

const REDIS_URL = process.env.REDIS_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PRACTICE_QUEUE_NAME = "daily-practice";

export let practiceQueue: Queue | null = null;
export let practiceWorker: Worker | null = null;

const parseRedisUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: Number(parsed.port) || 6379,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      username: parsed.username || undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
      maxRetriesPerRequest: null,
    };
  } catch (error) {
    console.error("Invalid REDIS_URL:", error);
    return null;
  }
};

/**
 * Call Gemini API to generate questions for the 15 words
 */
async function generateQuestionsWithGemini(words: string[]): Promise<IQuestion[]> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }

  const prompt = `
  You are an expert English teacher. Generate a 15-question English vocabulary practice quiz using these 15 words: ${words.join(", ")}.
  Create exactly one question for each word. Distribute the question types evenly:
  - 5 questions of type 'DICTATION': Spelling test. The questionText should be a contextual sentence with the target word replaced by "____", or a definition. Set word to the correct spelling. The user will listen to audio (or read clue) and type the spelling. Set audioUrl to a Google TTS url: "https://translate.google.com/translate_tts?ie=UTF-8&q=" + encodeURIComponent(word) + "&tl=en&client=tw-ob".
  - 5 questions of type 'MULTIPLE_CHOICE': Grammar/vocabulary test. The questionText should be a sentence with a blank "____" or a definition asking for the target word. Provide 4 options (options array of 4 strings), where one is the target word and 3 are plausible distractors. Set correctAnswerIndex to the index of the correct word in options (0-3).
  - 5 questions of type 'SCRAMBLE': Sentence ordering test. Create a simple, natural English sentence using the target word. Scramble the words of this sentence and set scrambledTokens to the array of scrambled words (tokens). Set correctSentence to the full correct English sentence. Set questionText to the Vietnamese translation of this sentence so the user has a clue of what they are translating.

  Adhere strictly to the requested JSON Schema. All explanations and translations should be in Vietnamese to help the learner understand.
  `;

  // Define JSON Schema for Gemini response
  const responseSchema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        type: {
          type: "STRING",
          enum: ["DICTATION", "MULTIPLE_CHOICE", "SCRAMBLE"],
        },
        word: { type: "STRING" },
        questionText: { type: "STRING" },
        options: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
        correctAnswerIndex: { type: "INTEGER" },
        scrambledTokens: {
          type: "ARRAY",
          items: { type: "STRING" },
        },
        correctSentence: { type: "STRING" },
        audioUrl: { type: "STRING" },
        explanation: { type: "STRING" },
      },
      required: ["type", "word", "questionText", "explanation"],
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.3,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API returned status ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Empty response from Gemini API");
  }

  return JSON.parse(rawText) as IQuestion[];
}

/**
 * Generate challenge for a specific YYYY-MM-DD date
 */
export async function generateChallengeForDate(dateStr: string): Promise<void> {
  const existing = await DailyChallenge.findOne({ date: dateStr }).lean();
  if (existing) {
    console.log(`[Practice Worker] Challenge for ${dateStr} already exists. Skipping.`);
    return;
  }

  console.log(`[Practice Worker] Fetching random words to generate quiz for ${dateStr}...`);
  const wordsCount = await Word.countDocuments({ isDeleted: { $ne: true } });
  if (wordsCount === 0) {
    throw new Error("No words found in database to generate challenge");
  }

  // Get 15 random words using MongoDB sample aggregation
  const randomWords = await Word.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $sample: { size: 15 } },
  ]);

  const wordStrings = randomWords.map((w) => w.word);
  console.log(`[Practice Worker] Selected words: ${wordStrings.join(", ")}`);

  // Generate questions using Gemini
  const questions = await generateQuestionsWithGemini(wordStrings);

  if (questions.length !== 15) {
    console.warn(`[Practice Worker] Gemini generated ${questions.length} questions instead of 15. Proceeding anyway.`);
  }

  // Save to DB
  await new DailyChallenge({
    date: dateStr,
    questions,
  }).save();

  console.log(`[Practice Worker] Challenge for ${dateStr} successfully saved to database.`);
}

/**
 * Lazy init check at server startup
 */
async function ensureChallengeExists(dateStr: string) {
  try {
    const exists = await DailyChallenge.findOne({ date: dateStr }).lean();
    if (!exists) {
      console.log(`[Practice Worker] Challenge for ${dateStr} not found. Generating now...`);
      await generateChallengeForDate(dateStr);
    }
  } catch (error) {
    console.error(`[Practice Worker] Lazy init failed for date ${dateStr}:`, error);
  }
}

export async function initDailyPracticeWorker() {
  if (!REDIS_URL) {
    console.log("⚠ REDIS_URL not set in environment. Daily practice worker is disabled.");
    return;
  }

  try {
    const redisOpts = parseRedisUrl(REDIS_URL);
    if (!redisOpts) {
      console.error("❌ Failed to parse REDIS_URL.");
      return;
    }

    practiceQueue = new Queue(PRACTICE_QUEUE_NAME, { connection: redisOpts });

    practiceWorker = new Worker(
      PRACTICE_QUEUE_NAME,
      async (job) => {
        if (job.name === "generate-daily-challenge") {
          // Generate challenge for tomorrow
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const tomorrowStr = tomorrow.toISOString().split("T")[0];
          await generateChallengeForDate(tomorrowStr);
        }
      },
      { connection: redisOpts, concurrency: 1 }
    );

    // Add repeatable job to run at 12:00 UTC daily (19:00 UTC+7)
    await practiceQueue.add(
      "generate-daily-challenge",
      {},
      {
        repeat: {
          pattern: "0 12 * * *", // 12:00 UTC
        },
        jobId: "generate-daily-challenge-job",
        removeOnComplete: true,
        removeOnFail: true,
      }
    );

    console.log("⏰ BullMQ Daily Practice Worker & Queue initialized successfully!");

    // Lazy init today and tomorrow challenges
    const todayStr = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Run asynchronously on boot so it doesn't block server start
    ensureChallengeExists(todayStr);
    ensureChallengeExists(tomorrowStr);

  } catch (error) {
    console.error("❌ Failed to initialize BullMQ Daily Practice Worker:", error);
  }
}
