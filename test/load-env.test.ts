import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFiles } from "~/core/config/load-env";

const originalEnv = { ...process.env };
const createdDirs: string[] = [];

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, originalEnv);

  for (const dir of createdDirs) {
    rmSync(dir, { recursive: true, force: true });
  }

  createdDirs.length = 0;
});

describe("loadEnvFiles", () => {
  test("loads env files with environment-specific precedence", () => {
    const dir = mkdtempSync(join(tmpdir(), "hono-env-"));
    createdDirs.push(dir);

    writeFileSync(join(dir, ".env"), "FOO=base\nBAR=base\n");
    writeFileSync(join(dir, ".env.production"), "FOO=prod\nBAZ=prod\n");
    writeFileSync(join(dir, ".env.local"), "FOO=local\n");
    writeFileSync(join(dir, ".env.production.local"), "FOO=prodlocal\n");

    delete process.env.FOO;
    delete process.env.BAR;
    delete process.env.BAZ;
    delete process.env.NODE_ENV;

    const env = loadEnvFiles({ cwd: dir, nodeEnv: "production" });

    expect(env).toBe("production");
    expect(String(process.env.FOO)).toBe("prodlocal");
    expect(String(process.env.BAR)).toBe("base");
    expect(String(process.env.BAZ)).toBe("prod");
    expect(String(process.env.NODE_ENV)).toBe("production");
  });

  test("does not override variables already set in process.env", () => {
    const dir = mkdtempSync(join(tmpdir(), "hono-env-"));
    createdDirs.push(dir);
    writeFileSync(join(dir, ".env"), "DATABASE_URL=file-value\n");

    process.env.DATABASE_URL = "shell-value";
    loadEnvFiles({ cwd: dir, nodeEnv: "development" });

    expect(String(process.env.DATABASE_URL)).toBe("shell-value");
  });
});
