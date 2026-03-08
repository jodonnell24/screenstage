import type { Page } from "playwright";

const CURSOR_OVERLAY_SCRIPT = `
(() => {
  if (window.__motionCursorOverlay) {
    return;
  }

  const STATE = {
    x: 0,
    y: 0,
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

      #__motion_cursor_dot {
        position: absolute;
        width: 18px;
        height: 18px;
        margin-left: -9px;
        margin-top: -9px;
        border-radius: 999px;
        background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 1), rgba(235, 235, 235, 0.98) 55%, rgba(180, 180, 180, 0.95) 100%);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.26);
        transform: translate3d(0, 0, 0);
      }

      .__motion_cursor_ripple {
        position: absolute;
        width: 22px;
        height: 22px;
        margin-left: -11px;
        margin-top: -11px;
        border-radius: 999px;
        border: 2px solid rgba(255, 255, 255, 0.9);
        opacity: 0.9;
        animation: __motion_cursor_ripple 500ms ease-out forwards;
      }

      @keyframes __motion_cursor_ripple {
        0% {
          opacity: 0.9;
          transform: scale(0.6);
        }
        100% {
          opacity: 0;
          transform: scale(2.4);
        }
      }
    \`;

    const root = document.createElement("div");
    root.id = "__motion_cursor_root";

    const dot = document.createElement("div");
    dot.id = "__motion_cursor_dot";
    root.appendChild(dot);

    document.head.appendChild(style);
    document.body.appendChild(root);

    const update = () => {
      dot.style.transform = \`translate3d(\${STATE.x}px, \${STATE.y}px, 0)\`;
    };

    window.__motionCursorOverlay = {
      click() {
        const ripple = document.createElement("div");
        ripple.className = "__motion_cursor_ripple";
        ripple.style.left = \`\${STATE.x}px\`;
        ripple.style.top = \`\${STATE.y}px\`;
        root.appendChild(ripple);
        window.setTimeout(() => ripple.remove(), 520);
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
