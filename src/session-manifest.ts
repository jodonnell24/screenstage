import fs from "node:fs/promises";
import path from "node:path";

import type { EditMarker } from "./markers.js";
import type { LoadedMotionConfig } from "./types.js";

export type ManifestArtifact = {
  path: string;
  type: string;
};

export type ManifestArtifacts = {
  [key: string]: ManifestArtifact | ManifestArtifact[] | undefined;
};

export type SessionManifestMode = "manual-record" | "run";

export type SessionManifest = {
  artifacts: ManifestArtifacts;
  camera: {
    mode: LoadedMotionConfig["camera"]["mode"];
    preset: LoadedMotionConfig["camera"]["preset"];
    zoom: number;
  };
  captureUrl: string;
  composition: {
    device: LoadedMotionConfig["composition"]["device"];
    preset: LoadedMotionConfig["composition"]["preset"];
  };
  config: {
    fps: number;
    name: string;
    outputPreset: LoadedMotionConfig["output"]["preset"];
    viewport: LoadedMotionConfig["viewport"];
  };
  createdAt: string;
  durationSeconds?: number;
  markerCount: number;
  markers: Array<{
    label: string;
    source: EditMarker["source"];
    timeMs: number;
    type: EditMarker["type"];
  }>;
  mode: SessionManifestMode;
  schemaVersion: 1;
  session: {
    dir: string;
    name: string;
  };
};

type SessionManifestInput = {
  artifacts: ManifestArtifacts;
  captureUrl: string;
  config: LoadedMotionConfig;
  durationSeconds?: number;
  markers: EditMarker[];
  mode: SessionManifestMode;
  sessionDir: string;
};

function relativeArtifactPath(sessionDir: string, filePath: string): string {
  const relativePath = path.relative(sessionDir, filePath) || ".";

  if (
    relativePath === "." ||
    relativePath.startsWith(`..${path.sep}`) ||
    relativePath === ".."
  ) {
    return path.resolve(filePath);
  }

  return relativePath;
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
  const manifest: SessionManifest = {
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
    schemaVersion: 1,
    session: {
      dir: sessionDir,
      name: path.basename(sessionDir),
    },
  };

  await fs.writeFile(
    manifestPath,
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  return manifestPath;
}

export { artifact };
