import { performance } from "node:perf_hooks";

import type { Page } from "playwright";

import { resolveLocatorCenter } from "./locator.js";
import type {
  CameraController,
  CameraFocusOptions,
  CameraSample,
  CameraSampleKind,
  CameraState,
  Point,
} from "./types.js";

type CameraControllerOptions = {
  getCursorPoint: () => Point;
  initialState: CameraState;
  page: Page;
  viewportCenter: Point;
};

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
}
