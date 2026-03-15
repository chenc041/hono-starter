import type { MiddlewareHandler } from "hono";
import Redis from "ioredis";
import { getEnv } from "~/core/config/env";
import { AppError } from "~/core/errors/app-error";
import type { AppEnv } from "~/types";

export type RateLimitOptions = {
  max: number;
  windowMs: number;
};

type ConsumeResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export interface RateLimiterBackend {
  consume(key: string, options: RateLimitOptions): Promise<ConsumeResult>;
}

type Bucket = {
  count: number;
  resetAt: number;
};

export class InMemoryRateLimiterBackend implements RateLimiterBackend {
  private readonly buckets = new Map<string, Bucket>();

  async consume(key: string, options: RateLimitOptions): Promise<ConsumeResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (existing.count >= options.max) {
      const retryAfterMs = Math.max(existing.resetAt - now, 0);
      return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
    }

    existing.count += 1;
    this.buckets.set(key, existing);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export class RedisRateLimiterBackend implements RateLimiterBackend {
  private readonly redis: Redis;
  private readonly fallback = new InMemoryRateLimiterBackend();

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  async consume(key: string, options: RateLimitOptions): Promise<ConsumeResult> {
    const ttl = String(options.windowMs);

    try {
      if (this.redis.status === "wait") {
        await this.redis.connect();
      }

      const result = (await this.redis.eval(
        `local current = redis.call("INCR", KEYS[1])
if current == 1 then redis.call("PEXPIRE", KEYS[1], ARGV[1]) end
local pttl = redis.call("PTTL", KEYS[1])
return {current, pttl}`,
        1,
        key,
        ttl,
      )) as [number, number];

      const [count, pttl] = result;
      const allowed = Number(count) <= options.max;
      return {
        allowed,
        retryAfterSeconds: allowed ? 0 : Math.ceil(Math.max(Number(pttl), 0) / 1000),
      };
    } catch {
      return this.fallback.consume(key, options);
    }
  }
}

export function createRateLimiterBackend(): RateLimiterBackend {
  const env = getEnv();
  if (!env.REDIS_URL) {
    return new InMemoryRateLimiterBackend();
  }

  return new RedisRateLimiterBackend(env.REDIS_URL);
}

export function createRateLimitMiddleware(
  options: RateLimitOptions,
  backend?: RateLimiterBackend,
): MiddlewareHandler<AppEnv> {
  const limiter = backend ?? createRateLimiterBackend();

  return async (c, next) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const key = `ratelimit:${ip}:${c.req.path}`;

    const result = await limiter.consume(key, options);
    if (!result.allowed) {
      c.header("retry-after", String(result.retryAfterSeconds));
      throw new AppError({ status: 429, code: "RATE_LIMITED", message: "Too many requests" });
    }

    await next();
  };
}
