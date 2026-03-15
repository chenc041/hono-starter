import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppEnv } from "~/types";

export const healthRoutes = new OpenAPIHono<AppEnv>();

const healthRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "Service healthy",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              status: z.literal("ok"),
              timestamp: z.string(),
            }),
          }),
        },
      },
    },
  },
});

healthRoutes.openapi(healthRoute, (c) => {
  return c.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
});
