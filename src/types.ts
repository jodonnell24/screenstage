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
export type OutputFormat = "mp4" | "prores";

export type CursorSampleKind = "move" | "wait" | "click";
export type CameraSampleKind = "focus" | "wait";

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
    formats?: OutputFormat[];
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
    dir: string;
    fps: number;
    formats: OutputFormat[];
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

export type CursorTypeOptions = CursorMoveOptions & {
  delayMs?: number;
  submit?: boolean;
};

export type CameraState = Point & {
  zoom: number;
};

export type CameraSample = CameraState & {
  kind: CameraSampleKind;
  timeMs: number;
};

export type CameraFocusOptions = {
  durationMs?: number;
  zoom?: number;
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
  type: (text: string, options?: CursorTypeOptions) => Promise<void>;
  typeSelector: (
    selector: string,
    text: string,
    options?: CursorTypeOptions,
  ) => Promise<void>;
  wait: (durationMs: number) => Promise<void>;
};

export type CameraController = {
  current: CameraState;
  focus: (point: Point, options?: CameraFocusOptions) => Promise<void>;
  focusSelector: (
    selector: string,
    options?: CameraFocusOptions,
  ) => Promise<Point>;
  followCursor: (options?: CameraFocusOptions) => Promise<void>;
  sample: (kind?: CameraSampleKind) => Promise<void>;
  wait: (durationMs: number) => Promise<void>;
  wide: (options?: Omit<CameraFocusOptions, "zoom">) => Promise<void>;
};

export type SceneBase = {
  label?: string;
};

export type MotionScene =
  | (SceneBase & {
      durationMs?: number;
      type: "wide";
    })
  | (SceneBase & {
      durationMs?: number;
      type: "follow-cursor";
      zoom?: number;
    })
  | (SceneBase & {
      durationMs?: number;
      selector: string;
      type: "focus-selector";
      zoom?: number;
    })
  | (SceneBase & {
      durationMs?: number;
      point: Point;
      type: "focus-point";
      zoom?: number;
    })
  | (SceneBase & {
      durationMs?: number;
      selector: string;
      steps?: number;
      type: "move-selector";
    })
  | (SceneBase & {
      durationMs?: number;
      point: Point;
      steps?: number;
      type: "move-point";
    })
  | (SceneBase & {
      button?: MouseButton;
      delayMs?: number;
      type: "click";
    })
  | (SceneBase & {
      button?: MouseButton;
      delayMs?: number;
      durationMs?: number;
      selector: string;
      steps?: number;
      type: "click-selector";
    })
  | (SceneBase & {
      delayMs?: number;
      submit?: boolean;
      text: string;
      type: "type";
    })
  | (SceneBase & {
      delayMs?: number;
      durationMs?: number;
      selector: string;
      steps?: number;
      submit?: boolean;
      text: string;
      type: "type-selector";
    })
  | (SceneBase & {
      durationMs: number;
      target?: "both" | "camera" | "cursor";
      type: "wait";
    });

export type SceneProgram = MotionScene[];

export type DemoContext = {
  camera: CameraController;
  config: LoadedMotionConfig;
  cursor: CursorController;
  page: Page;
  sessionDir: string;
};

export type DemoProgram = ((context: DemoContext) => Promise<void>) | SceneProgram;

export type DemoModule = {
  default: DemoProgram;
};

export type FfmpegPlan = {
  args: string[];
  cropHeightExpression: string;
  cropWidthExpression: string;
  format: OutputFormat;
  outputPath: string;
  sourcePath: string;
  xExpression: string;
  yExpression: string;
};
