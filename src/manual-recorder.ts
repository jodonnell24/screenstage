import type { Page } from "playwright";

import type { CursorSample, MouseButton } from "./types.js";

export type ManualMarkerKind = "follow" | "hold" | "wide";

export type RecordedAction =
  | {
      button: MouseButton;
      kind: "click";
      selector?: string;
      timeMs: number;
      x: number;
      y: number;
    }
  | {
      deltaX: number;
      deltaY: number;
      kind: "scroll";
      selector?: string;
      timeMs: number;
      x: number;
      y: number;
    }
  | {
      delayMs: number;
      kind: "type";
      selector?: string;
      submit: boolean;
      text: string;
      timeMs: number;
      x?: number;
      y?: number;
    };

export type RecordedMarker = {
  kind: ManualMarkerKind;
  timeMs: number;
  x: number;
  y: number;
};

export type ManualRecording = {
  actions: RecordedAction[];
  cancelled: boolean;
  cursorSamples: CursorSample[];
  durationMs: number;
  markers: RecordedMarker[];
};

export type ManualRecorderControls = {
  cancel: () => Promise<void>;
  finish: () => Promise<void>;
  mark: (kind: ManualMarkerKind) => Promise<void>;
  waitForFinish: () => Promise<ManualRecording>;
};

type ManualRecorderInstallOptions = {
  onControlsFocusRequest?: () => void | Promise<void>;
  onMarkerStatusChange?: (label: string) => void | Promise<void>;
};

const RECORDER_SCRIPT = `
(() => {
  if (window.__motionManualRecorder) {
    return;
  }

  const state = {
    actions: [],
    activeType: null,
    cancelled: false,
    cursorSamples: [],
    finishTimeMs: null,
    finished: false,
    lastMarkerLabel: "Wide",
    lastPointer: null,
    startedAt: performance.now(),
    markers: [],
  };

  const now = () => performance.now() - state.startedAt;

  const toMouseButton = (button) => {
    if (button === 1) {
      return "middle";
    }

    if (button === 2) {
      return "right";
    }

    return "left";
  };

  const isEditableElement = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (element.isContentEditable) {
      return true;
    }

    if (element instanceof HTMLTextAreaElement) {
      return true;
    }

    if (element instanceof HTMLInputElement) {
      const type = (element.getAttribute("type") || "text").toLowerCase();
      return ["email", "number", "password", "search", "tel", "text", "url"].includes(type);
    }

    return false;
  };

  const getElementValue = (element) => {
    if (!(element instanceof HTMLElement)) {
      return "";
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value;
    }

    if (element.isContentEditable) {
      return element.textContent || "";
    }

    return "";
  };

  const isInsideRecorderUi = (target) => {
    return target instanceof HTMLElement && Boolean(target.closest("#__motion_record_panel"));
  };

  const uniqueSelector = (selector) => {
    if (!selector) {
      return false;
    }

    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  };

  const attributeSelector = (element, attributeName) => {
    const value = element.getAttribute(attributeName);

    if (!value) {
      return null;
    }

    const tagName = element.tagName.toLowerCase();
    return \`\${tagName}[\${attributeName}="\${CSS.escape(value)}"]\`;
  };

  const baseSelector = (element) => {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const dataAttributes = [
      "data-demo",
      "data-testid",
      "data-test",
      "data-testid",
    ];

    for (const attributeName of dataAttributes) {
      const selector = attributeSelector(element, attributeName);

      if (selector && uniqueSelector(selector)) {
        return selector;
      }
    }

    if (element.id) {
      const selector = \`#\${CSS.escape(element.id)}\`;

      if (uniqueSelector(selector)) {
        return selector;
      }
    }

    const otherAttributes = ["name", "placeholder", "aria-label", "title"];

    for (const attributeName of otherAttributes) {
      const selector = attributeSelector(element, attributeName);

      if (selector && uniqueSelector(selector)) {
        return selector;
      }
    }

    return null;
  };

  const nthSelector = (element) => {
    if (!(element instanceof HTMLElement) || !element.parentElement) {
      return null;
    }

    const tagName = element.tagName.toLowerCase();
    const siblings = Array.from(element.parentElement.children).filter(
      (candidate) => candidate.tagName === element.tagName,
    );
    const index = siblings.indexOf(element) + 1;

    if (index <= 0) {
      return tagName;
    }

    return \`\${tagName}:nth-of-type(\${index})\`;
  };

  const selectorFor = (element) => {
    if (!(element instanceof HTMLElement) || isInsideRecorderUi(element)) {
      return null;
    }

    const direct = baseSelector(element);

    if (direct) {
      return direct;
    }

    const segments = [];
    let current = element;

    while (current && current !== document.body && segments.length < 6) {
      const base = baseSelector(current) || nthSelector(current);

      if (!base) {
        current = current.parentElement;
        continue;
      }

      segments.unshift(base);
      const candidate = segments.join(" > ");

      if (uniqueSelector(candidate)) {
        return candidate;
      }

      current = current.parentElement;
    }

    return segments.join(" > ") || null;
  };

  const sampleCursor = (kind, x, y, force = false) => {
    if (typeof x !== "number" || typeof y !== "number") {
      return;
    }

    const timeMs = now();
    const previous = state.cursorSamples[state.cursorSamples.length - 1];

    if (!force && previous) {
      const distance = Math.hypot(previous.x - x, previous.y - y);

      if (kind === "move" && distance < 2 && timeMs - previous.timeMs < 32) {
        window.__motionCursorOverlay?.move(x, y);
        return;
      }
    }

    state.lastPointer = { x, y };
    state.cursorSamples.push({
      kind,
      timeMs,
      x,
      y,
    });
    window.__motionCursorOverlay?.move(x, y);
  };

  const flushType = () => {
    if (!state.activeType) {
      return;
    }

    const current = state.activeType.element;
    const finalValue = getElementValue(current);
    const startValue = state.activeType.startValue;
    const text =
      typeof finalValue === "string" && finalValue.startsWith(startValue)
        ? finalValue.slice(startValue.length)
        : finalValue;

    if (text || state.activeType.submit) {
      state.actions.push({
        delayMs: state.activeType.delayMs,
        kind: "type",
        selector: state.activeType.selector,
        submit: state.activeType.submit,
        text,
        timeMs: state.activeType.timeMs,
        x: state.activeType.x,
        y: state.activeType.y,
      });
    }

    state.activeType = null;
  };

  const getCurrentPointer = () => {
    if (state.lastPointer) {
      return state.lastPointer;
    }

    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
  };

  const updateMarkerStatus = (label) => {
    window.__motionManualRecorderStatus?.(label);
  };

  const recordMarker = (kind) => {
    const pointer = getCurrentPointer();
    const label =
      kind === "follow" ? "Punch In" : kind === "wide" ? "Wide" : "Hold";

    state.markers.push({
      kind,
      timeMs: now(),
      x: pointer.x,
      y: pointer.y,
    });
    state.lastMarkerLabel = label;
    updateMarkerStatus(label);
  };

  const finish = (cancelled) => {
    if (state.finished) {
      return;
    }

    flushType();
    state.cancelled = cancelled;
    state.finished = true;
    state.finishTimeMs = now();
    window.__motionManualRecorderNotify(cancelled);
  };

  window.addEventListener("keydown", (event) => {
    if (event.altKey && event.shiftKey && event.code === "Digit0") {
      event.preventDefault();
      window.__motionManualRecorderRequestControlsFocus?.();
      return;
    }

    if (event.altKey && event.shiftKey && event.code === "KeyR") {
      event.preventDefault();
      finish(false);
      return;
    }

    if (event.altKey && event.shiftKey && event.code === "Digit1") {
      event.preventDefault();
      recordMarker("wide");
      return;
    }

    if (event.altKey && event.shiftKey && event.code === "Digit2") {
      event.preventDefault();
      recordMarker("follow");
      return;
    }

    if (event.altKey && event.shiftKey && event.code === "Digit3") {
      event.preventDefault();
      recordMarker("hold");
    }
  }, true);

  document.addEventListener("pointermove", (event) => {
    if (isInsideRecorderUi(event.target)) {
      return;
    }

    sampleCursor("move", event.clientX, event.clientY);

    if (state.activeType) {
      state.activeType.x = event.clientX;
      state.activeType.y = event.clientY;
    }
  }, true);

  document.addEventListener("focusin", (event) => {
    const target = event.target;

    if (!isEditableElement(target) || isInsideRecorderUi(target)) {
      return;
    }

    flushType();
    state.activeType = {
      delayMs: 90,
      element: target,
      selector: selectorFor(target),
      startValue: getElementValue(target),
      submit: false,
      timeMs: now(),
      x: null,
      y: null,
    };
  }, true);

  document.addEventListener("input", (event) => {
    if (!state.activeType || event.target !== state.activeType.element) {
      return;
    }

    const finalValue = getElementValue(state.activeType.element);
    const typedLength = Math.max(finalValue.length - state.activeType.startValue.length, 1);
    const durationMs = Math.max(now() - state.activeType.timeMs, 1);
    state.activeType.delayMs = Math.max(40, Math.min(180, Math.round(durationMs / typedLength)));
  }, true);

  document.addEventListener("keydown", (event) => {
    if (state.activeType && event.target === state.activeType.element && event.key === "Enter") {
      state.activeType.submit = true;
    }
  }, true);

  document.addEventListener("focusout", (event) => {
    if (state.activeType && event.target === state.activeType.element) {
      queueMicrotask(() => {
        if (state.activeType && document.activeElement !== state.activeType.element) {
          flushType();
        }
      });
    }
  }, true);

  document.addEventListener("click", (event) => {
    if (isInsideRecorderUi(event.target)) {
      return;
    }

    const selector = selectorFor(event.target);
    const timeMs = now();
    sampleCursor("click", event.clientX, event.clientY, true);
    window.__motionCursorOverlay?.click();
    state.actions.push({
      button: toMouseButton(event.button),
      kind: "click",
      selector: selector || undefined,
      timeMs,
      x: event.clientX,
      y: event.clientY,
    });
  }, true);

  document.addEventListener("wheel", (event) => {
    if (isInsideRecorderUi(event.target)) {
      return;
    }

    const selector = selectorFor(event.target);
    const timeMs = now();
    sampleCursor("wait", event.clientX, event.clientY, true);
    state.actions.push({
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      kind: "scroll",
      selector: selector || undefined,
      timeMs,
      x: event.clientX,
      y: event.clientY,
    });
  }, { capture: true, passive: true });

  window.__motionManualRecorder = {
    cancel() {
      finish(true);
    },
    export() {
      flushType();
      return {
        actions: state.actions,
        cancelled: state.cancelled,
        cursorSamples: state.cursorSamples,
        durationMs: state.finishTimeMs ?? now(),
        markers: state.markers,
      };
    },
    finish() {
      finish(false);
    },
    mark(kind) {
      recordMarker(kind);
    },
  };
})();
`;

function normalizeRecording(recording: ManualRecording): ManualRecording {
  const dedupedSamples: CursorSample[] = [];

  for (const sample of recording.cursorSamples) {
    const previous = dedupedSamples.at(-1);

    if (
      previous &&
      previous.kind === sample.kind &&
      previous.x === sample.x &&
      previous.y === sample.y &&
      Math.abs(previous.timeMs - sample.timeMs) < 8
    ) {
      continue;
    }

    dedupedSamples.push(sample);
  }

  return {
    ...recording,
    cursorSamples: dedupedSamples,
    markers: [...recording.markers].sort((left, right) => left.timeMs - right.timeMs),
  };
}

export async function installManualRecorder(
  page: Page,
  options: ManualRecorderInstallOptions = {},
): Promise<ManualRecorderControls> {
  let finishResolver: ((recording: ManualRecording) => void) | undefined;

  const finishPromise = new Promise<ManualRecording>((resolve) => {
    finishResolver = resolve;
  });

  await page.exposeFunction(
    "__motionManualRecorderNotify",
    async (cancelled: boolean) => {
      const payload = await page.evaluate(() => {
        return (
          window as Window & {
            __motionManualRecorder?: { export: () => ManualRecording };
          }
        ).__motionManualRecorder?.export();
      });

      if (!payload) {
        throw new Error("Manual recorder payload was not available.");
      }

      finishResolver?.(normalizeRecording({ ...payload, cancelled }));
    },
  );

  await page.exposeFunction(
    "__motionManualRecorderStatus",
    async (label: string) => {
      await options.onMarkerStatusChange?.(label);
    },
  );

  await page.exposeFunction(
    "__motionManualRecorderRequestControlsFocus",
    async () => {
      await options.onControlsFocusRequest?.();
    },
  );

  await page.addInitScript({ content: RECORDER_SCRIPT });
  await page.evaluate(RECORDER_SCRIPT);

  return {
    async cancel() {
      await page.evaluate(() => {
        (
          window as Window & {
            __motionManualRecorder?: { cancel: () => void };
          }
        ).__motionManualRecorder?.cancel();
      });
    },
    async finish() {
      await page.evaluate(() => {
        (
          window as Window & {
            __motionManualRecorder?: { finish: () => void };
          }
        ).__motionManualRecorder?.finish();
      });
    },
    async mark(kind) {
      await page.evaluate((markerKind) => {
        (
          window as Window & {
            __motionManualRecorder?: { mark: (kind: ManualMarkerKind) => void };
          }
        ).__motionManualRecorder?.mark(markerKind);
      }, kind);
    },
    async waitForFinish() {
      return finishPromise;
    },
  };
}
