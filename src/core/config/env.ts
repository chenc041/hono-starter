import { loadEnvFiles, resolveRuntimeEnv } from "~/core/config/load-env";

export type AppConfig = {
  NODE_ENV: "development" | "test" | "production";
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  ACCESS_TOKEN_EXPIRES_IN_SECONDS: number;
  REFRESH_TOKEN_EXPIRES_IN_DAYS: number;
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_WINDOW_MS: number;
  REDIS_URL: string | undefined;
  CORS_ORIGINS: string[];
  REQUEST_BODY_LIMIT_BYTES: number;
  LOG_DIR: string;
  LOG_RETENTION_DAYS: number;
  LOG_LEVEL: "trace" | "debug" | "info" | "warn" | "error";
};

let cachedEnv: AppConfig | null = null;

function toNumber(input: string | undefined, fallback: number): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getEnv(): AppConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  loadEnvFiles();
  const NODE_ENV = resolveRuntimeEnv(process.env.NODE_ENV);

  const config: AppConfig = {
    NODE_ENV,
    PORT: toNumber(process.env.PORT, 3000),
    DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/hono_starter",
    JWT_SECRET: process.env.JWT_SECRET ?? "change-me-in-production",
    ACCESS_TOKEN_EXPIRES_IN_SECONDS: toNumber(process.env.ACCESS_TOKEN_EXPIRES_IN_SECONDS, 3600),
    REFRESH_TOKEN_EXPIRES_IN_DAYS: toNumber(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS, 7),
    RATE_LIMIT_MAX: toNumber(process.env.RATE_LIMIT_MAX, 60),
    RATE_LIMIT_WINDOW_MS: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    REDIS_URL: process.env.REDIS_URL || undefined,
    CORS_ORIGINS: parseCorsOrigins(process.env.CORS_ORIGINS),
    REQUEST_BODY_LIMIT_BYTES: toNumber(process.env.REQUEST_BODY_LIMIT_BYTES, 1_048_576),
    LOG_DIR: process.env.LOG_DIR ?? "logs",
    LOG_RETENTION_DAYS: toNumber(process.env.LOG_RETENTION_DAYS, 14),
    LOG_LEVEL:
      process.env.LOG_LEVEL === "trace" ||
      process.env.LOG_LEVEL === "debug" ||
      process.env.LOG_LEVEL === "info" ||
      process.env.LOG_LEVEL === "warn" ||
      process.env.LOG_LEVEL === "error"
        ? process.env.LOG_LEVEL
        : "info",
  };

  cachedEnv = config;
  return config;
}

export function resetEnvForTest(): void {
  cachedEnv = null;
}
