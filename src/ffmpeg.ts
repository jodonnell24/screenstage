import { spawn } from "node:child_process";

import type { CursorSample, FfmpegPlan, LoadedMotionConfig } from "./types.js";

type CropPoint = {
  timeMs: number;
  value: number;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function getCropSize(config: LoadedMotionConfig): {
  cropHeight: number;
  cropWidth: number;
} {
  const sourceAspect = config.viewport.width / config.viewport.height;
  const outputAspect = config.output.width / config.output.height;
  const targetZoom = config.camera.zoom;

  if (sourceAspect >= outputAspect) {
    const cropHeight = config.viewport.height / targetZoom;
    const cropWidth = cropHeight * outputAspect;
    return {
      cropHeight: Math.round(cropHeight),
      cropWidth: Math.round(cropWidth),
    };
  }

  const cropWidth = config.viewport.width / targetZoom;
  const cropHeight = cropWidth / outputAspect;
  return {
    cropHeight: Math.round(cropHeight),
    cropWidth: Math.round(cropWidth),
  };
}

function buildPiecewiseExpression(points: CropPoint[]): string {
  if (points.length === 0) {
    return "0";
  }

  if (points.length === 1) {
    return formatNumber(points[0].value);
  }

  let expression = formatNumber(points.at(-1)!.value);

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const current = points[index];
    const next = points[index + 1];
    const durationSeconds = Math.max((next.timeMs - current.timeMs) / 1000, 0.001);
    const startSeconds = current.timeMs / 1000;
    const currentValue = formatNumber(current.value);
    const nextValue = formatNumber(next.value);
    const rampExpression =
      currentValue === nextValue
        ? currentValue
        : `(${currentValue}+(${nextValue}-${currentValue})*clip((t-${formatNumber(startSeconds)})/${formatNumber(durationSeconds)},0,1))`;

    expression = `if(lt(t,${formatNumber(next.timeMs / 1000)}),${rampExpression},${expression})`;
  }

  return expression;
}

function buildCropPoints(
  samples: CursorSample[],
  config: LoadedMotionConfig,
  cropWidth: number,
  cropHeight: number,
): { xPoints: CropPoint[]; yPoints: CropPoint[] } {
  const maxX = Math.max(config.viewport.width - cropWidth, 0);
  const maxY = Math.max(config.viewport.height - cropHeight, 0);
  const horizontalPadding = Math.min(config.camera.padding, cropWidth / 2);
  const verticalPadding = Math.min(config.camera.padding, cropHeight / 2);

  const xPoints = samples.map((sample) => ({
    timeMs: sample.timeMs,
    value: clamp(
      clamp(
        sample.x - cropWidth / 2,
        sample.x - (cropWidth - horizontalPadding),
        sample.x - horizontalPadding,
      ),
      0,
      maxX,
    ),
  }));

  const yPoints = samples.map((sample) => ({
    timeMs: sample.timeMs,
    value: clamp(
      clamp(
        sample.y - cropHeight / 2,
        sample.y - (cropHeight - verticalPadding),
        sample.y - verticalPadding,
      ),
      0,
      maxY,
    ),
  }));

  return { xPoints, yPoints };
}

function condensePoints(points: CropPoint[]): CropPoint[] {
  if (points.length <= 2) {
    return points;
  }

  const sampled: CropPoint[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const previous = sampled.at(-1)!;
    const timeDelta = point.timeMs - previous.timeMs;
    const valueDelta = Math.abs(point.value - previous.value);

    if (timeDelta < 120 && valueDelta < 10) {
      continue;
    }

    sampled.push(point);
  }

  const lastPoint = points.at(-1)!;
  if (sampled.at(-1)!.timeMs !== lastPoint.timeMs) {
    sampled.push(lastPoint);
  }

  const condensed: CropPoint[] = [sampled[0]];

  for (let index = 1; index < sampled.length; index += 1) {
    const point = sampled[index];
    const previous = condensed.at(-1)!;

    if (Math.abs(point.value - previous.value) < 0.5) {
      condensed[condensed.length - 1] = point;
      continue;
    }

    condensed.push(point);
  }

  return condensed;
}

export function buildFfmpegPlan(
  sourcePath: string,
  outputPath: string,
  config: LoadedMotionConfig,
  samples: CursorSample[],
): FfmpegPlan {
  const { cropHeight, cropWidth } = getCropSize(config);
  const rawPoints = buildCropPoints(samples, config, cropWidth, cropHeight);
  const xPoints = condensePoints(rawPoints.xPoints);
  const yPoints = condensePoints(rawPoints.yPoints);
  const xExpression = buildPiecewiseExpression(xPoints);
  const yExpression = buildPiecewiseExpression(yPoints);
  const filter = [
    `fps=${config.output.fps}`,
    `crop=w=${cropWidth}:h=${cropHeight}:x='${xExpression}':y='${yExpression}'`,
    `scale=${config.output.width}:${config.output.height}:flags=lanczos`,
    "format=yuv420p",
  ].join(",");

  return {
    args: [
      "-y",
      "-i",
      sourcePath,
      "-vf",
      filter,
      "-c:v",
      config.output.codec,
      "-preset",
      "slow",
      "-crf",
      "18",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    cropHeight,
    cropWidth,
    outputPath,
    sourcePath,
    xExpression,
    yExpression,
  };
}

export function commandExists(command: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(command, ["-version"], {
      stdio: "ignore",
    });

    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
}

export function renderWithFfmpeg(plan: FfmpegPlan): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", plan.args, {
      stdio: "inherit",
    });

    child.once("error", (error) => reject(error));
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`ffmpeg exited with code ${code ?? "unknown"}.`));
    });
  });
}
