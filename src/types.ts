import type { Page } from "playwright";

export type Point = {
  x: number;
  y: number;
};

export type Size = {
  width: number;
  height: number;
};

export type MouseButton = "left" | "middle" | "right";

export type CursorSampleKind = "move" | "wait" | "click";

export type CursorSample = Point & {
  kind: CursorSampleKind;
  timeMs: number;
};

export type MotionConfig = {
  name?: string;
  url: string;
  demo: string;
  viewport?: Partial<Size>;
  output?: {
    dir?: string;
    width?: number;
    height?: number;
    fps?: number;
    codec?: "libx264";
  };
  camera?: {
    zoom?: number;
    padding?: number;
  };
  browser?: {
    headless?: boolean;
    slowMo?: number;
    channel?: string;
  };
  timing?: {
    navigationTimeoutMs?: number;
    settleMs?: number;
  };
};

export type LoadedMotionConfig = {
  browser: {
    channel?: string;
    headless: boolean;
    slowMo: number;
  };
  camera: {
    padding: number;
    zoom: number;
  };
  configDir: string;
  configPath: string;
  demoPath: string;
  name: string;
  output: {
    codec: "libx264";
    dir: string;
    fps: number;
    height: number;
    width: number;
  };
  timing: {
    navigationTimeoutMs: number;
    settleMs: number;
  };
  url: string;
  viewport: Size;
};

export type CursorMoveOptions = {
  durationMs?: number;
  steps?: number;
};

export type CursorClickOptions = {
  button?: MouseButton;
  delayMs?: number;
};

export type CursorController = {
  click: (options?: CursorClickOptions) => Promise<void>;
  clickSelector: (
    selector: string,
    options?: CursorMoveOptions & CursorClickOptions,
  ) => Promise<void>;
  current: Point;
  move: (point: Point, options?: CursorMoveOptions) => Promise<void>;
  moveToSelector: (
    selector: string,
    options?: CursorMoveOptions,
  ) => Promise<Point>;
  sample: (kind?: CursorSampleKind) => Promise<void>;
  wait: (durationMs: number) => Promise<void>;
};

export type DemoContext = {
  config: LoadedMotionConfig;
  cursor: CursorController;
  page: Page;
  sessionDir: string;
};

export type DemoModule = {
  default: (context: DemoContext) => Promise<void>;
};

export type FfmpegPlan = {
  args: string[];
  cropHeight: number;
  cropWidth: number;
  outputPath: string;
  sourcePath: string;
  xExpression: string;
  yExpression: string;
};
