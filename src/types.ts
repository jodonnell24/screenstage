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
export type CameraMode = "follow" | "static";
export type OutputPreset =
  | "release-hero"
  | "social-square"
  | "social-vertical"
  | "motion-edit";
export type CompositionPreset =
  | "none"
  | "studio-browser"
  | "spotlight-browser";

export type CursorSampleKind = "move" | "wait" | "click";
export type CameraSampleKind = "focus" | "wait";

export type CursorSample = Point & {
  kind: CursorSampleKind;
  timeMs: number;
};

export type MotionConfig = {
  name?: string;
  url?: string;
  demo: string;
  viewport?: Partial<Size>;
  output?: {
    dir?: string;
    preset?: OutputPreset;
    width?: number;
    height?: number;
    fps?: number;
    formats?: OutputFormat[];
  };
  camera?: {
    deadzonePx?: number;
    mode?: CameraMode;
    zoom?: number;
    padding?: number;
    smoothingMs?: number;
  };
  composition?: {
    background?: {
      angle?: number;
      colors?: string[];
    };
    browser?: {
      padding?: number;
      radius?: number;
      showAddressBar?: boolean;
      showTrafficLights?: boolean;
      toolbarHeight?: number;
    };
    preset?: CompositionPreset;
  };
  browser?: {
    headless?: boolean;
    slowMo?: number;
    channel?: string;
  };
  serve?: {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    readyText?: string;
    shell?: string;
    timeoutMs?: number;
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
    deadzonePx: number;
    mode: CameraMode;
    padding: number;
    smoothingMs: number;
    zoom: number;
  };
  composition: {
    background: {
      angle: number;
      colors: string[];
    };
    browser: {
      padding: number;
      radius: number;
      showAddressBar: boolean;
      showTrafficLights: boolean;
      toolbarHeight: number;
    };
    preset: CompositionPreset;
  };
  configDir: string;
  configPath: string;
  demoPath: string;
  name: string;
  serve?: {
    command: string;
    cwd: string;
    env?: Record<string, string>;
    readyText?: string;
    shell?: string;
    timeoutMs: number;
  };
  output: {
    dir: string;
    fps: number;
    formats: OutputFormat[];
    height: number;
    preset: OutputPreset;
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

export type FeatureTourAction = "focus" | "move" | "click" | "type";

export type FeatureTourStep = {
  action?: FeatureTourAction;
  clickDelayMs?: number;
  focusDurationMs?: number;
  handoffDurationMs?: number;
  label?: string;
  moveDurationMs?: number;
  pauseMs?: number;
  pauseTarget?: "both" | "camera" | "cursor";
  selector: string;
  steps?: number;
  submit?: boolean;
  text?: string;
  typingDelayMs?: number;
  typingDurationMs?: number;
  zoom?: number;
};

export type FeatureTourOptions = {
  establishDurationMs?: number;
  includeEstablishingShot?: boolean;
  introPauseMs?: number;
  outroPauseMs?: number;
  steps: FeatureTourStep[];
};

export type FormFillField = {
  label?: string;
  pauseMs?: number;
  selector: string;
  submit?: boolean;
  text: string;
  typingDelayMs?: number;
  typingDurationMs?: number;
  zoom?: number;
};

export type FormFillCaptureOptions = {
  establishDurationMs?: number;
  fields: FormFillField[];
  includeEstablishingShot?: boolean;
  introPauseMs?: number;
  outroPauseMs?: number;
  submitClickDelayMs?: number;
  submitMoveDurationMs?: number;
  submitPauseMs?: number;
  submitSelector?: string;
  submitZoom?: number;
};

export type HeroWalkthroughOptions = {
  ctaSelector: string;
  ctaZoom?: number;
  ctaMoveDurationMs?: number;
  fieldSelector: string;
  fieldText: string;
  fieldZoom?: number;
  introPauseMs?: number;
  metricMoveDurationMs?: number;
  metricPauseMs?: number;
  metricSelector?: string;
  metricZoom?: number;
  outroPauseMs?: number;
};

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
  compositionAssetPath?: string;
  cropHeightExpression: string;
  cropWidthExpression: string;
  durationSeconds: number;
  format: OutputFormat;
  outputPath: string;
  sourcePath: string;
  xExpression: string;
  yExpression: string;
};

export type CompositionLayout = {
  assetPath?: string;
  contentHeight: number;
  contentWidth: number;
  contentX: number;
  contentY: number;
  enabled: boolean;
  outputHeight: number;
  outputWidth: number;
  preset: CompositionPreset;
  windowHeight?: number;
  windowWidth?: number;
  windowX?: number;
  windowY?: number;
};
