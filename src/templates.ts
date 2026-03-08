import type {
  FeatureTourOptions,
  FeatureTourStep,
  FormFillCaptureOptions,
  HeroWalkthroughOptions,
  MotionScene,
  SceneProgram,
} from "./types.js";

function appendPause(
  scenes: MotionScene[],
  durationMs: number | undefined,
  target: "both" | "camera" | "cursor" = "both",
): void {
  if (!durationMs || durationMs <= 0) {
    return;
  }

  scenes.push({
    durationMs,
    target,
    type: "wait",
  });
}

function appendFeatureTourStep(
  scenes: MotionScene[],
  step: FeatureTourStep,
): void {
  const action = step.action ?? (typeof step.text === "string" ? "type" : "click");
  const zoom = step.zoom ?? 1.9;
  const shouldLeadWithFocus =
    typeof step.focusFirst === "boolean"
      ? step.focusFirst
      : action === "focus" ||
        action === "type" ||
        !(step.cameraFollow ?? (action === "move"));

  if (shouldLeadWithFocus) {
    scenes.push({
      durationMs: step.focusDurationMs ?? 850,
      label: step.label,
      selector: step.selector,
      type: "focus-selector",
      zoom,
    });
  }

  switch (action) {
    case "focus":
      break;

    case "move":
      scenes.push({
        cameraFollow: step.cameraFollow ?? true,
        durationMs: step.moveDurationMs ?? 800,
        selector: step.selector,
        steps: step.steps,
        type: "move-selector",
        zoom,
      });
      break;

    case "click":
      scenes.push({
        cameraFollow: step.cameraFollow ?? false,
        durationMs: step.moveDurationMs ?? 800,
        selector: step.selector,
        steps: step.steps,
        type: "move-selector",
        zoom,
      });
      scenes.push({
        delayMs: step.clickDelayMs,
        type: "click",
      });
      break;

    case "type":
      if (typeof step.text !== "string") {
        throw new Error(
          `Feature tour step for selector "${step.selector}" requires text when action is "type".`,
        );
      }

      scenes.push({
        delayMs: step.typingDelayMs ?? 75,
        durationMs: step.typingDurationMs ?? 900,
        selector: step.selector,
        steps: step.steps,
        submit: step.submit,
        text: step.text,
        type: "type-selector",
      });
      break;
  }

  appendPause(scenes, step.pauseMs, step.pauseTarget);
}

export function createFeatureTour(options: FeatureTourOptions): SceneProgram {
  const scenes: MotionScene[] = [];

  if (options.includeEstablishingShot !== false) {
    scenes.push({
      durationMs: options.establishDurationMs ?? 400,
      label: "Establish the full product frame",
      type: "wide",
    });
  }

  appendPause(scenes, options.introPauseMs ?? 500);

  for (const step of options.steps) {
    appendFeatureTourStep(scenes, step);
  }

  appendPause(scenes, options.outroPauseMs ?? 800, "camera");
  return scenes;
}

export function createFormFillCapture(
  options: FormFillCaptureOptions,
): SceneProgram {
  const scenes: MotionScene[] = [];

  if (options.includeEstablishingShot !== false) {
    scenes.push({
      durationMs: options.establishDurationMs ?? 450,
      label: "Frame the complete form before interacting",
      type: "wide",
    });
  }

  appendPause(scenes, options.introPauseMs ?? 350, "camera");

  for (const field of options.fields) {
    scenes.push({
      durationMs: 550,
      label: field.label ?? "Set up the field for typing",
      selector: field.selector,
      type: "focus-selector",
      zoom: field.zoom ?? 1.85,
    });
    scenes.push({
      delayMs: field.typingDelayMs ?? 85,
      durationMs: field.typingDurationMs ?? 900,
      selector: field.selector,
      steps: 28,
      submit: field.submit,
      text: field.text,
      type: "type-selector",
    });
    appendPause(scenes, field.pauseMs ?? 250);
  }

  if (options.submitSelector) {
    scenes.push({
      durationMs: 500,
      label: "Frame the submit action",
      selector: options.submitSelector,
      type: "focus-selector",
      zoom: options.submitZoom ?? 1.65,
    });
    scenes.push({
      delayMs: options.submitClickDelayMs,
      durationMs: options.submitMoveDurationMs ?? 750,
      selector: options.submitSelector,
      steps: 24,
      type: "click-selector",
    });
  }

  appendPause(scenes, options.submitPauseMs ?? options.outroPauseMs ?? 900, "both");
  return scenes;
}

export function createHeroWalkthrough(
  options: HeroWalkthroughOptions,
): SceneProgram {
  const scenes: MotionScene[] = [
    {
      durationMs: 600,
      label: "Open on the full product frame",
      type: "wide",
    },
  ];

  appendPause(scenes, options.introPauseMs ?? 650, "camera");

  scenes.push(
    {
      durationMs: 650,
      label: "Move into the lead capture field",
      selector: options.fieldSelector,
      type: "focus-selector",
      zoom: options.fieldZoom ?? 1.9,
    },
    {
      durationMs: 1000,
      label: "Fill the lead form",
      selector: options.fieldSelector,
      text: options.fieldText,
      type: "type-selector",
      delayMs: 75,
      steps: 30,
    },
    {
      durationMs: 550,
      label: "Reframe to the CTA before committing",
      selector: options.ctaSelector,
      type: "focus-selector",
      zoom: options.ctaZoom ?? 1.7,
    },
    {
      durationMs: options.ctaMoveDurationMs ?? 700,
      label: "Commit the CTA",
      selector: options.ctaSelector,
      steps: 22,
      type: "click-selector",
    },
  );

  if (options.metricSelector) {
    appendPause(scenes, 250, "both");
    scenes.push({
      durationMs: options.metricMoveDurationMs ?? 900,
      label: "Reveal the supporting proof point",
      selector: options.metricSelector,
      type: "focus-selector",
      zoom: options.metricZoom ?? 1.65,
    });
    appendPause(
      scenes,
      options.metricPauseMs ?? options.outroPauseMs ?? 900,
      "camera",
    );
  } else {
    appendPause(scenes, options.outroPauseMs ?? 1000, "camera");
  }

  return scenes;
}
