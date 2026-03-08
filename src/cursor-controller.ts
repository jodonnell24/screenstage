import { performance } from "node:perf_hooks";

import type { Page } from "playwright";

import { clickCursorOverlay, moveCursorOverlay } from "./cursor-overlay.js";
import { resolveLocatorCenter } from "./locator.js";
import type {
  CursorClickOptions,
  CursorController,
  CursorMoveOptions,
  CursorSample,
  CursorSampleKind,
  CursorTypeOptions,
  Point,
} from "./types.js";

type CursorControllerOptions = {
  initialPoint: Point;
  page: Page;
};

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

export class DemoCursorController implements CursorController {
  readonly #page: Page;

  readonly #samples: CursorSample[] = [];

  readonly #startedAt = performance.now();

  current: Point;

  constructor({ initialPoint, page }: CursorControllerOptions) {
    this.current = initialPoint;
    this.#page = page;
    this.#samples.push({
      kind: "move",
      timeMs: 0,
      x: initialPoint.x,
      y: initialPoint.y,
    });
  }

  get samples(): CursorSample[] {
    return [...this.#samples];
  }

  async sample(kind: CursorSampleKind = "move"): Promise<void> {
    this.#samples.push({
      kind,
      timeMs: performance.now() - this.#startedAt,
      x: this.current.x,
      y: this.current.y,
    });
    await moveCursorOverlay(this.#page, this.current.x, this.current.y);
  }

  async move(point: Point, options: CursorMoveOptions = {}): Promise<void> {
    const durationMs = options.durationMs ?? 700;
    const steps = options.steps ?? Math.max(6, Math.ceil(durationMs / 12));
    const delayMs = steps > 1 ? durationMs / steps : 0;
    const start = this.current;

    for (let step = 1; step <= steps; step += 1) {
      const progress = easeInOutCubic(step / steps);
      const nextPoint = {
        x: interpolate(start.x, point.x, progress),
        y: interpolate(start.y, point.y, progress),
      };

      await this.#page.mouse.move(nextPoint.x, nextPoint.y);
      this.current = nextPoint;
      await this.sample("move");

      if (step < steps && delayMs > 0) {
        await this.#page.waitForTimeout(delayMs);
      }
    }
  }

  async moveToSelector(
    selector: string,
    options: CursorMoveOptions = {},
  ): Promise<Point> {
    const locator = this.#page.locator(selector).first();
    const point = await resolveLocatorCenter(locator);
    await this.move(point, options);
    return point;
  }

  async click(options: CursorClickOptions = {}): Promise<void> {
    const button = options.button ?? "left";
    const delayMs = options.delayMs ?? 40;

    await clickCursorOverlay(this.#page);
    await this.sample("click");
    await this.#page.mouse.down({ button });
    await this.#page.waitForTimeout(delayMs);
    await this.#page.mouse.up({ button });
    await this.sample("click");
  }

  async clickSelector(
    selector: string,
    options: CursorMoveOptions & CursorClickOptions = {},
  ): Promise<void> {
    await this.moveToSelector(selector, options);
    await this.click(options);
  }

  async type(text: string, options: CursorTypeOptions = {}): Promise<void> {
    await this.sample("wait");
    await this.#page.keyboard.type(text, {
      delay: options.delayMs ?? 90,
    });

    if (options.submit) {
      await this.#page.keyboard.press("Enter");
    }

    await this.sample("wait");
  }

  async typeSelector(
    selector: string,
    text: string,
    options: CursorTypeOptions = {},
  ): Promise<void> {
    await this.moveToSelector(selector, options);
    await this.click();
    await this.type(text, options);
  }

  async wait(durationMs: number): Promise<void> {
    await this.sample("wait");
    await this.#page.waitForTimeout(durationMs);
    await this.sample("wait");
  }
}
