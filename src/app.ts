import { OpenAPIHono } from "@hono/zod-openapi";
import { getEnv } from "~/core/config/env";
import { handleError, handleNotFound } from "~/core/middleware/error-handler";
import { loggerMiddleware } from "~/core/middleware/logger";
import {
  createRateLimiterBackend,
  createRateLimitMiddleware,
  type RateLimiterBackend,
  type RateLimitOptions,
} from "~/core/middleware/rate-limit";
import { requestIdMiddleware } from "~/core/middleware/request-id";
import { createBodyLimitMiddleware, createCorsMiddleware, securityHeadersMiddleware } from "~/core/middleware/security";
import { getPrismaClient } from "~/db/client";
import { type AuthIdentityStore, PrismaAuthIdentityStore } from "~/modules/auth/identity-store";
import { createAuthModule } from "~/modules/auth/routes";
import { type AuthTokenStore, PrismaAuthTokenStore } from "~/modules/auth/token-store";
import { healthRoutes } from "~/modules/health/routes";
import { createUserRoutes } from "~/modules/users/user.routes";
import { openApiRoutes } from "~/openapi/routes";
import type { AppEnv } from "~/types";

export type CreateAppOptions = {
  rateLimit?: RateLimitOptions;
  rateLimiterBackend?: RateLimiterBackend;
  authTokenStore?: AuthTokenStore;
  authIdentityStore?: AuthIdentityStore;
};

export function createApp(options?: CreateAppOptions) {
  const env = getEnv();
  const app = new OpenAPIHono<AppEnv>();

  app.use("*", requestIdMiddleware);
  app.use("*", createCorsMiddleware());
  app.use("*", createBodyLimitMiddleware());
  app.use("*", securityHeadersMiddleware);

  app.use(
    "*",
    createRateLimitMiddleware(
      options?.rateLimit ?? {
        max: env.RATE_LIMIT_MAX,
        windowMs: env.RATE_LIMIT_WINDOW_MS,
      },
      options?.rateLimiterBackend ?? createRateLimiterBackend(),
    ),
  );
  app.use("*", loggerMiddleware);

  app.get("/", (c) => c.json({ success: true, data: { message: "Hono Backend Starter" } }));

  const prisma = getPrismaClient();
  const tokenStore = options?.authTokenStore ?? new PrismaAuthTokenStore(prisma);
  const identityStore = options?.authIdentityStore ?? new PrismaAuthIdentityStore(prisma);
  const { authRoutes, authMiddleware } = createAuthModule(tokenStore, identityStore);
  const userRoutes = createUserRoutes({ authMiddleware });

  app.route("/health", healthRoutes);
  app.route("/auth", authRoutes);
  app.route("/users", userRoutes);
  app.route("/", openApiRoutes);

  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "Hono Backend Starter",
      version: "0.3.0",
      description: "Production-hardened Bun-first Hono backend starter",
    },
    servers: [{ url: "http://localhost:3000" }],
  });

  app.notFound(handleNotFound);
  app.onError(handleError);

  return app;
}
