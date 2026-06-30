import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

let redis: Redis | null = null;
let isRedisHealthy = false; // Start as false to prevent premature BullMQ initialization
let failureCount = 0;
const FAILURE_THRESHOLD = 3;
let lastRecoveryTry = 0;
const RECOVERY_TIMEOUT = 60000; // 1 minute

type HealthListener = (healthy: boolean) => void;
const healthListeners: HealthListener[] = [];

export function onRedisHealthChange(listener: HealthListener) {
  healthListeners.push(listener);
}

function notifyHealthChange(healthy: boolean) {
  for (const listener of healthListeners) {
    try {
      listener(healthy);
    } catch (err) {
      console.error("Error in redis health listener:", err);
    }
  }
}

if (REDIS_URL) {
  try {
    // ioredis needs tls option set to empty object for secure connections (rediss://)
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      tls: REDIS_URL.startsWith("rediss:") ? {} : undefined,
    });

    redis.on('connect', () => {
      isRedisHealthy = true;
      failureCount = 0;
      console.log("🚀 Redis client connected successfully.");
      notifyHealthChange(true);
    });

    redis.on('error', (err) => {
      isRedisHealthy = false;
      console.error('❌ Redis client connection error:', err.message);
      notifyHealthChange(false);
    });
    
    console.log("🚀 Redis client initialized successfully.");
  } catch (error) {
    isRedisHealthy = false;
    console.error("❌ Failed to initialize Redis client:", error);
  }
} else {
  isRedisHealthy = false;
  console.log("⚠ REDIS_URL not set in environment. Redis caching/leaderboard is disabled.");
}

export function isRedisAvailable(): boolean {
  if (!redis) return false;
  if (!isRedisHealthy) {
    // Attempt recovery check after timeout
    if (Date.now() - lastRecoveryTry > RECOVERY_TIMEOUT) {
      lastRecoveryTry = Date.now();
      console.log("🔄 Checking if Redis has recovered...");
      redis.ping().then(() => {
        isRedisHealthy = true;
        failureCount = 0;
        console.log("✅ Redis has recovered and is healthy!");
        notifyHealthChange(true);
      }).catch((err) => {
        console.warn("⚠️ Redis health check failed. Still using fallback.");
      });
    }
  }
  return isRedisHealthy;
}

export function reportRedisFailure(err?: any) {
  if (!isRedisHealthy) return;
  failureCount++;
  if (failureCount >= FAILURE_THRESHOLD) {
    isRedisHealthy = false;
    lastRecoveryTry = Date.now();
    console.error("🚨 Redis circuit breaker tripped! Dynamic fallback to Memory/DB activated.");
    notifyHealthChange(false);
  }
}

export { redis };
