import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { AppError } from "~/core/errors/app-error";
import { getPrismaClient } from "~/db/client";
import { UserRepository } from "~/modules/users/user.repository";
import { createUserSchema } from "~/modules/users/user.schema";
import { UserService } from "~/modules/users/user.service";
import type { AppEnv } from "~/types";

type CreateUserRoutesOptions = {
  authMiddleware: MiddlewareHandler<AppEnv>;
};

export function createUserRoutes({ authMiddleware }: CreateUserRoutesOptions) {
  const userRoutes = new OpenAPIHono<AppEnv>();
  const userService = new UserService(new UserRepository(getPrismaClient()));

  userRoutes.use("*", authMiddleware);

  const listRoute = createRoute({
    method: "get",
    path: "/",
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "List users",
      },
    },
  });

  userRoutes.openapi(listRoute, async (c) => {
    const users = await userService.listUsers();
    return c.json({ success: true, data: users });
  });

  const createRouteDef = createRoute({
    method: "post",
    path: "/",
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              email: z.string().email(),
              name: z.string().min(1).max(100),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        description: "Create user",
      },
    },
  });

  userRoutes.openapi(createRouteDef, async (c) => {
    const payload = await c.req.json().catch(() => null);
    const result = createUserSchema.safeParse(payload);

    if (!result.success) {
      throw new AppError({
        status: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid create user payload",
        details: result.error.issues,
      });
    }

    const user = await userService.createUser(result.data);
    return c.json({ success: true, data: user }, 201);
  });

  return userRoutes;
}
