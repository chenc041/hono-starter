import type { WriteStream } from "node:fs";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Writable } from "node:stream";

export type DateProvider = () => Date;

type DailyFileDestinationOptions = {
  logDir: string;
  prefix: "access" | "error";
  nowProvider: DateProvider;
};

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export class DailyFileDestination extends Writable {
  private currentDate: string | null = null;
  private currentStream: WriteStream | null = null;

  constructor(private readonly options: DailyFileDestinationOptions) {
    super();
    mkdirSync(this.options.logDir, { recursive: true });
  }

  private getStream(): WriteStream {
    const nextDate = formatDate(this.options.nowProvider());

    if (this.currentDate !== nextDate || !this.currentStream) {
      if (this.currentStream) {
        this.currentStream.end();
      }

      const filePath = join(this.options.logDir, `${this.options.prefix}-${nextDate}.log`);
      this.currentStream = createWriteStream(filePath, { flags: "a" });
      this.currentDate = nextDate;
    }

    return this.currentStream;
  }

  override _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    try {
      const stream = this.getStream();

      if (stream.write(chunk, encoding)) {
        callback();
        return;
      }

      stream.once("drain", () => callback());
    } catch (error) {
      callback(error as Error);
    }
  }

  async close(): Promise<void> {
    if (!this.currentStream) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.currentStream?.end(() => resolve());
    });
    this.currentStream = null;
  }
}
