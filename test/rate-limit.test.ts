import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { AppError } from "~/core/errors/app-error";
import {
  createRateLimitMiddleware,
  InMemoryRateLimiterBackend,
  type RateLimitOptions,
} from "~/core/middleware/rate-limit";
import type { AppEnv } from "~/types";

describe("in-memory rate limiter", () => {
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
