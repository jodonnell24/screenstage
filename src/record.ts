import fs from "node:fs/promises";
import path from "node:path";

import type { Page } from "playwright";
import { chromium } from "playwright";

import { prepareComposition } from "./composition.js";
import { loadConfig } from "./config.js";
import {
  buildFfmpegPlans,
  commandExists,
  renderContactSheet,
  renderPosterFrame,
  renderWithFfmpeg,
} from "./ffmpeg.js";
import {
  installManualRecorder,
  type ManualRecorderControls,
  type RecordedMarker,
  type ManualRecording,
} from "./manual-recorder.js";
import { buildGeneratedDemoSource } from "./record-script.js";
import { startManagedService } from "./serve.js";
import type { CameraSample, CursorSample, Point } from "./types.js";
import { installCursorOverlay, moveCursorOverlay } from "./cursor-overlay.js";

type RecordMotionOptions = {
  automation?: (
    page: Page,
    controls: ManualRecorderControls,
  ) => Promise<void>;
  headless?: boolean;
};

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
  if (recording.markers.length === 0) {
    return [];
  }

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
  const sessionName = `${config.name}-${stamp()}`;
  const sessionDir = path.join(config.output.dir, sessionName);
  const recordingsDir = path.join(sessionDir, "recordings");
  const sourceVideoPath = path.join(sessionDir, "source.webm");
  const recordingPath = path.join(sessionDir, "recording.json");
  const sessionGeneratedDemoPath = path.join(sessionDir, "generated-demo.mjs");
  const editableGeneratedDemoPath = buildGeneratedDemoFilePath(
    config.demoPath,
    sessionName,
  );
  const managedService = await startManagedService(config);

  await fs.mkdir(recordingsDir, { recursive: true });

  const browser = await chromium.launch({
    channel: config.browser.channel,
    headless: options.headless ?? false,
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
  const video = page.video();
  let recording: ManualRecording | undefined;
  let automationError: unknown;

  try {
    await installCursorOverlay(page);
    await page.goto(config.url, { waitUntil: "load" });
    await moveCursorOverlay(page, initialPoint.x, initialPoint.y);

    const controls = await installManualRecorder(page);

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

    await page.waitForTimeout(Math.min(config.timing.settleMs, 400));
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

  if (!recording) {
    throw new Error("Manual recording did not complete.");
  }

  await fs.rename(recordedVideoPath, sourceVideoPath);
  await fs.writeFile(recordingPath, JSON.stringify(recording, null, 2), "utf8");

  if (recording.cancelled) {
    console.log(`Recording cancelled. Raw capture saved to ${recordingPath}`);
    return;
  }

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
    sourceVideoPath,
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
        generatedDemoPath: editableGeneratedDemoPath,
        generatedSessionDemoPath: sessionGeneratedDemoPath,
        mode: "manual-record",
        recording,
        cameraSamples,
        cursorSamples,
        ffmpegPlans,
        compositionLayout,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Generated editable demo: ${editableGeneratedDemoPath}`);

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
