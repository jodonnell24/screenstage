import { spawn } from "node:child_process";

import type {
  CameraSample,
  CompositionLayout,
  CursorSample,
  FfmpegPlan,
  LoadedMotionConfig,
  OutputFormat,
} from "./types.js";

type NumericPoint = {
  timeMs: number;
  value: number;
};

type FrameState = {
  cropHeight: number;
  cropWidth: number;
  timeMs: number;
  x: number;
  y: number;
};

type DurationWindow = {
  endTimeMs: number;
  startTimeMs: number;
};

const FORMAT_SETTINGS: Record<
  OutputFormat,
  {
    args: string[];
    extension: "mov" | "mp4";
    postScaleFormat: string;
    suffix: string;
  }
> = {
  mp4: {
    args: [
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "18",
      "-movflags",
      "+faststart",
    ],
    extension: "mp4",
    postScaleFormat: "format=yuv420p",
    suffix: "final",
  },
  prores: {
    args: [
      "-c:v",
      "prores_ks",
      "-profile:v",
      "3",
      "-pix_fmt",
      "yuv422p10le",
      "-vendor",
      "apl0",
    ],
    extension: "mov",
    postScaleFormat: "format=yuv422p10le",
    suffix: "final-prores",
  },
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function alignEven(value: number): number {
  const rounded = Math.max(2, Math.round(value));
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

function formatNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

function buildPiecewiseExpression(points: NumericPoint[]): string {
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

function getCropSizeForZoom(
  config: LoadedMotionConfig,
  layout: CompositionLayout,
  zoom: number,
): { cropHeight: number; cropWidth: number } {
  const safeZoom = Math.max(1, zoom);
  const sourceAspect = config.viewport.width / config.viewport.height;
  const outputAspect = layout.contentWidth / layout.contentHeight;

  if (sourceAspect >= outputAspect) {
    const cropHeight = alignEven(config.viewport.height / safeZoom);
    const cropWidth = alignEven(cropHeight * outputAspect);
    return {
      cropHeight,
      cropWidth,
    };
  }

  const cropWidth = alignEven(config.viewport.width / safeZoom);
  const cropHeight = alignEven(cropWidth / outputAspect);
  return {
    cropHeight,
    cropWidth,
  };
}

function buildFrameStatesFromCursor(
  samples: CursorSample[],
  config: LoadedMotionConfig,
  layout: CompositionLayout,
): FrameState[] {
  const frames = samples.map((sample) => {
    const { cropHeight, cropWidth } = getCropSizeForZoom(
      config,
      layout,
      config.camera.zoom,
    );

    return {
      cropHeight,
      cropWidth,
      timeMs: sample.timeMs,
      x: sample.x,
      y: sample.y,
    };
  });

  return smoothFrameStates(frames, config);
}

function buildFrameStatesFromCamera(
  samples: CameraSample[],
  config: LoadedMotionConfig,
  layout: CompositionLayout,
): FrameState[] {
  return samples.map((sample) => {
    const { cropHeight, cropWidth } = getCropSizeForZoom(config, layout, sample.zoom);

    return {
      cropHeight,
      cropWidth,
      timeMs: sample.timeMs,
      x: sample.x,
      y: sample.y,
    };
  });
}

function resolveDurationWindow(
  cursorSamples: CursorSample[],
  cameraSamples: CameraSample[],
): DurationWindow {
  const endTimeMs = Math.max(
    cursorSamples.at(-1)?.timeMs ?? 0,
    cameraSamples.at(-1)?.timeMs ?? 0,
  );

  return {
    endTimeMs,
    startTimeMs: 0,
  };
}

function buildStaticFrameStates(
  duration: DurationWindow,
  config: LoadedMotionConfig,
  layout: CompositionLayout,
): FrameState[] {
  const { cropHeight, cropWidth } = getCropSizeForZoom(
    config,
    layout,
    config.camera.zoom,
  );
  const centerX = config.viewport.width / 2;
  const centerY = config.viewport.height / 2;

  return [
    {
      cropHeight,
      cropWidth,
      timeMs: duration.startTimeMs,
      x: centerX,
      y: centerY,
    },
    {
      cropHeight,
      cropWidth,
      timeMs: duration.endTimeMs,
      x: centerX,
      y: centerY,
    },
  ];
}

function buildNumericPoints(
  frames: FrameState[],
  config: LoadedMotionConfig,
): {
  cropHeightPoints: NumericPoint[];
  cropWidthPoints: NumericPoint[];
  xPoints: NumericPoint[];
  yPoints: NumericPoint[];
} {
  return {
    cropHeightPoints: frames.map((frame) => ({
      timeMs: frame.timeMs,
      value: frame.cropHeight,
    })),
    cropWidthPoints: frames.map((frame) => ({
      timeMs: frame.timeMs,
      value: frame.cropWidth,
    })),
    xPoints: frames.map((frame) => {
      const maxX = Math.max(config.viewport.width - frame.cropWidth, 0);
      const horizontalPadding = Math.min(config.camera.padding, frame.cropWidth / 2);

      return {
        timeMs: frame.timeMs,
        value: clamp(
          clamp(
            frame.x - frame.cropWidth / 2,
            frame.x - (frame.cropWidth - horizontalPadding),
            frame.x - horizontalPadding,
          ),
          0,
          maxX,
        ),
      };
    }),
    yPoints: frames.map((frame) => {
      const maxY = Math.max(config.viewport.height - frame.cropHeight, 0);
      const verticalPadding = Math.min(config.camera.padding, frame.cropHeight / 2);

      return {
        timeMs: frame.timeMs,
        value: clamp(
          clamp(
            frame.y - frame.cropHeight / 2,
            frame.y - (frame.cropHeight - verticalPadding),
            frame.y - verticalPadding,
          ),
          0,
          maxY,
        ),
      };
    }),
  };
}

function gaussianWeight(distanceMs: number, smoothingMs: number): number {
  const sigma = Math.max(smoothingMs / 2, 1);
  return Math.exp(-0.5 * Math.pow(distanceMs / sigma, 2));
}

function smoothSeries(
  frames: FrameState[],
  valueAt: (frame: FrameState) => number,
  smoothingMs: number,
): number[] {
  if (frames.length <= 2 || smoothingMs <= 0) {
    return frames.map(valueAt);
  }

  const windowMs = Math.max(smoothingMs * 2.5, 1);

  return frames.map((frame, index) => {
    let weightedTotal = 0;
    let weightTotal = 0;

    for (let neighborIndex = index; neighborIndex >= 0; neighborIndex -= 1) {
      const neighbor = frames[neighborIndex];
      const distanceMs = frame.timeMs - neighbor.timeMs;

      if (distanceMs > windowMs) {
        break;
      }

      const weight = gaussianWeight(distanceMs, smoothingMs);
      weightedTotal += valueAt(neighbor) * weight;
      weightTotal += weight;
    }

    for (
      let neighborIndex = index + 1;
      neighborIndex < frames.length;
      neighborIndex += 1
    ) {
      const neighbor = frames[neighborIndex];
      const distanceMs = neighbor.timeMs - frame.timeMs;

      if (distanceMs > windowMs) {
        break;
      }

      const weight = gaussianWeight(distanceMs, smoothingMs);
      weightedTotal += valueAt(neighbor) * weight;
      weightTotal += weight;
    }

    return weightTotal > 0 ? weightedTotal / weightTotal : valueAt(frame);
  });
}

function stabilizePoints(
  xValues: number[],
  yValues: number[],
  deadzonePx: number,
): { xValues: number[]; yValues: number[] } {
  if (xValues.length <= 1 || deadzonePx <= 0) {
    return {
      xValues: [...xValues],
      yValues: [...yValues],
    };
  }

  const stabilizedX = [xValues[0]];
  const stabilizedY = [yValues[0]];

  for (let index = 1; index < xValues.length; index += 1) {
    const previousX = stabilizedX[index - 1];
    const previousY = stabilizedY[index - 1];
    const nextX = xValues[index];
    const nextY = yValues[index];
    const distance = Math.hypot(
      nextX - previousX,
      nextY - previousY,
    );

    if (distance < deadzonePx) {
      stabilizedX.push(previousX);
      stabilizedY.push(previousY);
      continue;
    }

    stabilizedX.push(nextX);
    stabilizedY.push(nextY);
  }

  return {
    xValues: stabilizedX,
    yValues: stabilizedY,
  };
}

function smoothFrameStates(
  frames: FrameState[],
  config: LoadedMotionConfig,
): FrameState[] {
  if (frames.length <= 2) {
    return frames;
  }

  const smoothingMs = config.camera.smoothingMs;
  const deadzonePx = config.camera.deadzonePx;
  const xValues = smoothSeries(frames, (frame) => frame.x, smoothingMs);
  const yValues = smoothSeries(frames, (frame) => frame.y, smoothingMs);
  const stabilized = stabilizePoints(xValues, yValues, deadzonePx);

  return frames.map((frame, index) => ({
    ...frame,
    x: stabilized.xValues[index],
    y: stabilized.yValues[index],
  }));
}

function condensePoints(
  points: NumericPoint[],
  thresholdMs: number,
  thresholdValue: number,
): NumericPoint[] {
  if (points.length <= 2) {
    return points;
  }

  const sampled: NumericPoint[] = [points[0]];

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const previous = sampled.at(-1)!;
    const timeDelta = point.timeMs - previous.timeMs;
    const valueDelta = Math.abs(point.value - previous.value);

    if (timeDelta < thresholdMs && valueDelta < thresholdValue) {
      continue;
    }

    sampled.push(point);
  }

  const lastPoint = points.at(-1)!;
  if (sampled.at(-1)!.timeMs !== lastPoint.timeMs) {
    sampled.push(lastPoint);
  }

  const condensed: NumericPoint[] = [sampled[0]];

  for (let index = 1; index < sampled.length; index += 1) {
    const point = sampled[index];
    const previous = condensed.at(-1)!;

    if (Math.abs(point.value - previous.value) < thresholdValue / 10) {
      condensed[condensed.length - 1] = point;
      continue;
    }

    condensed.push(point);
  }

  return condensed;
}

function getFormatOutputPath(
  sessionDir: string,
  format: OutputFormat,
): string {
  const settings = FORMAT_SETTINGS[format];
  return `${sessionDir}/${settings.suffix}.${settings.extension}`;
}

function renderFfmpegArgs(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, {
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

export function buildFfmpegPlans(
  sourcePath: string,
  sessionDir: string,
  config: LoadedMotionConfig,
  cursorSamples: CursorSample[],
  cameraSamples: CameraSample[],
  layout: CompositionLayout,
): FfmpegPlan[] {
  const duration = resolveDurationWindow(cursorSamples, cameraSamples);
  const frames =
    config.camera.mode === "static"
      ? buildStaticFrameStates(duration, config, layout)
      : cameraSamples.length > 1
        ? buildFrameStatesFromCamera(cameraSamples, config, layout)
        : buildFrameStatesFromCursor(cursorSamples, config, layout);
  const durationSeconds = Number(
    ((duration.endTimeMs + 1000 / config.output.fps) / 1000)
      .toFixed(3),
  );
  const numericPoints = buildNumericPoints(frames, config);
  const cropWidthPoints = condensePoints(numericPoints.cropWidthPoints, 150, 16);
  const cropHeightPoints = condensePoints(numericPoints.cropHeightPoints, 150, 16);
  const xPoints = condensePoints(numericPoints.xPoints, 120, 10);
  const yPoints = condensePoints(numericPoints.yPoints, 120, 10);
  const cropWidthExpression = buildPiecewiseExpression(cropWidthPoints);
  const cropHeightExpression = buildPiecewiseExpression(cropHeightPoints);
  const xExpression = buildPiecewiseExpression(xPoints);
  const yExpression = buildPiecewiseExpression(yPoints);
  return config.output.formats.map((format) => {
    const settings = FORMAT_SETTINGS[format];

    if (!layout.enabled) {
      const filter = [
        `fps=${config.output.fps}`,
        `crop=w='${cropWidthExpression}':h='${cropHeightExpression}':x='${xExpression}':y='${yExpression}'`,
        `scale=${config.output.width}:${config.output.height}:flags=lanczos`,
        "setsar=1",
        settings.postScaleFormat,
      ].join(",");

      return {
        args: [
          "-y",
          "-i",
          sourcePath,
          "-t",
          String(durationSeconds),
          "-vf",
          filter,
          ...settings.args,
          getFormatOutputPath(sessionDir, format),
        ],
        compositionAssetPath: undefined,
        cropHeightExpression,
        cropWidthExpression,
        durationSeconds,
        format,
        outputPath: getFormatOutputPath(sessionDir, format),
        sourcePath,
        xExpression,
        yExpression,
      };
    }

    const filterComplex = [
      `[0:v]fps=${config.output.fps},crop=w='${cropWidthExpression}':h='${cropHeightExpression}':x='${xExpression}':y='${yExpression}',scale=${layout.contentWidth}:${layout.contentHeight}:flags=lanczos,pad=${layout.outputWidth}:${layout.outputHeight}:${layout.contentX}:${layout.contentY}:color=black,setsar=1[base]`,
      `[base][1:v]overlay=0:0:shortest=1,${settings.postScaleFormat}[outv]`,
    ].join(";");

    return {
      args: [
        "-y",
        "-i",
        sourcePath,
        "-loop",
        "1",
        "-i",
        layout.assetPath!,
        "-t",
        String(durationSeconds),
        "-filter_complex",
        filterComplex,
        "-map",
        "[outv]",
        "-shortest",
        ...settings.args,
        getFormatOutputPath(sessionDir, format),
      ],
      compositionAssetPath: layout.assetPath,
      cropHeightExpression,
      cropWidthExpression,
      durationSeconds,
      format,
      outputPath: getFormatOutputPath(sessionDir, format),
      sourcePath,
      xExpression,
      yExpression,
    };
  });
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
  return renderFfmpegArgs(plan.args);
}

export async function renderPosterFrame(
  sourcePath: string,
  outputPath: string,
  durationSeconds: number,
): Promise<void> {
  const timestampSeconds = Number(
    Math.min(Math.max(durationSeconds * 0.35, 0.2), Math.max(durationSeconds - 0.2, 0.2))
      .toFixed(3),
  );

  await renderFfmpegArgs([
    "-y",
    "-ss",
    String(timestampSeconds),
    "-i",
    sourcePath,
    "-update",
    "1",
    "-frames:v",
    "1",
    outputPath,
  ]);
}

export async function renderContactSheet(
  sourcePath: string,
  outputPath: string,
  durationSeconds: number,
): Promise<void> {
  const frameCount = 12;
  const intervalSeconds = Math.max(durationSeconds / frameCount, 0.5);
  const fpsExpression = `fps=1/${formatNumber(intervalSeconds)}`;
  const filter = [
    fpsExpression,
    "scale=320:-1:flags=lanczos",
    "tile=4x3:padding=18:margin=28:color=white",
  ].join(",");

  await renderFfmpegArgs([
    "-y",
    "-i",
    sourcePath,
    "-update",
    "1",
    "-frames:v",
    "1",
    "-vf",
    filter,
    outputPath,
  ]);
}
