import type { MiddlewareHandler } from "hono";
import { getAppLogger } from "~/core/logger";
import type { AppEnv } from "~/types";

export const loggerMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const startedAt = performance.now();
  await next();
  const duration = Math.round((performance.now() - startedAt) * 100) / 100;
  const requestId = c.get("requestId");
  getAppLogger().access.info(
    {
      level: "info",
      msg: "request_completed",
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration,
      requestId,
    },
    "request_completed",
  );
};
