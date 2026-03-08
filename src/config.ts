import path from "node:path";
import { pathToFileURL } from "node:url";

import type { DemoModule, LoadedMotionConfig, MotionConfig } from "./types.js";

const DEFAULTS = {
  browser: {
    headless: true,
    slowMo: 0,
  },
  camera: {
    padding: 96,
    zoom: 1.65,
  },
  output: {
    codec: "libx264" as const,
    fps: 30,
    height: 1080,
    width: 1920,
  },
  timing: {
    navigationTimeoutMs: 30_000,
    settleMs: 750,
  },
  viewport: {
    height: 900,
    width: 1440,
  },
};

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
    typeof config.url === "string" && config.url.length > 0,
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

  return {
    browser: {
      channel: config.browser?.channel,
      headless: config.browser?.headless ?? DEFAULTS.browser.headless,
      slowMo: config.browser?.slowMo ?? DEFAULTS.browser.slowMo,
    },
    camera: {
      padding: config.camera?.padding ?? DEFAULTS.camera.padding,
      zoom: config.camera?.zoom ?? DEFAULTS.camera.zoom,
    },
    configDir,
    configPath: absoluteConfigPath,
    demoPath,
    name,
    output: {
      codec: config.output?.codec ?? DEFAULTS.output.codec,
      dir: path.resolve(configDir, config.output?.dir ?? "output"),
      fps: config.output?.fps ?? DEFAULTS.output.fps,
      height: config.output?.height ?? DEFAULTS.output.height,
      width: config.output?.width ?? DEFAULTS.output.width,
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
    typeof demoModule.default === "function",
    "Demo module must export a default async function.",
  );

  return demoModule as DemoModule;
}

export function defineConfig(config: MotionConfig): MotionConfig {
  return config;
}
