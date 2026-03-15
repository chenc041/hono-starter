import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { getEnv } from "~/core/config/env";
import type { AppEnv } from "~/types";

export function createCorsMiddleware(): MiddlewareHandler<AppEnv> {
  const { CORS_ORIGINS } = getEnv();

  return cors({
    origin: (origin) => {
      if (!origin) {
        return "";
      }

      if (CORS_ORIGINS.includes("*") || CORS_ORIGINS.includes(origin)) {
        return origin;
      }

      return "";
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["content-type", "authorization", "x-request-id"],
  });
}

export function createBodyLimitMiddleware(): MiddlewareHandler<AppEnv> {
  const { REQUEST_BODY_LIMIT_BYTES } = getEnv();

  return async (c, next) => {
    const method = c.req.method.toUpperCase();
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      const bodyBuffer = await c.req.raw.clone().arrayBuffer();
      if (bodyBuffer.byteLength > REQUEST_BODY_LIMIT_BYTES) {
        return c.json({ success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large" } }, 413);
      }
    }

    const contentLength = c.req.header("content-length");
    if (contentLength && Number(contentLength) > REQUEST_BODY_LIMIT_BYTES) {
      return c.json({ success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Payload too large" } }, 413);
    }

    await next();
  };
}

export const securityHeadersMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.header("x-content-type-options", "nosniff");
  c.header("x-frame-options", "DENY");
  c.header("referrer-policy", "no-referrer");
};
