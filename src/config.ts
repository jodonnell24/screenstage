import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  BrowserCaptureMode,
  CameraMode,
  CameraPreset,
  CompositionDevice,
  CompositionPreset,
  DemoModule,
  LoadedMotionConfig,
  MotionConfig,
  OutputFormat,
  OutputPreset,
} from "./types.js";

const OUTPUT_PRESETS: Record<
  OutputPreset,
  {
    formats: OutputFormat[];
    fps: number;
    height: number;
    width: number;
  }
> = {
  "motion-edit": {
    formats: ["mp4", "prores"],
    fps: 30,
    height: 1440,
    width: 2560,
  },
  "release-hero": {
    formats: ["mp4", "prores"],
    fps: 30,
    height: 1080,
    width: 1920,
  },
  "social-square": {
    formats: ["mp4"],
    fps: 30,
    height: 1080,
    width: 1080,
  },
  "social-vertical": {
    formats: ["mp4"],
    fps: 30,
    height: 1920,
    width: 1080,
  },
};

const CAMERA_PRESETS: Record<
  CameraPreset,
  {
    deadzonePx: number;
    mode: CameraMode;
    padding: number;
    smoothingMs: number;
    verticalWeight: number;
    zoom: number;
  }
> = {
  "lazy-follow": {
    deadzonePx: 34,
    mode: "follow",
    padding: 128,
    smoothingMs: 300,
    verticalWeight: 0.58,
    zoom: 1.35,
  },
  "showcase-follow": {
    deadzonePx: 24,
    mode: "follow",
    padding: 104,
    smoothingMs: 220,
    verticalWeight: 0.68,
    zoom: 1.75,
  },
  static: {
    deadzonePx: 0,
    mode: "static",
    padding: 96,
    smoothingMs: 0,
    verticalWeight: 1,
    zoom: 1,
  },
  "tight-follow": {
    deadzonePx: 14,
    mode: "follow",
    padding: 72,
    smoothingMs: 150,
    verticalWeight: 0.82,
    zoom: 2.05,
  },
};

const DEFAULTS = {
  browser: {
    capture: {
      fps: 15,
      jpegQuality: 90,
      mode: "video" as BrowserCaptureMode,
    },
    headless: true,
    slowMo: 0,
    studio: {
      controlsWidth: 340,
      enabled: false,
      padding: 28,
    },
  },
  camera: {
    preset: "showcase-follow" as CameraPreset,
  },
  composition: {
    background: {
      angle: 135,
      colors: ["#eef4ef", "#e7edf5"],
    },
    device: "desktop" as CompositionDevice,
    browser: {
      domain: undefined,
      padding: 72,
      radius: 28,
      showAddressBar: true,
      showTrafficLights: true,
      toolbarHeight: 56,
    },
    phone: {
      color: "#11151b",
      framePadding: 18,
      showCameraIsland: true,
      showHomeIndicator: true,
    },
    preset: "studio-browser" as CompositionPreset,
  },
  output: {
    preset: "release-hero" as OutputPreset,
  },
  timing: {
    navigationTimeoutMs: 30_000,
    settleMs: 750,
  },
  serve: {
    timeoutMs: 30_000,
  },
  viewport: {
    height: 900,
    width: 1440,
  },
};

const VALID_OUTPUT_FORMATS = new Set<OutputFormat>(["mp4", "prores"]);
const VALID_CAMERA_MODES = new Set<CameraMode>(["follow", "static"]);
const VALID_CAMERA_PRESETS = new Set<CameraPreset>(
  Object.keys(CAMERA_PRESETS) as CameraPreset[],
);
const VALID_OUTPUT_PRESETS = new Set<OutputPreset>(
  Object.keys(OUTPUT_PRESETS) as OutputPreset[],
);
const VALID_COMPOSITION_PRESETS = new Set<CompositionPreset>([
  "none",
  "studio-browser",
  "spotlight-browser",
]);
const VALID_COMPOSITION_DEVICES = new Set<CompositionDevice>([
  "desktop",
  "phone",
]);
const VALID_BROWSER_CAPTURE_MODES = new Set<BrowserCaptureMode>([
  "balanced",
  "rgb-frames",
  "video",
]);

function assertCondition(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function asMotionConfig(moduleValue: unknown): MotionConfig {
  const candidate =
    typeof moduleValue === "object" &&
    moduleValue !== null &&
    "default" in moduleValue
      ? (moduleValue as { default: unknown }).default
      : moduleValue;

  assertCondition(
    typeof candidate === "object" && candidate !== null,
    "Config module must export a default object.",
  );

  return candidate as MotionConfig;
}

function resolveBrowserDomain(url: string): string | undefined {
  try {
    const parsed = new URL(url);

    if (parsed.protocol === "file:") {
      return "local-preview";
    }

    return parsed.host || undefined;
  } catch {
    return undefined;
  }
}

export async function loadConfig(configPath: string): Promise<LoadedMotionConfig> {
  const absoluteConfigPath = path.resolve(configPath);
  const configModule = await import(pathToFileURL(absoluteConfigPath).href);
  const config = asMotionConfig(configModule);

  assertCondition(
    (typeof config.url === "string" && config.url.length > 0) ||
      (typeof config.serve?.command === "string" &&
        config.serve.command.length > 0 &&
        typeof config.url === "string" &&
        config.url.length > 0),
    "Config must include a non-empty 'url'.",
  );
  assertCondition(
    typeof config.demo === "string" && config.demo.length > 0,
    "Config must include a non-empty 'demo' path.",
  );

  const configDir = path.dirname(absoluteConfigPath);
  const demoPath = path.resolve(configDir, config.demo);
  const name =
    typeof config.name === "string" && config.name.trim().length > 0
      ? config.name.trim()
      : path.basename(absoluteConfigPath, path.extname(absoluteConfigPath));

  const outputPreset = config.output?.preset ?? DEFAULTS.output.preset;
  const compositionPreset =
    config.composition?.preset ?? DEFAULTS.composition.preset;
  const compositionDevice =
    config.composition?.device ?? DEFAULTS.composition.device;
  const cameraPreset = config.camera?.preset ?? DEFAULTS.camera.preset;
  assertCondition(
    !config.camera?.preset || VALID_CAMERA_PRESETS.has(config.camera.preset),
    "Config camera.preset must be 'showcase-follow', 'tight-follow', 'lazy-follow', or 'static'.",
  );
  const resolvedCameraPreset = cameraPreset;
  const presetCamera = CAMERA_PRESETS[resolvedCameraPreset];
  const cameraMode = config.camera?.mode ?? presetCamera.mode;
  const defaultBrowserDomain = resolveBrowserDomain(config.url);
  const browserCaptureMode =
    config.browser?.capture?.mode ?? DEFAULTS.browser.capture.mode;

  assertCondition(
    VALID_OUTPUT_PRESETS.has(outputPreset),
    "Config output.preset must be 'release-hero', 'social-square', 'social-vertical', or 'motion-edit'.",
  );
  assertCondition(
    VALID_CAMERA_MODES.has(cameraMode),
    "Config camera.mode must be 'follow' or 'static'.",
  );
  assertCondition(
    VALID_BROWSER_CAPTURE_MODES.has(browserCaptureMode),
    "Config browser.capture.mode must be 'balanced', 'rgb-frames', or 'video'.",
  );
  const presetOutput = OUTPUT_PRESETS[outputPreset];
  const formats = config.output?.formats ?? presetOutput.formats;
  const browserCaptureFps =
    config.browser?.capture?.fps ??
    (browserCaptureMode === "rgb-frames"
      ? presetOutput.fps
      : DEFAULTS.browser.capture.fps);
  const browserCaptureJpegQuality =
    config.browser?.capture?.jpegQuality ?? DEFAULTS.browser.capture.jpegQuality;

  assertCondition(
    Array.isArray(formats) && formats.length > 0,
    "Config output.formats must be a non-empty array.",
  );
  assertCondition(
    formats.every((format) => VALID_OUTPUT_FORMATS.has(format)),
    "Config output.formats must only include 'mp4' or 'prores'.",
  );
  assertCondition(
    Number.isFinite(browserCaptureFps) && browserCaptureFps > 0,
    "Config browser.capture.fps must be a positive number.",
  );
  assertCondition(
    Number.isFinite(browserCaptureJpegQuality) &&
      browserCaptureJpegQuality >= 1 &&
      browserCaptureJpegQuality <= 100,
    "Config browser.capture.jpegQuality must be between 1 and 100.",
  );
  assertCondition(
    VALID_COMPOSITION_PRESETS.has(compositionPreset),
    "Config composition.preset must be 'none', 'studio-browser', or 'spotlight-browser'.",
  );
  assertCondition(
    VALID_COMPOSITION_DEVICES.has(compositionDevice),
    "Config composition.device must be 'desktop' or 'phone'.",
  );

  return {
    browser: {
      capture: {
        fps: browserCaptureFps,
        jpegQuality: browserCaptureJpegQuality,
        mode: browserCaptureMode,
      },
      channel: config.browser?.channel,
      headless: config.browser?.headless ?? DEFAULTS.browser.headless,
      slowMo: config.browser?.slowMo ?? DEFAULTS.browser.slowMo,
      studio: {
        controlsWidth:
          config.browser?.studio?.controlsWidth ??
          DEFAULTS.browser.studio.controlsWidth,
        enabled:
          config.browser?.studio?.enabled ?? DEFAULTS.browser.studio.enabled,
        padding:
          config.browser?.studio?.padding ??
          DEFAULTS.browser.studio.padding,
      },
    },
    camera: {
      deadzonePx: config.camera?.deadzonePx ?? presetCamera.deadzonePx,
      mode: cameraMode,
      padding: config.camera?.padding ?? presetCamera.padding,
      preset: resolvedCameraPreset,
      smoothingMs:
        config.camera?.smoothingMs ?? presetCamera.smoothingMs,
      verticalWeight:
        config.camera?.verticalWeight ?? presetCamera.verticalWeight,
      zoom: config.camera?.zoom ?? presetCamera.zoom,
    },
    composition: {
      background: {
        angle:
          config.composition?.background?.angle ??
          DEFAULTS.composition.background.angle,
        colors:
          config.composition?.background?.colors ??
          DEFAULTS.composition.background.colors,
      },
      device: compositionDevice,
      browser: {
        domain:
          typeof config.composition?.browser?.domain === "string" &&
          config.composition.browser.domain.trim().length > 0
            ? config.composition.browser.domain.trim()
            : defaultBrowserDomain ?? DEFAULTS.composition.browser.domain,
        padding:
          config.composition?.browser?.padding ??
          DEFAULTS.composition.browser.padding,
        radius:
          config.composition?.browser?.radius ??
          DEFAULTS.composition.browser.radius,
        showAddressBar:
          config.composition?.browser?.showAddressBar ??
          DEFAULTS.composition.browser.showAddressBar,
        showTrafficLights:
          config.composition?.browser?.showTrafficLights ??
          DEFAULTS.composition.browser.showTrafficLights,
        toolbarHeight:
          config.composition?.browser?.toolbarHeight ??
          DEFAULTS.composition.browser.toolbarHeight,
      },
      phone: {
        color:
          typeof config.composition?.phone?.color === "string" &&
          config.composition.phone.color.trim().length > 0
            ? config.composition.phone.color.trim()
            : DEFAULTS.composition.phone.color,
        framePadding:
          config.composition?.phone?.framePadding ??
          DEFAULTS.composition.phone.framePadding,
        showCameraIsland:
          config.composition?.phone?.showCameraIsland ??
          DEFAULTS.composition.phone.showCameraIsland,
        showHomeIndicator:
          config.composition?.phone?.showHomeIndicator ??
          DEFAULTS.composition.phone.showHomeIndicator,
      },
      preset: compositionPreset,
    },
    configDir,
    configPath: absoluteConfigPath,
    demoPath,
    name,
    serve: config.serve
      ? {
          command: config.serve.command,
          cwd: path.resolve(configDir, config.serve.cwd ?? "."),
          env: config.serve.env,
          readyText: config.serve.readyText,
          shell: config.serve.shell,
          timeoutMs: config.serve.timeoutMs ?? DEFAULTS.serve.timeoutMs,
        }
      : undefined,
    output: {
      dir: path.resolve(configDir, config.output?.dir ?? "output"),
      fps: config.output?.fps ?? presetOutput.fps,
      formats,
      height: config.output?.height ?? presetOutput.height,
      preset: outputPreset,
      width: config.output?.width ?? presetOutput.width,
    },
    timing: {
      navigationTimeoutMs:
        config.timing?.navigationTimeoutMs ?? DEFAULTS.timing.navigationTimeoutMs,
      settleMs: config.timing?.settleMs ?? DEFAULTS.timing.settleMs,
    },
    url: config.url,
    viewport: {
      height: config.viewport?.height ?? DEFAULTS.viewport.height,
      width: config.viewport?.width ?? DEFAULTS.viewport.width,
    },
  };
}

export async function loadDemoModule(demoPath: string): Promise<DemoModule> {
  const absoluteDemoPath = path.resolve(demoPath);
  const demoModule = await import(pathToFileURL(absoluteDemoPath).href);

  assertCondition(
    typeof demoModule.default === "function" || Array.isArray(demoModule.default),
    "Demo module must export a default async function or a default scene array.",
  );

  return demoModule as DemoModule;
}

export function defineConfig(config: MotionConfig): MotionConfig {
  return config;
}
