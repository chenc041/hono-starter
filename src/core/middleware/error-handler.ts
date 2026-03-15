import type { Context } from "hono";
import { AppError } from "~/core/errors/app-error";
import { getAppLogger } from "~/core/logger";

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

export function handleError(error: unknown, c: Context) {
  const requestId = c.get("requestId") as string | undefined;
  const logger = getAppLogger();

  if (error instanceof AppError) {
    logger.error.warn(
      {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
      },
      "application_error",
    );
    return jsonResponse(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId,
        },
      },
      error.status,
    );
  }

  logger.error.error({ err: error, requestId }, "unhandled_error");
  return jsonResponse(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Unexpected error",
        requestId,
      },
    },
    500,
  );
}

export function handleNotFound(c: Context) {
  const requestId = c.get("requestId") as string | undefined;
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId,
      },
    },
    404,
  );
}
