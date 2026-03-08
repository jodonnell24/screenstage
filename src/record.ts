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
  type ManualRecording,
} from "./manual-recorder.js";
import { buildGeneratedDemoSource } from "./record-script.js";
import { startManagedService } from "./serve.js";
import type { CursorSample } from "./types.js";
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
    [],
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
