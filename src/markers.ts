import fs from "node:fs/promises";
import path from "node:path";

import type { RecordedMarker } from "./manual-recorder.js";

type MarkerSource = "manual" | "scene";

export type EditMarker = {
  durationMs?: number;
  endTimeMs?: number;
  label: string;
  source: MarkerSource;
  timeMs: number;
  type: string;
};

export function labelManualMarkerKind(kind: RecordedMarker["kind"]): string {
  if (kind === "follow") {
    return "Punch In";
  }

  if (kind === "hold") {
    return "Hold";
  }

  return "Wide";
}

export function buildManualEditMarkers(markers: RecordedMarker[]): EditMarker[] {
  return markers.map((marker) => ({
    label: labelManualMarkerKind(marker.kind),
    source: "manual",
    timeMs: marker.timeMs,
    type: marker.kind,
  }));
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

export function formatTimecode(timeMs: number, fps: number): string {
  const totalFrames = Math.max(Math.round((timeMs / 1000) * fps), 0);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

function escapeCsv(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }

  return `"${value.replaceAll('"', '""')}"`;
}

export async function writeMarkerArtifacts(
  sessionDir: string,
  fps: number,
  markers: EditMarker[],
): Promise<{
  csvPath: string;
  jsonPath: string;
}> {
  const normalized = markers
    .filter((marker) => marker.label.trim().length > 0)
    .map((marker, index) => ({
      ...marker,
      index: index + 1,
      seconds: Number((marker.timeMs / 1000).toFixed(3)),
      timecode: formatTimecode(marker.timeMs, fps),
      endTimecode:
        marker.endTimeMs !== undefined
          ? formatTimecode(marker.endTimeMs, fps)
          : undefined,
    }));
  const jsonPath = path.join(sessionDir, "markers.json");
  const csvPath = path.join(sessionDir, "markers.csv");

  await fs.writeFile(jsonPath, JSON.stringify(normalized, null, 2), "utf8");

  const csvLines = [
    [
      "index",
      "timecode",
      "seconds",
      "label",
      "type",
      "source",
      "duration_ms",
      "end_timecode",
    ].join(","),
    ...normalized.map((marker) =>
      [
        String(marker.index),
        marker.timecode,
        String(marker.seconds),
        escapeCsv(marker.label),
        marker.type,
        marker.source,
        marker.durationMs !== undefined ? String(marker.durationMs) : "",
        marker.endTimecode ?? "",
      ].join(","),
    ),
  ];

  await fs.writeFile(csvPath, `${csvLines.join("\n")}\n`, "utf8");

  return {
    csvPath,
    jsonPath,
  };
}
