import type { Page } from "playwright";

const CURSOR_OVERLAY_SCRIPT = `
(() => {
  if (window.__motionCursorOverlay) {
    return;
  }

  const STATE = {
    clickTimer: null,
    rafId: null,
    renderX: 0,
    renderY: 0,
    targetVariant: "arrow",
    targetX: 0,
    targetY: 0,
    x: 0,
    y: 0,
  };

  const ARROW_SVG = \`
    <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4.5 2.5V23.1C4.5 24.12 5.68 24.7 6.48 24.08L11.82 19.96C12.28 19.61 12.92 19.73 13.23 20.23L15.86 24.48C16.43 25.4 17.64 25.7 18.57 25.15L19.92 24.36C20.84 23.81 21.15 22.62 20.62 21.69L17.94 17.04C17.63 16.49 17.82 15.8 18.36 15.48L22.95 12.74C23.92 12.16 23.51 10.67 22.38 10.67H10.3C9.31 10.67 8.5 9.86 8.5 8.87V2.5H4.5Z" fill="white"/>
      <path d="M4.5 2.5V23.1C4.5 24.12 5.68 24.7 6.48 24.08L11.82 19.96C12.28 19.61 12.92 19.73 13.23 20.23L15.86 24.48C16.43 25.4 17.64 25.7 18.57 25.15L19.92 24.36C20.84 23.81 21.15 22.62 20.62 21.69L17.94 17.04C17.63 16.49 17.82 15.8 18.36 15.48L22.95 12.74C23.92 12.16 23.51 10.67 22.38 10.67H10.3C9.31 10.67 8.5 9.86 8.5 8.87V2.5H4.5Z" stroke="rgba(23, 27, 35, 0.95)" stroke-width="1.7" stroke-linejoin="round"/>
    </svg>
  \`;

  const POINTER_SVG = \`
    <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M11.17 13.8V8.52C11.17 6.26 12.94 4.42 15.12 4.42C17.3 4.42 19.05 6.26 19.05 8.52V11.95H19.64V10.11C19.64 8.34 21.03 6.92 22.76 6.92C24.49 6.92 25.88 8.34 25.88 10.11V20.64C25.88 24.76 22.65 28.1 18.68 28.1H16.58C14.45 28.1 12.44 27.11 11.1 25.41L6.81 20C5.77 18.69 5.96 16.74 7.24 15.64C8.47 14.59 10.29 14.64 11.46 15.74L11.17 13.8Z" fill="white"/>
      <path d="M11.17 13.8V8.52C11.17 6.26 12.94 4.42 15.12 4.42C17.3 4.42 19.05 6.26 19.05 8.52V11.95H19.64V10.11C19.64 8.34 21.03 6.92 22.76 6.92C24.49 6.92 25.88 8.34 25.88 10.11V20.64C25.88 24.76 22.65 28.1 18.68 28.1H16.58C14.45 28.1 12.44 27.11 11.1 25.41L6.81 20C5.77 18.69 5.96 16.74 7.24 15.64C8.47 14.59 10.29 14.64 11.46 15.74L11.17 13.8Z" stroke="rgba(23, 27, 35, 0.95)" stroke-width="1.7" stroke-linejoin="round"/>
      <path d="M15.12 8.55V18.64M19.05 12.05V18.64M22.87 10.11V18.64" stroke="rgba(23, 27, 35, 0.95)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  \`;

  const TEXT_SVG = \`
    <svg width="20" height="30" viewBox="0 0 20 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 2.5H17M3 27.5H17M10 4.6V25.4" stroke="white" stroke-width="5" stroke-linecap="round"/>
      <path d="M3 2.5H17M3 27.5H17M10 4.6V25.4" stroke="rgba(23, 27, 35, 0.95)" stroke-width="2.2" stroke-linecap="round"/>
    </svg>
  \`;

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

  const isInteractiveElement = (element) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    return Boolean(
      element.closest(
        "a, button, summary, label, select, option, [role='button'], [role='link'], [onclick], [data-motion-cursor='pointer']",
      ),
    );
  };

  const detectVariant = (x, y) => {
    const element = document.elementFromPoint(x, y);

    if (isEditableElement(element)) {
      return "text";
    }

    if (isInteractiveElement(element)) {
      return "pointer";
    }

    return "arrow";
  };

  const ensureRoot = () => {
    if (!document.body) {
      requestAnimationFrame(ensureRoot);
      return;
    }

    if (document.getElementById("__motion_cursor_root")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "__motion_cursor_style";
    style.textContent = \`
      html, body, * {
        cursor: none !important;
      }

      #__motion_cursor_root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483647;
      }

      #__motion_cursor_marker {
        position: absolute;
        left: 0;
        top: 0;
        width: 40px;
        height: 40px;
        transform: translate3d(0, 0, 0);
        transform-origin: 0 0;
        will-change: transform;
      }

      #__motion_cursor_art {
        position: absolute;
        left: 0;
        top: 0;
        width: 40px;
        height: 40px;
        transform-origin: 0 0;
        transition: transform 110ms cubic-bezier(0.22, 1, 0.36, 1);
      }

      .__motion_cursor_variant {
        position: absolute;
        left: 0;
        top: 0;
        opacity: 0;
        transition: opacity 90ms linear;
      }

      #__motion_cursor_root[data-variant="arrow"] [data-variant="arrow"],
      #__motion_cursor_root[data-variant="pointer"] [data-variant="pointer"],
      #__motion_cursor_root[data-variant="text"] [data-variant="text"] {
        opacity: 1;
      }

      .__motion_cursor_variant svg {
        overflow: visible;
        filter: drop-shadow(0 1.5px 2px rgba(0, 0, 0, 0.22)) drop-shadow(0 8px 18px rgba(0, 0, 0, 0.14));
      }

      [data-variant="arrow"] {
        transform: translate(-2px, -2px);
      }

      [data-variant="pointer"] {
        transform: translate(-7px, -4px);
      }

      [data-variant="text"] {
        transform: translate(-9px, -15px);
      }

      #__motion_cursor_root.is-clicking #__motion_cursor_art {
        transform: scale(0.94);
      }

      .__motion_cursor_ripple {
        position: absolute;
        width: 24px;
        height: 24px;
        margin-left: -12px;
        margin-top: -12px;
        border-radius: 999px;
        border: 1.8px solid rgba(255, 255, 255, 0.94);
        background: rgba(255, 255, 255, 0.14);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.12);
        animation: __motion_cursor_ripple 360ms ease-out forwards;
      }

      @keyframes __motion_cursor_ripple {
        0% {
          opacity: 0.9;
          transform: scale(0.7);
        }
        100% {
          opacity: 0;
          transform: scale(1.95);
        }
      }
    \`;

    const root = document.createElement("div");
    root.id = "__motion_cursor_root";
    root.dataset.variant = "arrow";

    const marker = document.createElement("div");
    marker.id = "__motion_cursor_marker";

    const art = document.createElement("div");
    art.id = "__motion_cursor_art";
    art.innerHTML = \`
      <div class="__motion_cursor_variant" data-variant="arrow">\${ARROW_SVG}</div>
      <div class="__motion_cursor_variant" data-variant="pointer">\${POINTER_SVG}</div>
      <div class="__motion_cursor_variant" data-variant="text">\${TEXT_SVG}</div>
    \`;

    marker.appendChild(art);
    root.appendChild(marker);
    document.head.appendChild(style);
    document.body.appendChild(root);

    const render = () => {
      const dx = STATE.targetX - STATE.renderX;
      const dy = STATE.targetY - STATE.renderY;
      const distance = Math.hypot(dx, dy);

      STATE.renderX += dx * 0.34;
      STATE.renderY += dy * 0.34;

      if (distance < 0.15) {
        STATE.renderX = STATE.targetX;
        STATE.renderY = STATE.targetY;
      }

      root.dataset.variant = STATE.targetVariant;
      marker.style.transform = \`translate3d(\${STATE.renderX}px, \${STATE.renderY}px, 0)\`;

      if (distance >= 0.15) {
        STATE.rafId = requestAnimationFrame(render);
      } else {
        STATE.rafId = null;
      }
    };

    const scheduleRender = () => {
      if (STATE.rafId !== null) {
        return;
      }

      STATE.rafId = requestAnimationFrame(render);
    };

    window.__motionCursorOverlay = {
      click() {
        root.classList.add("is-clicking");
        if (STATE.clickTimer) {
          window.clearTimeout(STATE.clickTimer);
        }

        const ripple = document.createElement("div");
        ripple.className = "__motion_cursor_ripple";
        ripple.style.left = \`\${STATE.renderX}px\`;
        ripple.style.top = \`\${STATE.renderY}px\`;
        root.appendChild(ripple);
        window.setTimeout(() => ripple.remove(), 380);

        STATE.clickTimer = window.setTimeout(() => {
          root.classList.remove("is-clicking");
          STATE.clickTimer = null;
        }, 110);

        scheduleRender();
      },
      move(x, y) {
        STATE.x = x;
        STATE.y = y;
        STATE.targetX = x;
        STATE.targetY = y;
        STATE.targetVariant = detectVariant(x, y);
        scheduleRender();
      },
    };

    STATE.targetX = 0;
    STATE.targetY = 0;
    STATE.renderX = 0;
    STATE.renderY = 0;
    scheduleRender();
  };

  ensureRoot();
})();
`;

export async function installCursorOverlay(page: Page): Promise<void> {
  await page.addInitScript({ content: CURSOR_OVERLAY_SCRIPT });
  await page.evaluate(CURSOR_OVERLAY_SCRIPT);
}

export async function moveCursorOverlay(
  page: Page,
  x: number,
  y: number,
): Promise<void> {
  await page.evaluate(
    ({ nextX, nextY }) => {
      (
        window as Window & {
          __motionCursorOverlay?: { move: (x: number, y: number) => void };
        }
      ).__motionCursorOverlay?.move(nextX, nextY);
    },
    { nextX: x, nextY: y },
  );
}

export async function clickCursorOverlay(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as Window & {
        __motionCursorOverlay?: { click: () => void };
      }
    ).__motionCursorOverlay?.click();
  });
}
