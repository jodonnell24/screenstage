import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import { DemoCameraController } from "./camera-controller.js";
import { loadConfig, loadDemoModule } from "./config.js";
import { DemoCursorController } from "./cursor-controller.js";
import { installCursorOverlay, moveCursorOverlay } from "./cursor-overlay.js";
import { buildFfmpegPlans, commandExists, renderWithFfmpeg } from "./ffmpeg.js";
import { runScenes } from "./scenes.js";
import { startManagedService } from "./serve.js";

function stamp(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

export async function runMotion(configPath: string): Promise<void> {
  const config = await loadConfig(configPath);
  const demoModule = await loadDemoModule(config.demoPath);
  const sessionName = `${config.name}-${stamp()}`;
  const sessionDir = path.join(config.output.dir, sessionName);
  const recordingsDir = path.join(sessionDir, "recordings");
  const sourceVideoPath = path.join(sessionDir, "source.webm");
  const managedService = await startManagedService(config);

  await fs.mkdir(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    channel: config.browser.channel,
    headless: config.browser.headless,
    slowMo: config.browser.slowMo,
  });

  const context = await browser.newContext({
    recordVideo: {
      dir: recordingsDir,
      size: config.viewport,
    },
    viewport: config.viewport,
  });

  const page = await context.newPage();
  page.setDefaultNavigationTimeout(config.timing.navigationTimeoutMs);

  const initialPoint = {
    x: config.viewport.width / 2,
    y: config.viewport.height / 2,
  };

  const cursor = new DemoCursorController({
    initialPoint,
    page,
  });
  const camera = new DemoCameraController({
    getCursorPoint: () => cursor.current,
    initialState: {
      ...initialPoint,
      zoom: config.camera.zoom,
    },
    page,
    viewportCenter: initialPoint,
  });

  const video = page.video();

  try {
    await installCursorOverlay(page);
    await page.goto(config.url, { waitUntil: "load" });
    await moveCursorOverlay(page, initialPoint.x, initialPoint.y);

    const demoContext = {
      camera,
      config,
      cursor,
      page,
      sessionDir,
    };

    if (Array.isArray(demoModule.default)) {
      await runScenes(demoModule.default, demoContext);
    } else {
      await demoModule.default(demoContext);
    }

    await cursor.wait(config.timing.settleMs);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    await managedService?.stop();
  }

  const recordedVideoPath = await video?.path();

  if (!recordedVideoPath) {
    throw new Error("Playwright did not produce a source video.");
  }

  await fs.rename(recordedVideoPath, sourceVideoPath);

  const ffmpegPlans = buildFfmpegPlans(
    sourceVideoPath,
    sessionDir,
    config,
    cursor.samples,
    camera.samples,
  );

  await fs.writeFile(
    path.join(sessionDir, "timeline.json"),
    JSON.stringify(
      {
        config,
        demoProgramType: Array.isArray(demoModule.default) ? "scenes" : "function",
        ffmpegPlans,
        cameraSamples: camera.samples,
        scenes: Array.isArray(demoModule.default) ? demoModule.default : undefined,
        samples: cursor.samples,
      },
      null,
      2,
    ),
    "utf8",
  );

  if (await commandExists("ffmpeg")) {
    for (const plan of ffmpegPlans) {
      await renderWithFfmpeg(plan);
      console.log(`Rendered ${plan.format} video: ${plan.outputPath}`);
    }
    return;
  }

  console.log("ffmpeg was not found on PATH. Generated plan only.");
  console.log(`Source video: ${sourceVideoPath}`);

  for (const plan of ffmpegPlans) {
    console.log(`Planned ${plan.format} output: ${plan.outputPath}`);
    console.log(`Run manually: ffmpeg ${plan.args.join(" ")}`);
  }
}
