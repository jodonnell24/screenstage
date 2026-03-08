import type { DemoContext, MotionScene, SceneProgram } from "./types.js";

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
): Promise<void> {
  for (const scene of scenes) {
    await runScene(scene, context);
  }
}

async function runScene(scene: MotionScene, context: DemoContext): Promise<void> {
  switch (scene.type) {
    case "wide":
      await context.camera.wide({ durationMs: scene.durationMs });
      return;

    case "follow-cursor":
      await context.camera.followCursor({
        durationMs: scene.durationMs,
        zoom: scene.zoom,
      });
      return;

    case "focus-selector":
      await context.camera.focusSelector(scene.selector, {
        durationMs: scene.durationMs,
        zoom: scene.zoom,
      });
      return;

    case "focus-point":
      await context.camera.focus(scene.point, {
        durationMs: scene.durationMs,
        zoom: scene.zoom,
      });
      return;

    case "move-selector":
      await context.cursor.moveToSelector(scene.selector, {
        durationMs: scene.durationMs,
        steps: scene.steps,
      });
      return;

    case "move-point":
      await context.cursor.move(scene.point, {
        durationMs: scene.durationMs,
        steps: scene.steps,
      });
      return;

    case "click":
      await context.cursor.click({
        button: scene.button,
        delayMs: scene.delayMs,
      });
      return;

    case "click-selector":
      await context.cursor.clickSelector(scene.selector, {
        button: scene.button,
        delayMs: scene.delayMs,
        durationMs: scene.durationMs,
        steps: scene.steps,
      });
      return;

    case "type":
      await context.cursor.type(scene.text, {
        delayMs: scene.delayMs,
        submit: scene.submit,
      });
      return;

    case "type-selector":
      await context.cursor.typeSelector(scene.selector, scene.text, {
        delayMs: scene.delayMs,
        durationMs: scene.durationMs,
        steps: scene.steps,
        submit: scene.submit,
      });
      return;

    case "wait":
      await waitWithTargets(context, scene.durationMs, scene.target);
      return;
  }
}

export function defineScenes(scenes: SceneProgram): SceneProgram {
  return scenes;
}
