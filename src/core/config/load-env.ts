import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

const VALID_ENVS = new Set(["development", "test", "production"]);

export type RuntimeEnv = "development" | "test" | "production";

export function resolveRuntimeEnv(rawEnv: string | undefined): RuntimeEnv {
  if (rawEnv && VALID_ENVS.has(rawEnv)) {
    return rawEnv as RuntimeEnv;
  }

  return "development";
}

export function loadEnvFiles(options?: { cwd?: string; nodeEnv?: string }): RuntimeEnv {
  const cwd = options?.cwd ?? process.cwd();
  const nodeEnv = resolveRuntimeEnv(options?.nodeEnv ?? process.env.NODE_ENV);

  const fileOrder = [`.env.${nodeEnv}.local`, ".env.local", `.env.${nodeEnv}`, ".env"];

  for (const file of fileOrder) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) {
      continue;
    }

    const result = loadDotenv({ path, quiet: true });
    if (!result.parsed) {
      continue;
    }

    for (const [key, value] of Object.entries(result.parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }

  if (process.env.NODE_ENV === undefined) {
    process.env.NODE_ENV = nodeEnv;
  }

  return nodeEnv;
}
