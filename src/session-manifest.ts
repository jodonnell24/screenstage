import fs from "node:fs/promises";
import path from "node:path";

import type { EditMarker } from "./markers.js";
import type { LoadedMotionConfig } from "./types.js";

type ManifestArtifact = {
  path: string;
  type: string;
};

type ManifestArtifacts = {
  [key: string]: ManifestArtifact | ManifestArtifact[] | undefined;
};

type SessionManifestInput = {
  artifacts: ManifestArtifacts;
  captureUrl: string;
  config: LoadedMotionConfig;
  durationSeconds?: number;
  markers: EditMarker[];
  mode: "manual-record" | "run";
  sessionDir: string;
};

function relativeArtifactPath(sessionDir: string, filePath: string): string {
  return path.relative(sessionDir, filePath) || ".";
}

function artifact(
  sessionDir: string,
  filePath: string,
  type: string,
): ManifestArtifact {
  return {
    path: relativeArtifactPath(sessionDir, filePath),
    type,
  };
}

export async function writeSessionManifest({
  artifacts,
  captureUrl,
  config,
  durationSeconds,
  markers,
  mode,
  sessionDir,
}: SessionManifestInput): Promise<string> {
  const manifestPath = path.join(sessionDir, "manifest.json");

  await fs.writeFile(
    manifestPath,
    JSON.stringify(
      {
        artifacts,
        camera: {
          mode: config.camera.mode,
          preset: config.camera.preset,
          zoom: config.camera.zoom,
        },
        captureUrl,
        composition: {
          device: config.composition.device,
          preset: config.composition.preset,
        },
        config: {
          fps: config.output.fps,
          name: config.name,
          outputPreset: config.output.preset,
          viewport: config.viewport,
        },
        createdAt: new Date().toISOString(),
        durationSeconds,
        markerCount: markers.length,
        markers: markers.map((marker) => ({
          label: marker.label,
          source: marker.source,
          timeMs: marker.timeMs,
          type: marker.type,
        })),
        mode,
        session: {
          dir: sessionDir,
          name: path.basename(sessionDir),
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  return manifestPath;
}

export { artifact };
