import type { DemoContext, MotionScene, SceneProgram } from "./types.js";

export type SceneExecutionMarker = {
  durationMs?: number;
  endTimeMs?: number;
  label: string;
  timeMs: number;
  type: MotionScene["type"];
};

function sceneTime(context: DemoContext): number {
  const cursorTime = context.cursor.samples.at(-1)?.timeMs ?? 0;
  const cameraTime = context.camera.samples.at(-1)?.timeMs ?? 0;
  return Math.max(cursorTime, cameraTime);
}

function titleize(value: string): string {
  return value
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function defaultSceneLabel(scene: MotionScene): string {
  if (scene.type === "focus-selector") {
    return `Focus ${scene.selector}`;
  }

  if (scene.type === "focus-point") {
    return `Focus Point`;
  }

  if (scene.type === "move-selector") {
    return `Move ${scene.selector}`;
  }

  if (scene.type === "move-point") {
    return "Move Point";
  }

  if (scene.type === "click-selector") {
    return `Click ${scene.selector}`;
  }

  if (scene.type === "type-selector") {
    return `Type ${scene.selector}`;
  }

  if (scene.type === "type") {
    return "Type";
  }

  if (scene.type === "zoom-to") {
    return `Zoom To ${scene.zoom.toFixed(2)}x`;
  }

  return titleize(scene.type);
}

async function waitWithTargets(
  context: DemoContext,
  durationMs: number,
  target: "both" | "camera" | "cursor" = "both",
): Promise<void> {
  if (target === "cursor") {
    await context.cursor.wait(durationMs);
    return;
  }

  if (target === "camera") {
    await context.camera.wait(durationMs);
    return;
  }

  await context.cursor.sample("wait");
  await context.camera.sample("wait");
  await context.page.waitForTimeout(durationMs);
  await context.cursor.sample("wait");
  await context.camera.sample("wait");
}

export async function runScenes(
  scenes: SceneProgram,
  context: DemoContext,
): Promise<SceneExecutionMarker[]> {
  const markers: SceneExecutionMarker[] = [];

  for (const scene of scenes) {
    const marker = await runScene(scene, context);

    if (marker) {
      markers.push(marker);
    }
  }

  return markers;
}

async function runScene(
  scene: MotionScene,
  context: DemoContext,
): Promise<SceneExecutionMarker | undefined> {
  const startTimeMs = sceneTime(context);

  switch (scene.type) {
    case "wide":
      await context.camera.wide({ durationMs: scene.durationMs });
      break;

    case "follow-cursor":
      await context.camera.followCursor({
        durationMs: scene.durationMs,
        zoom: scene.zoom,
      });
      break;

    case "focus-selector":
      await context.camera.focusSelector(scene.selector, {
        durationMs: scene.durationMs,
        zoom: scene.zoom,
      });
      break;

    case "focus-point":
      await context.camera.focus(scene.point, {
        durationMs: scene.durationMs,
        zoom: scene.zoom,
      });
      break;

    case "move-selector":
      await context.cursor.moveToSelector(scene.selector, {
        camera:
          scene.cameraFollow || scene.zoom !== undefined || scene.zoomFrom !== undefined || scene.zoomTo !== undefined
            ? {
                follow: scene.cameraFollow,
                followEnd: scene.followEnd,
                followStart: scene.followStart,
                timingPreset: scene.timingPreset,
                zoom: scene.zoom,
                zoomFrom: scene.zoomFrom,
                zoomEnd: scene.zoomEnd,
                zoomStart: scene.zoomStart,
                zoomTo: scene.zoomTo,
              }
            : undefined,
        durationMs: scene.durationMs,
        steps: scene.steps,
      });
      break;

    case "move-point":
      await context.cursor.move(scene.point, {
        camera:
          scene.cameraFollow || scene.zoom !== undefined || scene.zoomFrom !== undefined || scene.zoomTo !== undefined
            ? {
                follow: scene.cameraFollow,
                followEnd: scene.followEnd,
                followStart: scene.followStart,
                timingPreset: scene.timingPreset,
                zoom: scene.zoom,
                zoomFrom: scene.zoomFrom,
                zoomEnd: scene.zoomEnd,
                zoomStart: scene.zoomStart,
                zoomTo: scene.zoomTo,
              }
            : undefined,
        durationMs: scene.durationMs,
        steps: scene.steps,
      });
      break;

    case "zoom-to":
      await context.camera.zoomTo(scene.zoom, {
        durationMs: scene.durationMs,
        followCursor: scene.followCursor,
        point: scene.point,
      });
      break;

    case "zoom-out":
      await context.camera.zoomOut({
        durationMs: scene.durationMs,
        followCursor: scene.followCursor,
        point: scene.point,
      });
      break;

    case "click":
      await context.cursor.click({
        button: scene.button,
        delayMs: scene.delayMs,
      });
      break;

    case "click-selector":
      await context.cursor.clickSelector(scene.selector, {
        button: scene.button,
        delayMs: scene.delayMs,
        durationMs: scene.durationMs,
        steps: scene.steps,
      });
      break;

    case "type":
      await context.cursor.type(scene.text, {
        delayMs: scene.delayMs,
        submit: scene.submit,
      });
      break;

    case "type-selector":
      await context.cursor.typeSelector(scene.selector, scene.text, {
        delayMs: scene.delayMs,
        durationMs: scene.durationMs,
        steps: scene.steps,
        submit: scene.submit,
      });
      break;

    case "wait":
      await waitWithTargets(context, scene.durationMs, scene.target);
      break;
  }

  const endTimeMs = sceneTime(context);
  const durationMs = Math.max(endTimeMs - startTimeMs, 0);

  return {
    ...(durationMs > 0
      ? {
          durationMs,
          endTimeMs,
        }
      : {}),
    label: scene.label ?? defaultSceneLabel(scene),
    timeMs: startTimeMs,
    type: scene.type,
  };
}

export function defineScenes(scenes: SceneProgram): SceneProgram {
  return scenes;
}
