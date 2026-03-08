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

  scenes.push({
    durationMs: step.focusDurationMs ?? 850,
    label: step.label,
    selector: step.selector,
    type: "focus-selector",
    zoom,
  });

  switch (action) {
    case "focus":
      break;

    case "move":
      scenes.push({
        durationMs: step.handoffDurationMs ?? 250,
        type: "follow-cursor",
      });
      scenes.push({
        durationMs: step.moveDurationMs ?? 800,
        selector: step.selector,
        steps: step.steps,
        type: "move-selector",
      });
      break;

    case "click":
      scenes.push({
        durationMs: step.handoffDurationMs ?? 250,
        type: "follow-cursor",
      });
      scenes.push({
        durationMs: step.moveDurationMs ?? 800,
        selector: step.selector,
        steps: step.steps,
        type: "move-selector",
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
  const steps: FeatureTourStep[] = options.fields.map((field) => ({
    action: "type",
    label: field.label,
    pauseMs: field.pauseMs ?? 250,
    selector: field.selector,
    submit: field.submit,
    text: field.text,
    typingDelayMs: field.typingDelayMs,
    typingDurationMs: field.typingDurationMs,
    zoom: field.zoom ?? 2,
  }));

  if (options.submitSelector) {
    steps.push({
      action: "click",
      clickDelayMs: options.submitClickDelayMs,
      moveDurationMs: options.submitMoveDurationMs ?? 850,
      pauseMs: options.submitPauseMs ?? 900,
      selector: options.submitSelector,
      zoom: options.submitZoom ?? 1.8,
    });
  }

  return createFeatureTour({
    establishDurationMs: options.establishDurationMs,
    includeEstablishingShot: options.includeEstablishingShot,
    introPauseMs: options.introPauseMs,
    outroPauseMs: options.outroPauseMs,
    steps,
  });
}

export function createHeroWalkthrough(
  options: HeroWalkthroughOptions,
): SceneProgram {
  const steps: FeatureTourStep[] = [
    {
      action: "type",
      label: "Fill the lead form",
      pauseMs: 300,
      selector: options.fieldSelector,
      text: options.fieldText,
      typingDelayMs: 75,
      typingDurationMs: 900,
      zoom: options.fieldZoom ?? 2,
    },
    {
      action: "click",
      label: "Commit the CTA",
      moveDurationMs: options.ctaMoveDurationMs ?? 850,
      pauseMs: options.metricSelector ? 850 : options.outroPauseMs ?? 1000,
      selector: options.ctaSelector,
      zoom: options.ctaZoom ?? 1.8,
    },
  ];

  if (options.metricSelector) {
    steps.push({
      action: "move",
      label: "Shift toward the supporting proof point",
      moveDurationMs: options.metricMoveDurationMs ?? 900,
      pauseMs: options.metricPauseMs ?? options.outroPauseMs ?? 800,
      pauseTarget: "camera",
      selector: options.metricSelector,
      zoom: options.metricZoom ?? 1.8,
    });
  }

  return createFeatureTour({
    establishDurationMs: 400,
    includeEstablishingShot: true,
    introPauseMs: options.introPauseMs ?? 600,
    outroPauseMs: 0,
    steps,
  });
}
