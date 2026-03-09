import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  BrowserCaptureMode,
  BrowserCursorMode,
  CameraMode,
  CameraPreset,
  CompositionBackgroundPreset,
  CompositionBrowserStyle,
  CompositionDevice,
  CompositionPreset,
  DemoModule,
  LoadedMotionConfig,
  MotionConfig,
  OutputFormat,
  OutputPreset,
  SetupModule,
  SetupQueryValue,
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
    cursor: {
      hideSelectors: [] as string[],
      mode: "motion" as BrowserCursorMode,
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
      preset: "soft-studio" as CompositionBackgroundPreset,
    },
    device: "desktop" as CompositionDevice,
    browser: {
      domain: undefined,
      padding: 72,
      radius: 28,
      showAddressBar: true,
      style: "polished" as CompositionBrowserStyle,
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
const VALID_COMPOSITION_BACKGROUND_PRESETS = new Set<CompositionBackgroundPreset>([
  "soft-studio",
  "warm-editor",
  "cool-stage",
  "midnight-fade",
]);
const VALID_COMPOSITION_BROWSER_STYLES = new Set<CompositionBrowserStyle>([
  "polished",
  "minimal",
  "glass",
]);
const VALID_BROWSER_CAPTURE_MODES = new Set<BrowserCaptureMode>([
  "balanced",
  "rgb-frames",
  "video",
]);
const VALID_BROWSER_CURSOR_MODES = new Set<BrowserCursorMode>([
  "motion",
  "app",
]);

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

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

export type LoadConfigOverrides = {
  headless?: boolean;
  outputDir?: string;
};

function normalizeSetupQuery(
  value: Record<string, SetupQueryValue> | undefined,
): Record<string, SetupQueryValue> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key.trim().length > 0),
  ) as Record<string, SetupQueryValue>;
}

export async function loadConfig(
  configPath: string,
  overrides: LoadConfigOverrides = {},
): Promise<LoadedMotionConfig> {
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
  const compositionBackgroundPreset =
    config.composition?.background?.preset ??
    DEFAULTS.composition.background.preset;
  const compositionBrowserStyle =
    config.composition?.browser?.style ?? DEFAULTS.composition.browser.style;
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
  const browserCursorMode =
    config.browser?.cursor?.mode ?? DEFAULTS.browser.cursor.mode;
  const browserCursorHideSelectors = normalizeStringList(
    config.browser?.cursor?.hideSelectors,
  );

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
  assertCondition(
    VALID_BROWSER_CURSOR_MODES.has(browserCursorMode),
    "Config browser.cursor.mode must be 'motion' or 'app'.",
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
  const setupModulePath =
    typeof config.setup?.module === "string" && config.setup.module.trim().length > 0
      ? path.resolve(configDir, config.setup.module)
      : undefined;
  const setupQuery = normalizeSetupQuery(config.setup?.query);

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
  assertCondition(
    VALID_COMPOSITION_BACKGROUND_PRESETS.has(compositionBackgroundPreset),
    "Config composition.background.preset must be 'soft-studio', 'warm-editor', 'cool-stage', or 'midnight-fade'.",
  );
  assertCondition(
    VALID_COMPOSITION_BROWSER_STYLES.has(compositionBrowserStyle),
    "Config composition.browser.style must be 'polished', 'minimal', or 'glass'.",
  );
  assertCondition(
    !config.setup?.colorScheme ||
      config.setup.colorScheme === "light" ||
      config.setup.colorScheme === "dark",
    "Config setup.colorScheme must be 'light' or 'dark'.",
  );

  return {
    browser: {
      capture: {
        fps: browserCaptureFps,
        jpegQuality: browserCaptureJpegQuality,
        mode: browserCaptureMode,
      },
      cursor: {
        hideSelectors: browserCursorHideSelectors,
        mode: browserCursorMode,
      },
      channel: config.browser?.channel,
      headless:
        overrides.headless ?? config.browser?.headless ?? DEFAULTS.browser.headless,
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
        preset: compositionBackgroundPreset,
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
        style: compositionBrowserStyle,
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
    setup:
      config.setup || setupModulePath
        ? {
            colorScheme: config.setup?.colorScheme,
            cookies: Array.isArray(config.setup?.cookies)
              ? config.setup.cookies
              : [],
            hash:
              typeof config.setup?.hash === "string" &&
              config.setup.hash.trim().length > 0
                ? config.setup.hash.trim()
                : undefined,
            localStorage:
              config.setup?.localStorage && typeof config.setup.localStorage === "object"
                ? config.setup.localStorage
                : {},
            modulePath: setupModulePath,
            query: setupQuery,
            route:
              typeof config.setup?.route === "string" &&
              config.setup.route.trim().length > 0
                ? config.setup.route.trim()
                : undefined,
            sessionStorage:
              config.setup?.sessionStorage &&
              typeof config.setup.sessionStorage === "object"
                ? config.setup.sessionStorage
                : {},
            waitFor:
              config.setup?.waitFor?.selector || config.setup?.waitFor?.text
                ? {
                    selector:
                      typeof config.setup.waitFor?.selector === "string" &&
                      config.setup.waitFor.selector.trim().length > 0
                        ? config.setup.waitFor.selector.trim()
                        : undefined,
                    text:
                      typeof config.setup.waitFor?.text === "string" &&
                      config.setup.waitFor.text.trim().length > 0
                        ? config.setup.waitFor.text.trim()
                        : undefined,
                    timeoutMs:
                      config.setup?.waitFor?.timeoutMs ?? DEFAULTS.timing.navigationTimeoutMs,
                  }
                : undefined,
          }
        : undefined,
    output: {
      dir: overrides.outputDir
        ? path.resolve(overrides.outputDir)
        : path.resolve(configDir, config.output?.dir ?? "output"),
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

export async function loadSetupModule(
  setupModulePath: string,
): Promise<SetupModule> {
  const absoluteSetupPath = path.resolve(setupModulePath);
  const setupModule = await import(pathToFileURL(absoluteSetupPath).href);

  assertCondition(
    typeof setupModule.default === "function",
    "Setup module must export a default async function.",
  );

  return setupModule as SetupModule;
}

export function defineConfig(config: MotionConfig): MotionConfig {
  return config;
}
