import { performance } from "node:perf_hooks";

import type { Page } from "playwright";

import { resolveLocatorCenter } from "./locator.js";
import type {
  CameraController,
  CameraFocusOptions,
  CameraSample,
  CameraSampleKind,
  CameraState,
  CameraZoomOptions,
  Point,
} from "./types.js";

type CameraControllerOptions = {
  getCursorPoint: () => Point;
  initialState: CameraState;
  page: Page;
  viewportCenter: Point;
};

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

export class DemoCameraController implements CameraController {
  readonly #getCursorPoint: () => Point;

  readonly #page: Page;

  readonly #samples: CameraSample[] = [];

  readonly #startedAt = performance.now();

  readonly #viewportCenter: Point;

  current: CameraState;

  constructor({
    getCursorPoint,
    initialState,
    page,
    viewportCenter,
  }: CameraControllerOptions) {
    this.current = initialState;
    this.#getCursorPoint = getCursorPoint;
    this.#page = page;
    this.#viewportCenter = viewportCenter;
    this.#samples.push({
      kind: "focus",
      timeMs: 0,
      x: initialState.x,
      y: initialState.y,
      zoom: initialState.zoom,
    });
  }

  get samples(): CameraSample[] {
    return [...this.#samples];
  }

  async sample(kind: CameraSampleKind = "focus"): Promise<void> {
    this.#samples.push({
      kind,
      timeMs: performance.now() - this.#startedAt,
      x: this.current.x,
      y: this.current.y,
      zoom: this.current.zoom,
    });
  }

  async focus(point: Point, options: CameraFocusOptions = {}): Promise<void> {
    const durationMs = options.durationMs ?? 800;

    if (durationMs > 0) {
      await this.sample("focus");
      await this.#page.waitForTimeout(durationMs);
    }

    this.current = {
      x: point.x,
      y: point.y,
      zoom: options.zoom ?? this.current.zoom,
    };
    await this.sample("focus");
  }

  async focusSelector(
    selector: string,
    options: CameraFocusOptions = {},
  ): Promise<Point> {
    const locator = this.#page.locator(selector).first();
    const point = await resolveLocatorCenter(locator);
    await this.focus(point, options);
    return point;
  }

  async followCursor(options: CameraFocusOptions = {}): Promise<void> {
    await this.focus(this.#getCursorPoint(), options);
  }

  async wait(durationMs: number): Promise<void> {
    await this.sample("wait");
    await this.#page.waitForTimeout(durationMs);
    await this.sample("wait");
  }

  async wide(options: Omit<CameraFocusOptions, "zoom"> = {}): Promise<void> {
    await this.focus(this.#viewportCenter, {
      ...options,
      zoom: 1,
    });
  }

  async zoomTo(zoom: number, options: CameraZoomOptions = {}): Promise<void> {
    const durationMs = options.durationMs ?? 800;

    if (durationMs <= 0) {
      this.current = {
        x: options.point?.x ?? (options.followCursor ? this.#getCursorPoint().x : this.current.x),
        y: options.point?.y ?? (options.followCursor ? this.#getCursorPoint().y : this.current.y),
        zoom,
      };
      await this.sample("focus");
      return;
    }

    const steps = Math.max(6, Math.ceil(durationMs / 16));
    const delayMs = steps > 1 ? durationMs / steps : 0;
    const start = { ...this.current };
    const fixedTarget = options.point;

    for (let step = 1; step <= steps; step += 1) {
      const progress = easeInOutCubic(step / steps);
      const liveTarget =
        fixedTarget ?? (options.followCursor ? this.#getCursorPoint() : start);

      this.current = {
        x: interpolate(start.x, liveTarget.x, progress),
        y: interpolate(start.y, liveTarget.y, progress),
        zoom: interpolate(start.zoom, zoom, progress),
      };
      await this.sample("follow");

      if (step < steps && delayMs > 0) {
        await this.#page.waitForTimeout(delayMs);
      }
    }
  }

  async zoomOut(options: CameraZoomOptions = {}): Promise<void> {
    await this.zoomTo(1, options);
  }
}
