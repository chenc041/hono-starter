import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import jwt from "jsonwebtoken";
import { getEnv } from "~/core/config/env";
import { AppError } from "~/core/errors/app-error";
import type { AuthIdentityStore } from "~/modules/auth/identity-store";
import { type AuthTokenStore, hashToken } from "~/modules/auth/token-store";
import type { AppEnv, AuthUser } from "~/types";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});

const logoutBodySchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

type AccessPayload = AuthUser & {
  jti: string;
  typ: "access";
  exp: number;
};

type RefreshPayload = AuthUser & {
  jti: string;
  typ: "refresh";
};

function issueTokens(user: AuthUser) {
  const env = getEnv();
  const accessToken = jwt.sign(
    {
      sub: user.sub,
      email: user.email,
      jti: crypto.randomUUID(),
      typ: "access",
    },
    env.JWT_SECRET,
    {
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    },
  );

  const refreshToken = jwt.sign(
    {
      sub: user.sub,
      email: user.email,
      jti: crypto.randomUUID(),
      typ: "refresh",
    },
    env.JWT_SECRET,
    {
      expiresIn: env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60,
    },
  );

  return { accessToken, refreshToken };
}

function decodeAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, getEnv().JWT_SECRET);

  if (typeof decoded === "string") {
    throw new AppError({ status: 401, code: "UNAUTHORIZED", message: "Invalid token" });
  }

  if (decoded.typ !== "access" || !decoded.sub || !decoded.email || !decoded.jti || !decoded.exp) {
    throw new AppError({ status: 401, code: "UNAUTHORIZED", message: "Invalid token payload" });
  }

  return {
    sub: String(decoded.sub),
    email: String(decoded.email),
    jti: String(decoded.jti),
    typ: "access",
    exp: Number(decoded.exp),
  };
}

function decodeRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, getEnv().JWT_SECRET);

  if (typeof decoded === "string") {
    throw new AppError({ status: 401, code: "UNAUTHORIZED", message: "Invalid refresh token" });
  }

  if (decoded.typ !== "refresh" || !decoded.sub || !decoded.email || !decoded.jti) {
    throw new AppError({ status: 401, code: "UNAUTHORIZED", message: "Invalid refresh token payload" });
  }

  return {
    sub: String(decoded.sub),
    email: String(decoded.email),
    jti: String(decoded.jti),
    typ: "refresh",
  };
}

export function createAuthModule(tokenStore: AuthTokenStore, identityStore: AuthIdentityStore) {
  const authRoutes = new OpenAPIHono<AppEnv>();

  const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
    const authorization = c.req.header("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError({ status: 401, code: "UNAUTHORIZED", message: "Missing bearer token" });
    }

    const token = authorization.slice("Bearer ".length);
    const payload = decodeAccessToken(token);
    const tokenHash = hashToken(token);

    if (await tokenStore.isAccessTokenRevoked(tokenHash)) {
      throw new AppError({ status: 401, code: "UNAUTHORIZED", message: "Token revoked" });
    }

    c.set("authUser", {
      sub: payload.sub,
      email: payload.email,
    });
    c.set("authToken", token);
    c.set("authTokenExpiresAt", new Date(payload.exp * 1000));

    await next();
  };

  const loginRoute = createRoute({
    method: "post",
    path: "/login",
    request: {
      body: {
        content: {
          "application/json": {
            schema: loginBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Token pair",
      },
    },
  });

  authRoutes.openapi(loginRoute, async (c) => {
    const payload = c.req.valid("json");
    const user = await identityStore.verifyCredentials(payload.email, payload.password);

    if (!user) {
      throw new AppError({
        status: 401,
        code: "INVALID_CREDENTIALS",
        message: "Invalid email or password",
      });
    }

    const env = getEnv();
    const tokenPair = issueTokens(user);

    await tokenStore.saveRefreshToken({
      tokenHash: hashToken(tokenPair.refreshToken),
      userId: user.sub,
      email: user.email,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000),
    });

    return c.json({
      success: true,
      data: {
        ...tokenPair,
        tokenType: "Bearer",
      },
    });
  });

  const refreshRoute = createRoute({
    method: "post",
    path: "/refresh",
    request: { body: { content: { "application/json": { schema: refreshBodySchema } } } },
    responses: { 200: { description: "Rotated token pair" } },
  });

  authRoutes.openapi(refreshRoute, async (c) => {
    const payload = c.req.valid("json");
    const refreshPayload = decodeRefreshToken(payload.refreshToken);
    const oldRefreshHash = hashToken(payload.refreshToken);

    const existing = await tokenStore.findActiveRefreshToken(oldRefreshHash);
    if (!existing) {
      throw new AppError({ status: 401, code: "UNAUTHORIZED", message: "Refresh token invalid or expired" });
    }

    const user: AuthUser = { sub: refreshPayload.sub, email: refreshPayload.email };
    const env = getEnv();
    const newTokenPair = issueTokens(user);
    const newRefreshHash = hashToken(newTokenPair.refreshToken);

    await tokenStore.revokeRefreshToken(oldRefreshHash, newRefreshHash);
    await tokenStore.saveRefreshToken({
      tokenHash: newRefreshHash,
      userId: user.sub,
      email: user.email,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000),
    });

    return c.json({ success: true, data: { ...newTokenPair, tokenType: "Bearer" } });
  });

  const meRoute = createRoute({
    method: "get",
    path: "/me",
    security: [{ bearerAuth: [] }],
    responses: { 200: { description: "Current user" } },
  });

  authRoutes.openapi(meRoute, async (c) => {
    await authMiddleware(c, async () => {});
    return c.json({ success: true, data: { user: c.get("authUser") } });
  });

  const logoutRoute = createRoute({
    method: "post",
    path: "/logout",
    security: [{ bearerAuth: [] }],
    request: { body: { required: false, content: { "application/json": { schema: logoutBodySchema } } } },
    responses: { 200: { description: "Logged out" } },
  });

  authRoutes.openapi(logoutRoute, async (c) => {
    await authMiddleware(c, async () => {});
    const parsed = logoutBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      throw new AppError({ status: 400, code: "VALIDATION_ERROR", message: "Invalid logout payload" });
    }

    const token = c.get("authToken");
    const user = c.get("authUser");
    const expiresAt = c.get("authTokenExpiresAt");

    await tokenStore.revokeAccessToken({ tokenHash: hashToken(token), userId: user.sub, expiresAt, reason: "LOGOUT" });

    if (parsed.data.refreshToken) {
      await tokenStore.revokeRefreshToken(hashToken(parsed.data.refreshToken));
    }

    return c.json({ success: true, data: { loggedOut: true } });
  });

  return { authRoutes, authMiddleware };
}
