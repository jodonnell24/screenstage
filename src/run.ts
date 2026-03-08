import fs from "node:fs/promises";
import path from "node:path";

import type { BrowserContext } from "playwright";
import { chromium } from "playwright";

import { DemoCameraController } from "./camera-controller.js";
import { prepareComposition } from "./composition.js";
import { loadConfig, loadDemoModule } from "./config.js";
import { DemoCursorController } from "./cursor-controller.js";
import { installCursorOverlay, moveCursorOverlay } from "./cursor-overlay.js";
import {
  buildFfmpegPlans,
  commandExists,
  renderContactSheet,
  renderPosterFrame,
  renderWithFfmpeg,
} from "./ffmpeg.js";
import { runScenes } from "./scenes.js";
import { startManagedService } from "./serve.js";
import {
  applyContextSetup,
  applyPageEmulation,
  applyPageSetup,
  resolveCaptureUrl,
} from "./setup.js";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

function stamp(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

export async function runMotion(configPath: string): Promise<void> {
  const config = await loadConfig(configPath);
  const demoModule = await loadDemoModule(config.demoPath);
  const captureUrl = resolveCaptureUrl(config);
  const sessionName = `${config.name}-${stamp()}`;
  const sessionDir = path.join(config.output.dir, sessionName);
  const recordingsDir = path.join(sessionDir, "recordings");
  const sourceVideoPath = path.join(sessionDir, "source.webm");
  const managedService = await startManagedService(config);

  await fs.mkdir(recordingsDir, { recursive: true });
  const compositionLayout = await prepareComposition(sessionDir, config);

  const browser = await chromium.launch({
    channel: config.browser.channel,
    headless: config.browser.headless,
    slowMo: config.browser.slowMo,
  });

  let storageState: StorageState | undefined;

  if (config.setup) {
    const setupContext = await browser.newContext({
      viewport: config.viewport,
    });
    await applyContextSetup(config, setupContext, captureUrl);
    const setupPage = await setupContext.newPage();
    await applyPageEmulation(config, setupPage);
    setupPage.setDefaultNavigationTimeout(config.timing.navigationTimeoutMs);
    await setupPage.goto(captureUrl, { waitUntil: "load" });
    await applyPageSetup(
      config,
      setupContext,
      setupPage,
      setupPage,
      sessionDir,
      captureUrl,
    );
    storageState = await setupContext.storageState({
      path: path.join(sessionDir, "setup-state.json"),
    });
    await setupPage.close();
    await setupContext.close();
  }

  const context = await browser.newContext({
    ...(storageState ? { storageState } : {}),
    recordVideo: {
      dir: recordingsDir,
      size: config.viewport,
    },
    viewport: config.viewport,
  });
  await applyContextSetup(config, context, captureUrl);

  const page = await context.newPage();
  await applyPageEmulation(config, page);
  page.setDefaultNavigationTimeout(config.timing.navigationTimeoutMs);

  const initialPoint = {
    x: config.viewport.width / 2,
    y: config.viewport.height / 2,
  };

  let camera: DemoCameraController;
  const cursor = new DemoCursorController({
    getCameraState: () => camera.current,
    initialPoint,
    page,
    sampleCamera: async (point, zoom) => {
      camera.current = {
        x: point.x,
        y: point.y,
        zoom,
      };
      await camera.sample("follow");
    },
  });
  camera = new DemoCameraController({
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
    await page.goto(captureUrl, { waitUntil: "load" });
    await applyPageSetup(config, context, page, page, sessionDir, captureUrl, {
      includeModule: false,
    });
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
    compositionLayout,
  );

  await fs.writeFile(
    path.join(sessionDir, "timeline.json"),
    JSON.stringify(
      {
        config,
        captureUrl,
        demoProgramType: Array.isArray(demoModule.default) ? "scenes" : "function",
        ffmpegPlans,
        cameraSamples: camera.samples,
        compositionLayout,
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

    const reviewSourcePath =
      ffmpegPlans.find((plan) => plan.format === "mp4")?.outputPath ??
      ffmpegPlans[0]?.outputPath;
    const durationSeconds = ffmpegPlans[0]?.durationSeconds ?? 0;

    if (reviewSourcePath && durationSeconds > 0) {
      const posterPath = path.join(sessionDir, "poster.png");
      const contactSheetPath = path.join(sessionDir, "contact-sheet.png");

      await renderPosterFrame(reviewSourcePath, posterPath, durationSeconds);
      console.log(`Rendered poster frame: ${posterPath}`);

      await renderContactSheet(reviewSourcePath, contactSheetPath, durationSeconds);
      console.log(`Rendered contact sheet: ${contactSheetPath}`);
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
