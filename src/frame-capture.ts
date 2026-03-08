import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

type ScreenshotTarget = {
  screenshot: (options: Record<string, unknown>) => Promise<Buffer>;
};

type CaptureImageFormat = "png" | "jpeg";

export type CapturedFrame = {
  format: CaptureImageFormat;
  path: string;
  timeMs: number;
};

type ManualFrameCaptureOptions = {
  fps: number;
  format?: CaptureImageFormat;
  jpegQuality?: number;
  outputDir: string;
  target: ScreenshotTarget;
};

export class ManualFrameCapture {
  readonly #fps: number;

  readonly #intervalMs: number;

  readonly #outputDir: string;

  readonly #format: CaptureImageFormat;

  readonly #jpegQuality: number;

  readonly #target: ScreenshotTarget;

  #active = false;

  #frames: CapturedFrame[] = [];

  #loopPromise: Promise<void> | undefined;

  #startedAt = 0;

  constructor({
    fps,
    format = "png",
    jpegQuality = 90,
    outputDir,
    target,
  }: ManualFrameCaptureOptions) {
    this.#fps = fps;
    this.#intervalMs = 1000 / Math.max(fps, 1);
    this.#format = format;
    this.#jpegQuality = jpegQuality;
    this.#outputDir = outputDir;
    this.#target = target;
  }

  get frames(): CapturedFrame[] {
    return [...this.#frames];
  }

  async start(): Promise<void> {
    await fs.mkdir(this.#outputDir, { recursive: true });
    this.#frames = [];
    this.#startedAt = performance.now();
    await this.#captureFrame(0);
    this.#active = true;
    this.#loopPromise = this.#run();
  }

  async stop(durationMs: number): Promise<CapturedFrame[]> {
    this.#active = false;
    await this.#loopPromise;

    const lastFrame = this.#frames.at(-1);

    if (!lastFrame || durationMs - lastFrame.timeMs > this.#intervalMs * 0.35) {
      await this.#captureFrame(durationMs);
    }

    return this.frames;
  }

  async #run(): Promise<void> {
    let frameIndex = 1;

    while (this.#active) {
      const nextCaptureAt = this.#startedAt + this.#intervalMs * frameIndex;
      const waitMs = nextCaptureAt - performance.now();

      if (waitMs > 1) {
        await delay(waitMs);
      }

      if (!this.#active) {
        break;
      }

      await this.#captureFrame();
      frameIndex += 1;
    }
  }

  async #captureFrame(forcedTimeMs?: number): Promise<void> {
    const filePath = path.join(
      this.#outputDir,
      `frame-${String(this.#frames.length).padStart(6, "0")}.${this.#format === "jpeg" ? "jpg" : "png"}`,
    );

    await this.#target.screenshot({
      animations: "allow",
      caret: "hide",
      path: filePath,
      scale: "device",
      ...(this.#format === "jpeg"
        ? {
            quality: this.#jpegQuality,
            type: "jpeg",
          }
        : {
            type: "png",
          }),
    });

    const previousTimeMs = this.#frames.at(-1)?.timeMs ?? 0;
    const measuredTimeMs =
      forcedTimeMs ?? Math.max(performance.now() - this.#startedAt, previousTimeMs);

    this.#frames.push({
      format: this.#format,
      path: filePath,
      timeMs: Math.max(measuredTimeMs, previousTimeMs),
    });
  }
}
