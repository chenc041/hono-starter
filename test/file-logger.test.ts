import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppLogger } from "~/core/logger";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("file logger", () => {
  test("writes access and error logs to separated daily files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hono-logger-"));
    tempDirs.push(dir);

    const logger = createAppLogger({
      logDir: dir,
      retentionDays: 14,
      level: "info",
      nowProvider: () => new Date("2026-03-15T09:00:00.000Z"),
    });

    logger.access.info({ path: "/health" }, "request_completed");
    logger.error.error({ code: "BOOM" }, "request_failed");
    await logger.shutdown();

    const accessFile = join(dir, "access-2026-03-15.log");
    const errorFile = join(dir, "error-2026-03-15.log");

    expect(existsSync(accessFile)).toBe(true);
    expect(existsSync(errorFile)).toBe(true);
    expect(readFileSync(accessFile, "utf8")).toContain("request_completed");
    expect(readFileSync(errorFile, "utf8")).toContain("request_failed");
  });

  test("purges expired logs based on retention days", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hono-logger-"));
    tempDirs.push(dir);

    writeFileSync(join(dir, "access-2026-02-20.log"), "old");
    writeFileSync(join(dir, "error-2026-03-14.log"), "recent");

    const logger = createAppLogger({
      logDir: dir,
      retentionDays: 14,
      level: "info",
      nowProvider: () => new Date("2026-03-15T09:00:00.000Z"),
    });

    await logger.shutdown();

    expect(existsSync(join(dir, "access-2026-02-20.log"))).toBe(false);
    expect(existsSync(join(dir, "error-2026-03-14.log"))).toBe(true);
  });
});
