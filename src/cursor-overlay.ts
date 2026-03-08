import type { Page } from "playwright";

const CURSOR_OVERLAY_SCRIPT = `
(() => {
  if (window.__motionCursorOverlay) {
    return;
  }

  const STATE = {
    clickTimer: null,
    variant: "arrow",
    x: 0,
    y: 0,
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
        width: 34px;
        height: 34px;
        transform: translate3d(0, 0, 0);
        transform-origin: 0 0;
        will-change: transform;
      }

      .__motion_cursor_variant {
        position: absolute;
        left: 0;
        top: 0;
        opacity: 0;
        transition: opacity 100ms ease;
      }

      #__motion_cursor_root[data-variant="arrow"] [data-variant="arrow"],
      #__motion_cursor_root[data-variant="pointer"] [data-variant="pointer"],
      #__motion_cursor_root[data-variant="text"] [data-variant="text"] {
        opacity: 1;
      }

      .__motion_cursor_variant svg {
        overflow: visible;
        filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.3)) drop-shadow(0 10px 18px rgba(0, 0, 0, 0.12));
      }

      [data-variant="arrow"] {
        transform: translate(-2px, -2px);
      }

      [data-variant="pointer"] {
        transform: translate(-7px, -3px);
      }

      [data-variant="text"] {
        transform: translate(-8px, -14px);
      }

      #__motion_cursor_root.is-clicking #__motion_cursor_marker {
        transform: translate3d(var(--motion-x), var(--motion-y), 0) scale(0.96);
      }

      .__motion_cursor_ripple {
        position: absolute;
        width: 26px;
        height: 26px;
        margin-left: -13px;
        margin-top: -13px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.96);
        background: rgba(255, 255, 255, 0.18);
        box-shadow: 0 8px 22px rgba(0, 0, 0, 0.18);
        animation: __motion_cursor_ripple 420ms ease-out forwards;
      }

      @keyframes __motion_cursor_ripple {
        0% {
          opacity: 0.95;
          transform: scale(0.6);
        }
        100% {
          opacity: 0;
          transform: scale(2.1);
        }
      }
    \`;

    const root = document.createElement("div");
    root.id = "__motion_cursor_root";
    root.dataset.variant = "arrow";

    const marker = document.createElement("div");
    marker.id = "__motion_cursor_marker";

    marker.innerHTML = \`
      <div class="__motion_cursor_variant" data-variant="arrow" aria-hidden="true">
        <svg width="24" height="30" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.19 1.75L3.19 23.44C3.19 24.6 4.51 25.27 5.46 24.57L10.43 20.93C10.97 20.54 11.71 20.67 12.08 21.23L14.53 24.99C15.17 25.97 16.48 26.23 17.45 25.58L19.08 24.49C20.03 23.85 20.29 22.56 19.66 21.6L17.17 17.78C16.8 17.21 16.94 16.45 17.52 16.07L21.03 13.78C21.99 13.15 21.54 11.66 20.39 11.66L4.94 11.66C3.98 11.66 3.19 10.88 3.19 9.92V1.75Z" fill="white"/>
          <path d="M3.19 1.75L3.19 23.44C3.19 24.6 4.51 25.27 5.46 24.57L10.43 20.93C10.97 20.54 11.71 20.67 12.08 21.23L14.53 24.99C15.17 25.97 16.48 26.23 17.45 25.58L19.08 24.49C20.03 23.85 20.29 22.56 19.66 21.6L17.17 17.78C16.8 17.21 16.94 16.45 17.52 16.07L21.03 13.78C21.99 13.15 21.54 11.66 20.39 11.66L4.94 11.66C3.98 11.66 3.19 10.88 3.19 9.92V1.75Z" stroke="rgba(18, 24, 33, 0.9)" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
      </div>
      <div class="__motion_cursor_variant" data-variant="pointer" aria-hidden="true">
        <svg width="28" height="30" viewBox="0 0 28 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.61 14.77V8.66C8.61 5.98 10.73 3.82 13.37 3.82C16 3.82 18.11 5.98 18.11 8.66V12.72H18.64V10.54C18.64 8.47 20.27 6.8 22.31 6.8C24.34 6.8 25.97 8.47 25.97 10.54V20.15C25.97 24.76 22.33 28.5 17.84 28.5H15.4C12.9 28.5 10.56 27.35 9 25.38L4.47 19.67C3.26 18.14 3.48 15.89 4.96 14.63C6.39 13.42 8.5 13.48 9.85 14.77L8.61 14.77Z" fill="white"/>
          <path d="M8.61 14.77V8.66C8.61 5.98 10.73 3.82 13.37 3.82C16 3.82 18.11 5.98 18.11 8.66V12.72H18.64V10.54C18.64 8.47 20.27 6.8 22.31 6.8C24.34 6.8 25.97 8.47 25.97 10.54V20.15C25.97 24.76 22.33 28.5 17.84 28.5H15.4C12.9 28.5 10.56 27.35 9 25.38L4.47 19.67C3.26 18.14 3.48 15.89 4.96 14.63C6.39 13.42 8.5 13.48 9.85 14.77H8.61ZM13.37 5.32C11.56 5.32 10.11 6.8 10.11 8.66V18.07L8.48 16.41C7.67 15.59 6.38 15.55 5.93 15.94C5.07 16.67 4.94 17.96 5.63 18.84L10.17 24.55C11.45 26.17 13.37 27 15.4 27H17.84C21.5 27 24.47 23.96 24.47 20.15V10.54C24.47 9.28 23.49 8.3 22.31 8.3C21.12 8.3 20.14 9.28 20.14 10.54V17.51H18.64V8.66C18.64 6.8 17.18 5.32 15.4 5.32V17.51H13.9V5.32H13.37Z" fill="rgba(18, 24, 33, 0.92)"/>
        </svg>
      </div>
      <div class="__motion_cursor_variant" data-variant="text" aria-hidden="true">
        <svg width="18" height="30" viewBox="0 0 18 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 2H16" stroke="white" stroke-width="4" stroke-linecap="round"/>
          <path d="M2 28H16" stroke="white" stroke-width="4" stroke-linecap="round"/>
          <path d="M9 3.5V26.5" stroke="white" stroke-width="4.5" stroke-linecap="round"/>
          <path d="M2 2H16" stroke="rgba(18, 24, 33, 0.92)" stroke-width="2" stroke-linecap="round"/>
          <path d="M2 28H16" stroke="rgba(18, 24, 33, 0.92)" stroke-width="2" stroke-linecap="round"/>
          <path d="M9 3.5V26.5" stroke="rgba(18, 24, 33, 0.92)" stroke-width="2.4" stroke-linecap="round"/>
        </svg>
      </div>
    \`;

    root.appendChild(marker);
    document.head.appendChild(style);
    document.body.appendChild(root);

    const update = () => {
      const variant = detectVariant(STATE.x, STATE.y);
      STATE.variant = variant;
      root.dataset.variant = variant;
      root.style.setProperty("--motion-x", \`\${STATE.x}px\`);
      root.style.setProperty("--motion-y", \`\${STATE.y}px\`);
      marker.style.transform = \`translate3d(\${STATE.x}px, \${STATE.y}px, 0)\`;
    };

    window.__motionCursorOverlay = {
      click() {
        root.classList.add("is-clicking");
        if (STATE.clickTimer) {
          window.clearTimeout(STATE.clickTimer);
        }

        const ripple = document.createElement("div");
        ripple.className = "__motion_cursor_ripple";
        ripple.style.left = \`\${STATE.x}px\`;
        ripple.style.top = \`\${STATE.y}px\`;
        root.appendChild(ripple);
        window.setTimeout(() => ripple.remove(), 430);

        STATE.clickTimer = window.setTimeout(() => {
          root.classList.remove("is-clicking");
          STATE.clickTimer = null;
        }, 130);
      },
      move(x, y) {
        STATE.x = x;
        STATE.y = y;
        update();
      },
    };

    update();
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
