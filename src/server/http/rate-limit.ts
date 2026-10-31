import Redis from "ioredis";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";

// Fixed-window limits. With REDIS_URL (production) every web instance shares one count in Redis, and a window's
// key expires by itself when the window ends. Without it (local development, tests) the count lives in this
// process's memory, which is only right for a single server.

const KEY_PREFIX = "ratelimit:";

/** Adds one hit and starts the window on the first one, in one atomic step. Returns the count and ms left. */
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('PTTL', KEYS[1])}`;

type Hit = { count: number; resetInMs: number };

const globalForRedis = globalThis as unknown as { rateLimitRedis?: Redis };

function redisClient(): Redis | null {
  if (!env.REDIS_URL) return null;
  globalForRedis.rateLimitRedis ??= new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 2,
    enableOfflineQueue: true,
  });
  return globalForRedis.rateLimitRedis;
}

if (!env.REDIS_URL && process.env.NODE_ENV === "production") {
  console.warn("[rate-limit] REDIS_URL is not set: limits are per process, not shared across instances");
}

async function hitRedis(redis: Redis, key: string, windowMs: number): Promise<Hit> {
  const [count, ttl] = (await redis.eval(HIT_SCRIPT, 1, KEY_PREFIX + key, windowMs)) as [number, number];
  return { count, resetInMs: ttl > 0 ? ttl : windowMs };
}

const windows = new Map<string, { count: number; resetAt: number }>();

function hitMemory(key: string, windowMs: number, now = Date.now()): Hit {
  let window = windows.get(key);
  if (!window || window.resetAt <= now) {
    window = { count: 0, resetAt: now + windowMs };
    windows.set(key, window);
  }
  window.count += 1;
  // Ended windows are dropped now and then, so the map stays as small as the live ones.
  if (windows.size > 10_000) {
    for (const [stale, entry] of windows) if (entry.resetAt <= now) windows.delete(stale);
  }
  return { count: window.count, resetInMs: window.resetAt - now };
}

export async function enforceRateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const redis = redisClient();
  const { count, resetInMs } = redis ? await hitRedis(redis, key, windowMs) : hitMemory(key, windowMs);
  if (count > limit) {
    throw new AppError("RATE_LIMITED", "Too many requests. Please slow down.", {
      retryAfterSeconds: Math.max(1, Math.ceil(resetInMs / 1000)),
    });
  }
}

/** Forgets every in-memory window. For tests; Redis windows expire on their own. */
export function resetMemoryRateLimits(): void {
  windows.clear();
}

/**
 * The client's address, from the headers the hosting's proxy sets in front of the website (DigitalOcean on the live
 * site). The proxy must overwrite them, or a caller could pick its own address and dodge its limit.
 */
export function clientAddress(request: Request): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local"
  );
}
