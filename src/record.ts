import fs from "node:fs/promises";
import path from "node:path";

import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

import { prepareComposition } from "./composition.js";
import { loadConfig } from "./config.js";
import {
  assembleFramesToVideo,
  buildFfmpegPlans,
  commandExists,
  cropVideoSource,
  renderContactSheet,
  renderPosterFrame,
  renderWithFfmpeg,
} from "./ffmpeg.js";
import { ManualFrameCapture } from "./frame-capture.js";
import {
  installManualRecorder,
  installManualRecorderInFrame,
  type ManualRecorderControls,
  type RecordedMarker,
  type ManualRecording,
} from "./manual-recorder.js";
import { buildGeneratedDemoSource } from "./record-script.js";
import { startManagedService } from "./serve.js";
import { applyContextSetup, applyPageEmulation, applyPageSetup, resolveCaptureUrl } from "./setup.js";
import { startStudioSession } from "./studio.js";
import type { CameraSample, CursorSample, Point } from "./types.js";
import { installCursorOverlay, moveCursorOverlay } from "./cursor-overlay.js";

type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;

type RecordMotionOptions = {
  automation?: (
    page: Page,
    controls: ManualRecorderControls,
  ) => Promise<void>;
  headless?: boolean;
};

type ManualControllerWindow = {
  close: () => Promise<void>;
  focus: () => Promise<void>;
  setLastCue: (label: string) => Promise<void>;
};

async function openManualRecorderController(
  browser: ReturnType<typeof chromium.launch> extends Promise<infer T> ? T : never,
  controls: ManualRecorderControls,
  recordingPage: Page,
): Promise<ManualControllerWindow> {
  const context = await browser.newContext({
    viewport: {
      width: 420,
      height: 320,
    },
  });
  const page = await context.newPage();

  await page.exposeFunction("motionRecorderAction", async (action: string) => {
    if (action === "wide" || action === "follow" || action === "hold") {
      await controls.mark(action);
      return;
    }

    if (action === "finish") {
      await controls.finish();
      return;
    }

    if (action === "cancel") {
      await controls.cancel();
      return;
    }

    if (action === "focus-app") {
      await recordingPage.bringToFront();
    }
  });

  await page.setContent(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Motion Recorder Controls</title>
    <style>
      /* bg: #0a1420; surface: rgba(14, 24, 38, 0.96); accent: #7ae2ba; text: #f6fbff / rgba(255,255,255,0.62) */
      body {
        margin: 0;
        padding: 18px;
        background: #0a1420;
        color: #f6fbff;
        font-family: "Instrument Sans", system-ui, sans-serif;
      }

      .shell {
        display: grid;
        gap: 14px;
        padding: 16px;
        border-radius: 24px;
        background: rgba(14, 24, 38, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28);
      }

      .top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        padding: 8px 10px;
        border-radius: 999px;
        background: rgba(122, 226, 186, 0.12);
        color: #7ae2ba;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }

      .status {
        display: grid;
        gap: 4px;
        padding: 10px 12px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .status span {
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.54);
      }

      .status strong {
        font-size: 15px;
        color: #fff;
      }

      .copy {
        font-size: 13px;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.82);
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 10px;
      }

      button {
        border: 0;
        border-radius: 18px;
        padding: 12px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, color 160ms ease;
      }

      button:hover {
        transform: translateY(-1px);
      }

      button:active {
        transform: translateY(1px) scale(0.99);
      }

      button[data-marker] {
        display: grid;
        gap: 4px;
        text-align: left;
        color: #fff;
        background: rgba(255, 255, 255, 0.06);
      }

      button[data-marker] span {
        font-size: 10px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: rgba(255, 255, 255, 0.48);
      }

      button[data-marker="wide"] {
        background: linear-gradient(135deg, rgba(113, 182, 255, 0.18), rgba(74, 102, 185, 0.14));
      }

      button[data-marker="follow"] {
        background: linear-gradient(135deg, rgba(122, 226, 186, 0.24), rgba(54, 119, 99, 0.18));
      }

      button[data-marker="hold"] {
        background: linear-gradient(135deg, rgba(255, 214, 132, 0.16), rgba(186, 122, 68, 0.12));
      }

      .actions {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 10px;
      }

      button[data-action="focus-app"] {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
      }

      button[data-action="cancel"] {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
      }

      button[data-action="finish"] {
        background: linear-gradient(135deg, #7ae2ba, #4aa382);
        color: #082118;
      }

      .hint {
        font-size: 12px;
        line-height: 1.45;
        color: rgba(255, 255, 255, 0.62);
      }

      .hint code {
        font-family: ui-monospace, "SFMono-Regular", monospace;
        color: #d5fff0;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="top">
        <div class="eyebrow">Motion Recorder</div>
        <div class="status">
          <span>Last cue</span>
          <strong data-role="marker-status">Wide</strong>
        </div>
      </div>
      <div class="copy">Use this window for clicks if you want, or stay in the app and use hotkeys. The recording page stays clean.</div>
      <div class="grid">
        <button type="button" data-marker="wide"><span>Alt+Shift+1</span><strong>Wide</strong></button>
        <button type="button" data-marker="follow"><span>Alt+Shift+2</span><strong>Punch In</strong></button>
        <button type="button" data-marker="hold"><span>Alt+Shift+3</span><strong>Hold</strong></button>
      </div>
      <div class="actions">
        <button type="button" data-action="focus-app">Focus App</button>
        <button type="button" data-action="cancel">Cancel</button>
        <button type="button" data-action="finish">Finish</button>
      </div>
      <div class="hint"><code>Alt+Shift+0</code> refocuses this window. <code>Alt+Shift+R</code> finishes from the app.</div>
    </div>
    <script>
      const send = async (action) => {
        await window.motionRecorderAction(action);
      };

      document.querySelectorAll("[data-marker]").forEach((button) => {
        button.addEventListener("click", () => send(button.getAttribute("data-marker")));
      });

      document.querySelector('[data-action="focus-app"]').addEventListener("click", () => send("focus-app"));
      document.querySelector('[data-action="cancel"]').addEventListener("click", () => send("cancel"));
      document.querySelector('[data-action="finish"]').addEventListener("click", () => send("finish"));
    </script>
  </body>
</html>`,
  );

  await recordingPage.bringToFront();

  return {
    async close() {
      await context.close();
    },
    async focus() {
      await page.bringToFront();
    },
    async setLastCue(label: string) {
      await page.evaluate((value) => {
        const target = document.querySelector("[data-role='marker-status']");

        if (target) {
          target.textContent = value;
        }
      }, label);
    },
  };
}

function stamp(): string {
  return new Date().toISOString().replaceAll(":", "-");
}

function withRenderableCursorSamples(
  recording: ManualRecording,
  width: number,
  height: number,
): CursorSample[] {
  const samples = [...recording.cursorSamples];
  const fallbackPoint = {
    x: width / 2,
    y: height / 2,
  };
  const firstPoint =
    samples[0] ??
    ({
      kind: "move",
      timeMs: 0,
      ...fallbackPoint,
    } satisfies CursorSample);

  if (samples.length === 0 || samples[0]!.timeMs > 0) {
    samples.unshift({
      kind: "move",
      timeMs: 0,
      x: firstPoint.x,
      y: firstPoint.y,
    });
  }

  const lastSample = samples.at(-1);

  if (!lastSample) {
    return [
      {
        kind: "move",
        timeMs: 0,
        ...fallbackPoint,
      },
    ];
  }

  if (lastSample.timeMs < recording.durationMs) {
    samples.push({
      kind: "wait",
      timeMs: recording.durationMs,
      x: lastSample.x,
      y: lastSample.y,
    });
  }

  return samples;
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function interpolate(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function interpolatePoint(start: Point, end: Point, progress: number): Point {
  return {
    x: interpolate(start.x, end.x, progress),
    y: interpolate(start.y, end.y, progress),
  };
}

function resolveCursorPointAtTime(
  cursorSamples: CursorSample[],
  timeMs: number,
  fallbackPoint: Point,
): Point {
  if (cursorSamples.length === 0) {
    return fallbackPoint;
  }

  const first = cursorSamples[0]!;

  if (timeMs <= first.timeMs) {
    return { x: first.x, y: first.y };
  }

  for (let index = 1; index < cursorSamples.length; index += 1) {
    const previous = cursorSamples[index - 1]!;
    const current = cursorSamples[index]!;

    if (timeMs <= current.timeMs) {
      const duration = Math.max(current.timeMs - previous.timeMs, 1);
      const progress = Math.min(Math.max((timeMs - previous.timeMs) / duration, 0), 1);
      return interpolatePoint(previous, current, progress);
    }
  }

  const last = cursorSamples.at(-1)!;
  return { x: last.x, y: last.y };
}

function createManualCameraSamples(
  recording: ManualRecording,
  config: Awaited<ReturnType<typeof loadConfig>>,
): CameraSample[] {
  const fallbackPoint = {
    x: config.viewport.width / 2,
    y: config.viewport.height / 2,
  };
  const centerPoint = fallbackPoint;
  const transitionMs = 680;
  const timelineTimes = new Set<number>([0, recording.durationMs]);

  for (const sample of recording.cursorSamples) {
    timelineTimes.add(sample.timeMs);
  }

  for (const marker of recording.markers) {
    timelineTimes.add(marker.timeMs);

    if (marker.kind !== "hold") {
      timelineTimes.add(Math.min(marker.timeMs + transitionMs, recording.durationMs));
    }
  }

  const markersByTime = new Map<number, RecordedMarker[]>();

  for (const marker of recording.markers) {
    const bucket = markersByTime.get(marker.timeMs) ?? [];
    bucket.push(marker);
    markersByTime.set(marker.timeMs, bucket);
  }

  let currentMode: "follow" | "wide" = "wide";
  let transition:
    | {
        from: Point & { zoom: number };
        startMs: number;
        target: "follow" | "wide";
      }
    | undefined;

  const samples: CameraSample[] = [];
  const sortedTimes = [...timelineTimes].sort((left, right) => left - right);

  for (const timeMs of sortedTimes) {
    const cursorPoint = resolveCursorPointAtTime(
      recording.cursorSamples,
      timeMs,
      fallbackPoint,
    );
    let currentState: Point & { zoom: number };

    if (transition) {
      const progress = Math.min(
        Math.max((timeMs - transition.startMs) / transitionMs, 0),
        1,
      );
      const eased = easeInOutCubic(progress);
      const targetPoint = cursorPoint;
      const targetZoom = transition.target === "follow" ? config.camera.zoom : 1;

      currentState = {
        ...interpolatePoint(transition.from, targetPoint, eased),
        zoom: interpolate(transition.from.zoom, targetZoom, eased),
      };

      if (progress >= 1) {
        currentMode = transition.target;
        transition = undefined;
      }
    } else if (currentMode === "follow") {
      currentState = {
        ...cursorPoint,
        zoom: config.camera.zoom,
      };
    } else {
      currentState = {
        ...centerPoint,
        zoom: 1,
      };
    }

    const markersAtTime = markersByTime.get(timeMs) ?? [];

    for (const marker of markersAtTime) {
      if (marker.kind === "hold") {
        samples.push({
          kind: "wait",
          timeMs,
          ...currentState,
        });
        continue;
      }

      if (marker.kind === currentMode && !transition) {
        continue;
      }

      transition = {
        from: currentState,
        startMs: timeMs,
        target: marker.kind,
      };
    }

    const previous = samples.at(-1);

    if (
      previous &&
      previous.timeMs === timeMs &&
      previous.x === currentState.x &&
      previous.y === currentState.y &&
      previous.zoom === currentState.zoom
    ) {
      continue;
    }

    if (
      currentMode === "wide" &&
      !transition &&
      previous &&
      previous.zoom === currentState.zoom &&
      previous.x === currentState.x &&
      previous.y === currentState.y
    ) {
      continue;
    }

    samples.push({
      kind: transition || currentMode === "follow" ? "follow" : "focus",
      timeMs,
      ...currentState,
    });
  }

  if (samples.length === 1) {
    samples.push({
      ...samples[0]!,
      timeMs: recording.durationMs,
    });
  }

  return samples;
}

function buildGeneratedDemoFilePath(
  demoPath: string,
  sessionName: string,
): string {
  const directory = path.dirname(demoPath);
  const extension = path.extname(demoPath) || ".mjs";
  const basename = path.basename(demoPath, extension);

  return path.join(directory, `${basename}.recorded-${sessionName}${extension}`);
}

export async function recordMotion(
  configPath: string,
  options: RecordMotionOptions = {},
): Promise<void> {
  const config = await loadConfig(configPath);
  const captureUrl = resolveCaptureUrl(config);
  const ffmpegAvailable = await commandExists("ffmpeg");
  const requestedCaptureMode = config.browser.capture.mode;
  const effectiveCaptureMode = ffmpegAvailable ? requestedCaptureMode : "video";
  const useFrameCapture = effectiveCaptureMode !== "video";

  if (!ffmpegAvailable && requestedCaptureMode !== "video") {
    console.warn(
      `ffmpeg was not available, so record fell back to browser video capture instead of '${requestedCaptureMode}'.`,
    );
  }
  const sessionName = `${config.name}-${stamp()}`;
  const sessionDir = path.join(config.output.dir, sessionName);
  const recordingsDir = path.join(sessionDir, "recordings");
  const framesDir = path.join(sessionDir, "frames");
  const sourceVideoPath = path.join(
    sessionDir,
    config.browser.studio.enabled ? "source-stage.mkv" : "source.mkv",
  );
  const fallbackVideoPath = path.join(sessionDir, "source.webm");
  const croppedSourceVideoPath = path.join(sessionDir, "source-stage.mp4");
  const recordingPath = path.join(sessionDir, "recording.json");
  const sessionGeneratedDemoPath = path.join(sessionDir, "generated-demo.mjs");
  const editableGeneratedDemoPath = buildGeneratedDemoFilePath(
    config.demoPath,
    sessionName,
  );
  const managedService = await startManagedService(config);
  const studioSession = await startStudioSession(config, captureUrl);
  const navigationUrl = studioSession?.wrapperUrl ?? captureUrl;

  await fs.mkdir(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    channel: config.browser.channel,
    headless: options.headless ?? false,
    slowMo: config.browser.slowMo,
  });

  let storageState: StorageState | undefined;

  if (config.setup) {
    const setupContext = await browser.newContext({
      viewport: studioSession?.viewport ?? config.viewport,
    });
    await applyContextSetup(config, setupContext, navigationUrl);
    const setupPage = await setupContext.newPage();
    await applyPageEmulation(config, setupPage);
    setupPage.setDefaultNavigationTimeout(config.timing.navigationTimeoutMs);
    await setupPage.goto(navigationUrl, { waitUntil: "load" });

    if (studioSession) {
      await setupPage.waitForSelector("#__motion_stage");
      const setupFrame = setupPage.frame({ name: "motion-stage" });

      if (!setupFrame) {
        throw new Error("Studio mode could not find the embedded app frame during setup.");
      }

      await setupFrame.waitForLoadState("load");
      await applyPageSetup(
        config,
        setupContext,
        setupPage,
        setupFrame,
        sessionDir,
        captureUrl,
      );
    } else {
      await applyPageSetup(
        config,
        setupContext,
        setupPage,
        setupPage,
        sessionDir,
        captureUrl,
      );
    }

    storageState = await setupContext.storageState({
      path: path.join(sessionDir, "setup-state.json"),
    });
    await setupPage.close();
    await setupContext.close();
  }

  const context = await browser.newContext({
    ...(storageState ? { storageState } : {}),
    ...(useFrameCapture
      ? {}
      : {
          recordVideo: {
            dir: recordingsDir,
            size: studioSession?.viewport ?? config.viewport,
          },
        }),
    viewport: studioSession?.viewport ?? config.viewport,
  });
  await applyContextSetup(config, context, navigationUrl);

  const page = await context.newPage();
  await applyPageEmulation(config, page);
  page.setDefaultNavigationTimeout(config.timing.navigationTimeoutMs);

  const initialPoint = {
    x: config.viewport.width / 2,
    y: config.viewport.height / 2,
  };
  const video = useFrameCapture ? undefined : page.video();
  let recording: ManualRecording | undefined;
  let automationError: unknown;
  let controllerWindow: ManualControllerWindow | undefined;
  let frameCapture: ManualFrameCapture | undefined;

  try {
    await page.goto(navigationUrl, { waitUntil: "load" });

    let controls: ManualRecorderControls;

    if (studioSession) {
      await page.waitForSelector("#__motion_stage");
      const frame = page.frame({ name: "motion-stage" });

      if (!frame) {
        throw new Error("Studio mode could not find the embedded app frame.");
      }

      await frame.waitForLoadState("load");
      await applyPageSetup(config, context, page, frame, sessionDir, captureUrl, {
        includeModule: false,
      });

      await installCursorOverlay(frame);
      await moveCursorOverlay(frame, initialPoint.x, initialPoint.y);
      if (useFrameCapture) {
        frameCapture = new ManualFrameCapture({
          format: effectiveCaptureMode === "rgb-frames" ? "png" : "jpeg",
          fps: config.browser.capture.fps,
          jpegQuality: config.browser.capture.jpegQuality,
          outputDir: framesDir,
          target: {
            screenshot: (options) =>
              page.screenshot({
                ...options,
                clip: {
                  height: studioSession.captureRegion.height,
                  width: studioSession.captureRegion.width,
                  x: studioSession.captureRegion.x,
                  y: studioSession.captureRegion.y,
                },
                fullPage: false,
              }),
          },
        });
        await frameCapture.start();
      }
      controls = await installManualRecorderInFrame(page, frame, {
        onControlsFocusRequest: async () => {
          await page.evaluate(() => {
            (
              window as Window & {
                __motionStudioFocusControls?: () => void;
              }
            ).__motionStudioFocusControls?.();
          });
        },
        onMarkerStatusChange: async (label) => {
          await page.evaluate((value) => {
            (
              window as Window & {
                __motionStudioSetLastCue?: (label: string) => void;
              }
            ).__motionStudioSetLastCue?.(value);
          }, label);
        },
      });
    } else {
      await applyPageSetup(config, context, page, page, sessionDir, captureUrl, {
        includeModule: false,
      });
      await installCursorOverlay(page);
      await moveCursorOverlay(page, initialPoint.x, initialPoint.y);
      if (useFrameCapture) {
        frameCapture = new ManualFrameCapture({
          format: effectiveCaptureMode === "rgb-frames" ? "png" : "jpeg",
          fps: config.browser.capture.fps,
          jpegQuality: config.browser.capture.jpegQuality,
          outputDir: framesDir,
          target: {
            screenshot: (options) =>
              page.screenshot({
                ...options,
                fullPage: false,
              }),
          },
        });
        await frameCapture.start();
      }

      let controllerFocusRequested = false;
      controls = await installManualRecorder(page, {
        onControlsFocusRequest: async () => {
          controllerFocusRequested = true;
          await controllerWindow?.focus();
        },
        onMarkerStatusChange: async (label) => {
          await controllerWindow?.setLastCue(label);
        },
      });
      controllerWindow = await openManualRecorderController(browser, controls, page);

      if (controllerFocusRequested) {
        await controllerWindow.focus();
        controllerFocusRequested = false;
      }
    }

    if (options.automation) {
      void options
        .automation(page, controls)
        .catch((error) => {
          automationError = error;
        });
    }

    recording = await controls.waitForFinish();

    if (automationError) {
      throw automationError;
    }

    if (frameCapture) {
      await frameCapture.stop(recording.durationMs);
    }

    await page.waitForTimeout(Math.min(config.timing.settleMs, 400));
  } finally {
    await controllerWindow?.close().catch(() => undefined);
    await page.close();
    await context.close();
    await browser.close();
    await studioSession?.stop().catch(() => undefined);
    await managedService?.stop();
  }

  const recordedVideoPath = await video?.path();

  if (!recording) {
    throw new Error("Manual recording did not complete.");
  }

  if (frameCapture) {
    await assembleFramesToVideo(frameCapture.frames, sourceVideoPath, recording.durationMs);
  } else {
    if (!recordedVideoPath) {
      throw new Error("Playwright did not produce a source video.");
    }

    await fs.rename(recordedVideoPath, fallbackVideoPath);
  }
  await fs.writeFile(recordingPath, JSON.stringify(recording, null, 2), "utf8");

  if (recording.cancelled) {
    console.log(`Recording cancelled. Raw capture saved to ${recordingPath}`);
    return;
  }

  const renderSourcePath =
    useFrameCapture && frameCapture
      ? sourceVideoPath
      : studioSession
        ? (await cropVideoSource(
            fallbackVideoPath,
            croppedSourceVideoPath,
            studioSession.captureRegion,
          ),
          croppedSourceVideoPath)
        : fallbackVideoPath;

  const cursorSamples = withRenderableCursorSamples(
    recording,
    config.viewport.width,
    config.viewport.height,
  );
  const cameraSamples = createManualCameraSamples(recording, config);
  const generatedDemoSource = buildGeneratedDemoSource(config, recording);

  await fs.mkdir(path.dirname(editableGeneratedDemoPath), { recursive: true });
  await fs.writeFile(sessionGeneratedDemoPath, generatedDemoSource, "utf8");
  await fs.writeFile(editableGeneratedDemoPath, generatedDemoSource, "utf8");

  const compositionLayout = await prepareComposition(sessionDir, config);
  const ffmpegPlans = buildFfmpegPlans(
    renderSourcePath,
    sessionDir,
    config,
    cursorSamples,
    cameraSamples,
    compositionLayout,
  );

  await fs.writeFile(
    path.join(sessionDir, "timeline.json"),
    JSON.stringify(
      {
        config,
        captureUrl,
        generatedDemoPath: editableGeneratedDemoPath,
        generatedSessionDemoPath: sessionGeneratedDemoPath,
        mode: "manual-record",
        recording,
        cameraSamples,
        cursorSamples,
        ffmpegPlans,
        compositionLayout,
        studioSession: studioSession
          ? {
              captureRegion: studioSession.captureRegion,
              viewport: studioSession.viewport,
              wrapperUrl: studioSession.wrapperUrl,
            }
          : undefined,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Generated editable demo: ${editableGeneratedDemoPath}`);

  if (ffmpegAvailable) {
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
  console.log(`Source video: ${renderSourcePath}`);

  for (const plan of ffmpegPlans) {
    console.log(`Planned ${plan.format} output: ${plan.outputPath}`);
    console.log(`Run manually: ffmpeg ${plan.args.join(" ")}`);
  }
}
