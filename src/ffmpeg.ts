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
  return samples.map((sample) => {
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

export function buildFfmpegPlans(
  sourcePath: string,
  sessionDir: string,
  config: LoadedMotionConfig,
  cursorSamples: CursorSample[],
  cameraSamples: CameraSample[],
  layout: CompositionLayout,
): FfmpegPlan[] {
  const frames =
    cameraSamples.length > 1
      ? buildFrameStatesFromCamera(cameraSamples, config, layout)
      : buildFrameStatesFromCursor(cursorSamples, config, layout);
  const lastCursorTimeMs = cursorSamples.at(-1)?.timeMs ?? 0;
  const lastCameraTimeMs = cameraSamples.at(-1)?.timeMs ?? 0;
  const durationSeconds = Number(
    ((Math.max(lastCursorTimeMs, lastCameraTimeMs) + 1000 / config.output.fps) / 1000)
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
