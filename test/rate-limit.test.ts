import { describe, expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { Hono } from "hono";
import { AppError } from "~/core/errors/app-error";
import {
  attachRedisConnectionErrorHandler,
  createRateLimitMiddleware,
  InMemoryRateLimiterBackend,
  type RateLimitOptions,
} from "~/core/middleware/rate-limit";
import type { AppEnv } from "~/types";

describe("in-memory rate limiter", () => {
  test("reports one Redis error per unavailable period and resets after recovery", () => {
    const redis = new EventEmitter();
    const reportError = (error: Error) => errors.push(error);
    const errors: Error[] = [];

    attachRedisConnectionErrorHandler(redis, reportError);

    const firstError = new Error("connection refused");
    const repeatedError = new Error("connection timeout");
    const recoveredError = new Error("connection lost again");

    redis.emit("error", firstError);
    redis.emit("error", repeatedError);
    expect(errors).toEqual([firstError]);

    redis.emit("ready");
    redis.emit("error", recoveredError);
    expect(errors).toEqual([firstError, recoveredError]);
  });

  test("allows the configured first requests and then blocks", async () => {
    const backend = new InMemoryRateLimiterBackend();
    const options: RateLimitOptions = { max: 2, windowMs: 60_000 };

    expect(await backend.consume("test-ip", options)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });
    expect(await backend.consume("test-ip", options)).toEqual({
      allowed: true,
      retryAfterSeconds: 0,
    });

    const blocked = await backend.consume("test-ip", options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  test("resets a bucket after its window expires", async () => {
    const backend = new InMemoryRateLimiterBackend();
    const options: RateLimitOptions = { max: 1, windowMs: 1 };

    expect((await backend.consume("short-window", options)).allowed).toBe(true);
    await Bun.sleep(5);

    expect((await backend.consume("short-window", options)).allowed).toBe(true);
  });

  test("uses x-forwarded-for and exposes retry-after", async () => {
    const app = new Hono<AppEnv>();
    app.onError((error, c) => {
      if (error instanceof AppError) {
        return c.json({ code: error.code }, error.status === 429 ? 429 : 500);
      }
      return c.json({ code: "INTERNAL_SERVER_ERROR" }, 500);
    });
    app.use("*", createRateLimitMiddleware({ max: 1, windowMs: 60_000 }, new InMemoryRateLimiterBackend()));
    app.get("/", (c) => c.json({ ok: true }));

    const first = await app.request("/", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });
    const second = await app.request("/", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.2" },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers.get("retry-after")).toBeTruthy();
  });
});
