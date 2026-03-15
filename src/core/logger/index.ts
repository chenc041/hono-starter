import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import pino from "pino";
import { getEnv } from "~/core/config/env";
import { DailyFileDestination, type DateProvider } from "~/core/logger/daily-file-destination";

const DATE_FILE_REGEX = /^(access|error)-(\d{4})-(\d{2})-(\d{2})\.log$/;
const DAY_MS = 24 * 60 * 60 * 1000;

type AppLoggerLevel = "trace" | "debug" | "info" | "warn" | "error";

export type AppLogger = {
  access: pino.Logger;
  error: pino.Logger;
  shutdown: () => Promise<void>;
};

export type CreateAppLoggerOptions = {
  logDir: string;
  retentionDays: number;
  level: AppLoggerLevel;
  nowProvider?: DateProvider;
};

function parseDateParts(year: string, month: string, day: string): number {
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

function startOfUtcDayMs(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function purgeExpiredLogs(logDir: string, retentionDays: number, now: Date): void {
  mkdirSync(logDir, { recursive: true });
  const files = readdirSync(logDir);
  const cutoff = startOfUtcDayMs(now) - retentionDays * DAY_MS;

  for (const file of files) {
    const match = file.match(DATE_FILE_REGEX);
    if (!match) {
      continue;
    }

    const [, , year, month, day] = match;
    if (!year || !month || !day) {
      continue;
    }

    const fileDateMs = parseDateParts(year, month, day);
    if (fileDateMs < cutoff) {
      rmSync(join(logDir, file), { force: true });
    }
  }
}

export function createAppLogger(options: CreateAppLoggerOptions): AppLogger {
  const nowProvider = options.nowProvider ?? (() => new Date());
  purgeExpiredLogs(options.logDir, options.retentionDays, nowProvider());

  const accessDestination = new DailyFileDestination({
    logDir: options.logDir,
    prefix: "access",
    nowProvider,
  });
  const errorDestination = new DailyFileDestination({
    logDir: options.logDir,
    prefix: "error",
    nowProvider,
  });

  const baseOptions = {
    level: options.level,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: null,
  } as const;

  const access = pino(baseOptions, accessDestination);
  const error = pino(
    { ...baseOptions, level: options.level === "trace" || options.level === "debug" ? "debug" : "warn" },
    errorDestination,
  );

  return {
    access,
    error,
    shutdown: async () => {
      access.flush();
      error.flush();
      await Promise.all([accessDestination.close(), errorDestination.close()]);
    },
  };
}

let appLogger: AppLogger | null = null;

export function getAppLogger(): AppLogger {
  if (appLogger) {
    return appLogger;
  }

  const env = getEnv();
  appLogger = createAppLogger({
    logDir: env.LOG_DIR,
    retentionDays: env.LOG_RETENTION_DAYS,
    level: env.LOG_LEVEL,
  });
  return appLogger;
}

export async function resetAppLoggerForTest(): Promise<void> {
  if (!appLogger) {
    return;
  }

  await appLogger.shutdown();
  appLogger = null;
}
