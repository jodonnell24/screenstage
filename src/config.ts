import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
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

const DEFAULTS = {
  browser: {
    headless: true,
    slowMo: 0,
  },
  camera: {
    deadzonePx: 18,
    padding: 96,
    smoothingMs: 180,
    zoom: 1.65,
  },
  composition: {
    background: {
      angle: 135,
      colors: ["#eef4ef", "#e7edf5"],
    },
    browser: {
      padding: 72,
      radius: 28,
      showAddressBar: true,
      showTrafficLights: true,
      toolbarHeight: 56,
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
const VALID_OUTPUT_PRESETS = new Set<OutputPreset>(
  Object.keys(OUTPUT_PRESETS) as OutputPreset[],
);
const VALID_COMPOSITION_PRESETS = new Set<CompositionPreset>([
  "none",
  "studio-browser",
  "spotlight-browser",
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

  assertCondition(
    VALID_OUTPUT_PRESETS.has(outputPreset),
    "Config output.preset must be 'release-hero', 'social-square', 'social-vertical', or 'motion-edit'.",
  );

  const presetOutput = OUTPUT_PRESETS[outputPreset];
  const formats = config.output?.formats ?? presetOutput.formats;

  assertCondition(
    Array.isArray(formats) && formats.length > 0,
    "Config output.formats must be a non-empty array.",
  );
  assertCondition(
    formats.every((format) => VALID_OUTPUT_FORMATS.has(format)),
    "Config output.formats must only include 'mp4' or 'prores'.",
  );
  assertCondition(
    VALID_COMPOSITION_PRESETS.has(compositionPreset),
    "Config composition.preset must be 'none', 'studio-browser', or 'spotlight-browser'.",
  );

  return {
    browser: {
      channel: config.browser?.channel,
      headless: config.browser?.headless ?? DEFAULTS.browser.headless,
      slowMo: config.browser?.slowMo ?? DEFAULTS.browser.slowMo,
    },
    camera: {
      deadzonePx: config.camera?.deadzonePx ?? DEFAULTS.camera.deadzonePx,
      padding: config.camera?.padding ?? DEFAULTS.camera.padding,
      smoothingMs:
        config.camera?.smoothingMs ?? DEFAULTS.camera.smoothingMs,
      zoom: config.camera?.zoom ?? DEFAULTS.camera.zoom,
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
      browser: {
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
