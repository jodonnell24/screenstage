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
  renderMarkerStills,
  renderPosterFrame,
  renderWithFfmpeg,
} from "./ffmpeg.js";
import { writeMarkerArtifacts } from "./markers.js";
import { runScenes } from "./scenes.js";
import { startManagedService } from "./serve.js";
import { artifact, writeSessionManifest } from "./session-manifest.js";
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
  let sceneMarkers:
    | Awaited<ReturnType<typeof runScenes>>
    | undefined;

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
      sceneMarkers = await runScenes(demoModule.default, demoContext);
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
  const editMarkers = sceneMarkers?.map((marker) => ({
    ...marker,
    source: "scene" as const,
  })) ?? [];
  const markerArtifacts = await writeMarkerArtifacts(
    sessionDir,
    config.output.fps,
    editMarkers,
  );
  let manifestPath: string | undefined;

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
        markerArtifacts,
        markers: editMarkers,
        scenes: Array.isArray(demoModule.default) ? demoModule.default : undefined,
        samples: cursor.samples,
        manifestPath,
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
    let posterPath: string | undefined;
    let contactSheetPath: string | undefined;
    let markerStillPaths: string[] = [];

    if (reviewSourcePath && durationSeconds > 0) {
      posterPath = path.join(sessionDir, "poster.png");
      contactSheetPath = path.join(sessionDir, "contact-sheet.png");

      await renderPosterFrame(reviewSourcePath, posterPath, durationSeconds);
      console.log(`Rendered poster frame: ${posterPath}`);

      await renderContactSheet(reviewSourcePath, contactSheetPath, durationSeconds);
      console.log(`Rendered contact sheet: ${contactSheetPath}`);

      markerStillPaths = await renderMarkerStills(
        reviewSourcePath,
        path.join(sessionDir, "markers"),
        editMarkers,
        durationSeconds,
      );
    }

    manifestPath = await writeSessionManifest({
      artifacts: {
        composition: compositionLayout.assetPath
          ? artifact(sessionDir, compositionLayout.assetPath, "composition-shell")
          : undefined,
        contactSheet: contactSheetPath
          ? artifact(sessionDir, contactSheetPath, "contact-sheet")
          : undefined,
        finalRenders: ffmpegPlans.map((plan) =>
          artifact(
            sessionDir,
            plan.outputPath,
            plan.format === "prores" ? "final-prores" : "final-mp4",
          ),
        ),
        markerCsv: artifact(sessionDir, markerArtifacts.csvPath, "markers-csv"),
        markerJson: artifact(sessionDir, markerArtifacts.jsonPath, "markers-json"),
        markerStills: markerStillPaths.map((stillPath) =>
          artifact(sessionDir, stillPath, "marker-still"),
        ),
        poster: posterPath ? artifact(sessionDir, posterPath, "poster") : undefined,
        source: artifact(sessionDir, sourceVideoPath, "source-video"),
        timeline: artifact(sessionDir, path.join(sessionDir, "timeline.json"), "timeline"),
      },
      captureUrl,
      config,
      durationSeconds,
      markers: editMarkers,
      mode: "run",
      sessionDir,
    });

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
          manifestPath,
          markerArtifacts,
          markers: editMarkers,
          scenes: Array.isArray(demoModule.default) ? demoModule.default : undefined,
          samples: cursor.samples,
        },
        null,
        2,
      ),
      "utf8",
    );

    if (manifestPath) {
      console.log(`Wrote session manifest: ${manifestPath}`);
    }

    return;
  }

  manifestPath = await writeSessionManifest({
    artifacts: {
      composition: compositionLayout.assetPath
        ? artifact(sessionDir, compositionLayout.assetPath, "composition-shell")
        : undefined,
      markerCsv: artifact(sessionDir, markerArtifacts.csvPath, "markers-csv"),
      markerJson: artifact(sessionDir, markerArtifacts.jsonPath, "markers-json"),
      source: artifact(sessionDir, sourceVideoPath, "source-video"),
      timeline: artifact(sessionDir, path.join(sessionDir, "timeline.json"), "timeline"),
    },
    captureUrl,
    config,
    durationSeconds: ffmpegPlans[0]?.durationSeconds,
    markers: editMarkers,
    mode: "run",
    sessionDir,
  });

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
        manifestPath,
        markerArtifacts,
        markers: editMarkers,
        scenes: Array.isArray(demoModule.default) ? demoModule.default : undefined,
        samples: cursor.samples,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("ffmpeg was not found on PATH. Generated plan only.");
  console.log(`Source video: ${sourceVideoPath}`);

  for (const plan of ffmpegPlans) {
    console.log(`Planned ${plan.format} output: ${plan.outputPath}`);
    console.log(`Run manually: ffmpeg ${plan.args.join(" ")}`);
  }
}
