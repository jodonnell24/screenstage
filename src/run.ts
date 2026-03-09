import fs from "node:fs/promises";
import path from "node:path";

import type { BrowserContext } from "playwright";
import { chromium } from "playwright";

import { DemoCameraController } from "./camera-controller.js";
import { prepareComposition } from "./composition.js";
import type { LoadConfigOverrides } from "./config.js";
import { loadConfig, loadDemoModule } from "./config.js";
import { DemoCursorController } from "./cursor-controller.js";
import { ScreenstageError } from "./errors.js";
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
import type { Reporter } from "./reporter.js";
import { runScenes } from "./scenes.js";
import { startManagedService, type ManagedService } from "./serve.js";
import {
  artifact,
  writeSessionManifest,
  type SessionManifest,
} from "./session-manifest.js";
import {
  applyContextSetup,
  applyPageEmulation,
  applyPageSetup,
  resolveCaptureUrl,
} from "./setup.js";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
type BrowserInstance = Awaited<ReturnType<typeof chromium.launch>>;

export type RunMotionOptions = {
  configOverrides?: LoadConfigOverrides;
  reporter?: Reporter;
};

export type RunMotionResult = {
  captureUrl: string;
  manifest: SessionManifest;
  manifestPath: string;
  sessionDir: string;
};

function stamp(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

export async function runMotion(
  configPath: string,
  options: RunMotionOptions = {},
): Promise<RunMotionResult> {
  const reporter = options.reporter;
  const startedAt = Date.now();
  const config = await loadConfig(configPath, options.configOverrides);
  const demoModule = await loadDemoModule(config.demoPath);
  const captureUrl = resolveCaptureUrl(config);
  const sessionName = `${config.name}-${stamp()}`;
  const sessionDir = path.join(config.output.dir, sessionName);
  const recordingsDir = path.join(sessionDir, "recordings");
  const sourceVideoPath = path.join(sessionDir, "source.webm");
  let managedService: ManagedService | undefined;
  let manifest: SessionManifest | undefined;
  let manifestPath: string | undefined;

  reporter?.emit({
    command: "run",
    configPath: config.configPath,
    event: "command_started",
    outputDir: config.output.dir,
    sessionDir,
  });

  managedService = await startManagedService(config);

  if (managedService) {
    reporter?.emit({
      command: "run",
      configPath: config.configPath,
      event: "service_started",
      targetUrl: captureUrl,
    });
  }

  await fs.mkdir(recordingsDir, { recursive: true });
  const compositionLayout = await prepareComposition(sessionDir, config);

  let browser: BrowserInstance;
  try {
    browser = await chromium.launch({
      channel: config.browser.channel,
      headless: config.browser.headless,
      slowMo: config.browser.slowMo,
    });
  } catch (error) {
    throw new ScreenstageError(
      "BROWSER_FAILURE",
      error instanceof Error ? error.message : String(error),
      {
        browserChannel: config.browser.channel,
        headless: config.browser.headless,
      },
    );
  }

  reporter?.emit({
    browserChannel: config.browser.channel ?? "chromium",
    command: "run",
    event: "browser_started",
    headless: config.browser.headless,
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
    reporter?.emit({
      captureUrl,
      command: "run",
      event: "capture_started",
      viewport: config.viewport,
    });

    if (config.browser.cursor.mode === "motion") {
      await installCursorOverlay(page, {
        hideSelectors: config.browser.cursor.hideSelectors,
      });
    }
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
    throw new ScreenstageError(
      "CAPTURE_FAILURE",
      "Playwright did not produce a source video.",
    );
  }

  await fs.rename(recordedVideoPath, sourceVideoPath);
  reporter?.emit({
    command: "run",
    event: "capture_completed",
    sourceVideoPath,
  });

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
    reporter?.emit({
      command: "run",
      event: "render_started",
      plannedOutputs: ffmpegPlans.map((plan) => ({
        format: plan.format,
        outputPath: plan.outputPath,
      })),
    });

    for (const plan of ffmpegPlans) {
      try {
        await renderWithFfmpeg(plan);
      } catch (error) {
        throw new ScreenstageError(
          "RENDER_FAILURE",
          error instanceof Error ? error.message : String(error),
          {
            format: plan.format,
            outputPath: plan.outputPath,
          },
        );
      }
      reporter?.log(`Rendered ${plan.format} video: ${plan.outputPath}`);
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

      try {
        await renderPosterFrame(reviewSourcePath, posterPath, durationSeconds);
      } catch (error) {
        throw new ScreenstageError(
          "RENDER_FAILURE",
          error instanceof Error ? error.message : String(error),
          {
            artifact: "poster",
            outputPath: posterPath,
          },
        );
      }
      reporter?.log(`Rendered poster frame: ${posterPath}`);

      try {
        await renderContactSheet(reviewSourcePath, contactSheetPath, durationSeconds);
      } catch (error) {
        throw new ScreenstageError(
          "RENDER_FAILURE",
          error instanceof Error ? error.message : String(error),
          {
            artifact: "contact-sheet",
            outputPath: contactSheetPath,
          },
        );
      }
      reporter?.log(`Rendered contact sheet: ${contactSheetPath}`);

      try {
        markerStillPaths = await renderMarkerStills(
          reviewSourcePath,
          path.join(sessionDir, "markers"),
          editMarkers,
          durationSeconds,
        );
      } catch (error) {
        throw new ScreenstageError(
          "RENDER_FAILURE",
          error instanceof Error ? error.message : String(error),
          {
            artifact: "marker-stills",
            outputDir: path.join(sessionDir, "markers"),
          },
        );
      }
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
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as SessionManifest;

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

    reporter?.emit({
      artifacts: manifest.artifacts,
      command: "run",
      event: "artifacts_written",
      manifestPath,
      sessionDir,
    });
    reporter?.emit({
      command: "run",
      durationMs: Date.now() - startedAt,
      event: "render_completed",
      manifestPath,
    });
    reporter?.log(`Wrote session manifest: ${manifestPath}`);

    const result = {
      captureUrl,
      manifest,
      manifestPath,
      sessionDir,
    };
    reporter?.emit({
      command: "run",
      durationMs: Date.now() - startedAt,
      event: "command_completed",
      manifestPath,
      sessionDir,
      status: "success",
    });
    return result;
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
  manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as SessionManifest;

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

  reporter?.emit({
    artifacts: manifest.artifacts,
    command: "run",
    event: "artifacts_written",
    manifestPath,
    sessionDir,
  });
  reporter?.log("ffmpeg was not found on PATH. Generated plan only.");
  reporter?.log(`Source video: ${sourceVideoPath}`);

  for (const plan of ffmpegPlans) {
    reporter?.log(`Planned ${plan.format} output: ${plan.outputPath}`);
    reporter?.log(`Run manually: ffmpeg ${plan.args.join(" ")}`);
  }

  reporter?.emit({
    command: "run",
    durationMs: Date.now() - startedAt,
    event: "command_completed",
    manifestPath,
    sessionDir,
    status: "partial",
    warning: "ffmpeg_missing",
  });

  return {
    captureUrl,
    manifest,
    manifestPath,
    sessionDir,
  };
}
