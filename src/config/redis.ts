import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

let redis: Redis | null = null;

if (REDIS_URL) {
  try {
    // ioredis needs tls option set to empty object for secure connections (rediss://)
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      tls: REDIS_URL.startsWith("rediss:") ? {} : undefined,
    });
    console.log("🚀 Redis client initialized successfully.");
  } catch (error) {
    console.error("❌ Failed to initialize Redis client:", error);
  }
} else {
  console.log("⚠ REDIS_URL not set in environment. Redis caching/leaderboard is disabled.");
}

export { redis };
