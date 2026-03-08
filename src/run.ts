import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import { loadConfig, loadDemoModule } from "./config.js";
import { DemoCursorController } from "./cursor-controller.js";
import { installCursorOverlay, moveCursorOverlay } from "./cursor-overlay.js";
import { buildFfmpegPlan, commandExists, renderWithFfmpeg } from "./ffmpeg.js";

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
  const outputVideoPath = path.join(sessionDir, "final.mp4");

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

  const video = page.video();

  try {
    await installCursorOverlay(page);
    await page.goto(config.url, { waitUntil: "load" });
    await moveCursorOverlay(page, initialPoint.x, initialPoint.y);

    await demoModule.default({
      config,
      cursor,
      page,
      sessionDir,
    });

    await cursor.wait(config.timing.settleMs);
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }

  const recordedVideoPath = await video?.path();

  if (!recordedVideoPath) {
    throw new Error("Playwright did not produce a source video.");
  }

  await fs.rename(recordedVideoPath, sourceVideoPath);

  const ffmpegPlan = buildFfmpegPlan(
    sourceVideoPath,
    outputVideoPath,
    config,
    cursor.samples,
  );

  await fs.writeFile(
    path.join(sessionDir, "timeline.json"),
    JSON.stringify(
      {
        config,
        ffmpegPlan,
        samples: cursor.samples,
      },
      null,
      2,
    ),
    "utf8",
  );

  if (await commandExists("ffmpeg")) {
    await renderWithFfmpeg(ffmpegPlan);
    console.log(`Rendered final video: ${outputVideoPath}`);
    return;
  }

  console.log("ffmpeg was not found on PATH. Generated plan only.");
  console.log(`Source video: ${sourceVideoPath}`);
  console.log(`Planned output: ${outputVideoPath}`);
  console.log(`Run manually: ffmpeg ${ffmpegPlan.args.join(" ")}`);
}
