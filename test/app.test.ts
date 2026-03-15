import { describe, expect, test } from "bun:test";
import { createApp } from "~/app";
import { resetEnvForTest } from "~/core/config/env";
import { InMemoryRateLimiterBackend } from "~/core/middleware/rate-limit";
import { InMemoryAuthIdentityStore } from "~/modules/auth/identity-store";
import { InMemoryAuthTokenStore } from "~/modules/auth/token-store";

function setupTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "test-secret";
  process.env.ACCESS_TOKEN_EXPIRES_IN_SECONDS = "3600";
  process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS = "7";
  process.env.CORS_ORIGINS = "http://localhost:5173";
  process.env.REQUEST_BODY_LIMIT_BYTES = "512";
  resetEnvForTest();
}

function createTestApp() {
  setupTestEnv();
  const identityStore = new InMemoryAuthIdentityStore();
  identityStore.setUser("admin@example.com", "admin12345", "user-1");

  return createApp({
    authIdentityStore: identityStore,
    authTokenStore: new InMemoryAuthTokenStore(),
    rateLimiterBackend: new InMemoryRateLimiterBackend(),
  });
}

describe("app starter", () => {
  test("GET / returns starter message and security headers", async () => {
    const app = createTestApp();
    const res = await app.request("/");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.message).toBe("Hono Backend Starter");
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("cors allows configured origin", async () => {
    const app = createTestApp();
    const res = await app.request("/health", {
      headers: { origin: "http://localhost:5173" },
    });

    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });

  test("blocks payload over limit", async () => {
    const app = createTestApp();
    const huge = "x".repeat(1024);
    const res = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: huge }),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(413);
  });

  test("POST /auth/login validates payload", async () => {
    const app = createTestApp();
    const res = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "not-an-email", password: "123" }),
      headers: { "content-type": "application/json" },
    });

    expect(res.status).toBe(400);
  });

  test("POST /auth/login returns access and refresh token", async () => {
    const app = createTestApp();
    const res = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "admin12345" }),
      headers: { "content-type": "application/json" },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.data.accessToken).toBe("string");
    expect(typeof body.data.refreshToken).toBe("string");
  });

  test("POST /auth/refresh rotates refresh token", async () => {
    const app = createTestApp();
    const loginRes = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "admin12345" }),
      headers: { "content-type": "application/json" },
    });
    const loginBody = await loginRes.json();

    const refreshRes = await app.request("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: loginBody.data.refreshToken }),
      headers: { "content-type": "application/json" },
    });
    const refreshBody = await refreshRes.json();

    expect(refreshRes.status).toBe(200);
    expect(refreshBody.data.refreshToken).not.toBe(loginBody.data.refreshToken);

    const reuseRes = await app.request("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: loginBody.data.refreshToken }),
      headers: { "content-type": "application/json" },
    });

    expect(reuseRes.status).toBe(401);
  });

  test("GET /auth/me requires token", async () => {
    const app = createTestApp();
    const res = await app.request("/auth/me");

    expect(res.status).toBe(401);
  });

  test("POST /auth/logout revokes access token", async () => {
    const app = createTestApp();
    const loginRes = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "admin12345" }),
      headers: { "content-type": "application/json" },
    });
    const loginBody = await loginRes.json();

    const logoutRes = await app.request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken: loginBody.data.refreshToken }),
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${loginBody.data.accessToken}`,
      },
    });

    expect(logoutRes.status).toBe(200);

    const meRes = await app.request("/auth/me", {
      headers: {
        authorization: `Bearer ${loginBody.data.accessToken}`,
      },
    });

    expect(meRes.status).toBe(401);
  });

  test("GET /auth/me works with valid token", async () => {
    const app = createTestApp();
    const loginRes = await app.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@example.com", password: "admin12345" }),
      headers: { "content-type": "application/json" },
    });
    const loginBody = await loginRes.json();

    const meRes = await app.request("/auth/me", {
      headers: { authorization: `Bearer ${loginBody.data.accessToken}` },
    });
    const meBody = await meRes.json();

    expect(meRes.status).toBe(200);
    expect(meBody.data.user.email).toBe("admin@example.com");
  });

  test("GET /openapi.json returns generated schema", async () => {
    const app = createTestApp();
    const res = await app.request("/openapi.json");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.openapi).toBe("3.0.0");
    expect(body.paths["/auth/login"]).toBeTruthy();
  });

  test("rate limiter blocks after threshold", async () => {
    const app = createApp({
      authIdentityStore: (() => {
        const s = new InMemoryAuthIdentityStore();
        s.setUser("admin@example.com", "admin12345", "user-1");
        return s;
      })(),
      authTokenStore: new InMemoryAuthTokenStore(),
      rateLimiterBackend: new InMemoryRateLimiterBackend(),
      rateLimit: {
        max: 2,
        windowMs: 60_000,
      },
    });

    const r1 = await app.request("/health");
    const r2 = await app.request("/health");
    const r3 = await app.request("/health");

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
  });
});
