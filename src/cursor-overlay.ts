import type { EvaluatedPageTarget } from "./types.js";

type CursorOverlayInstallOptions = {
  hideSelectors?: string[];
};

function buildCursorOverlayScript(
  options: CursorOverlayInstallOptions = {},
): string {
  const hideSelectors = options.hideSelectors ?? [];
  const hideSelectorsRule =
    hideSelectors.length > 0
      ? `

      ${hideSelectors.join(",\n      ")} {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }
      `
      : "";

  return `
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

  // Source shapes: UXWing cursor icon set. The geometry below is from the original SVGs;
  // only size, fill, stroke, and drop shadow are adjusted here for recording readability.
  const ARROW_SVG = \`
    <svg width="26" height="34" viewBox="0 0 96.09 122.88" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M61.61 122.31c-1.34.62-2.82.72-4.15.37-1.46-.39-2.75-1.31-3.55-2.67L39.03 94.36 24.88 110.24c-1.97 2.21-4.21 3.88-6.37 4.75-1.66.67-3.31.88-4.84.56-1.69-.36-3.14-1.33-4.2-3.01-.84-1.33-1.4-3.11-1.57-5.39L0.01 4.41V4.18c-.01-.64.11-1.27.37-1.84.29-.66.76-1.26 1.37-1.7.25-.2.53-.33.83-.41.59-.2 1.2-.27 1.79-.2.57.06 1.13.23 1.64.52.17.08.34.18.49.3l84.88 58.11c1.88 1.29 3.14 2.66 3.88 4.05.93 1.75 1.04 3.49.5 5.14-.48 1.49-1.5 2.81-2.9 3.91-1.82 1.43-4.39 2.54-7.3 3.14l-.1.02-20.73 4.29 14.77 25.73c.78 1.36.93 2.94.54 4.39-.38 1.41-1.27 2.71-2.59 3.56l-.17.1-15.34 8.86-.33.16ZM58.84 117.48c.15.04.3.04.44-.01l.16-.08 15.14-8.74c.14-.1.23-.25.28-.41.03-.13.03-.25-.01-.33L58.23 78.97l.01-.01c-.14-.24-.24-.51-.3-.8-.3-1.45.64-2.87 2.09-3.17l24.36-5.04.1-.02c2.1-.44 3.88-1.18 5.07-2.11.58-.46.97-.91 1.11-1.35.09-.27.05-.6-.15-.97-.34-.64-1.03-1.34-2.15-2.11L5.58 6.74l7.69 100.02c.1 1.36.37 2.32.75 2.92.22.35.49.55.77.61.45.1 1.04-.01 1.72-.28 1.39-.56 2.92-1.73 4.35-3.34l16.62-18.65c.19-.21.41-.39.66-.54 1.28-.74 2.93-.31 3.67.98l16.75 28.85c.06.1.15.16.28.19Z" fill="white"/>
      <path d="M61.61 122.31c-1.34.62-2.82.72-4.15.37-1.46-.39-2.75-1.31-3.55-2.67L39.03 94.36 24.88 110.24c-1.97 2.21-4.21 3.88-6.37 4.75-1.66.67-3.31.88-4.84.56-1.69-.36-3.14-1.33-4.2-3.01-.84-1.33-1.4-3.11-1.57-5.39L0.01 4.41V4.18c-.01-.64.11-1.27.37-1.84.29-.66.76-1.26 1.37-1.7.25-.2.53-.33.83-.41.59-.2 1.2-.27 1.79-.2.57.06 1.13.23 1.64.52.17.08.34.18.49.3l84.88 58.11c1.88 1.29 3.14 2.66 3.88 4.05.93 1.75 1.04 3.49.5 5.14-.48 1.49-1.5 2.81-2.9 3.91-1.82 1.43-4.39 2.54-7.3 3.14l-.1.02-20.73 4.29 14.77 25.73c.78 1.36.93 2.94.54 4.39-.38 1.41-1.27 2.71-2.59 3.56l-.17.1-15.34 8.86-.33.16ZM58.84 117.48c.15.04.3.04.44-.01l.16-.08 15.14-8.74c.14-.1.23-.25.28-.41.03-.13.03-.25-.01-.33L58.23 78.97l.01-.01c-.14-.24-.24-.51-.3-.8-.3-1.45.64-2.87 2.09-3.17l24.36-5.04.1-.02c2.1-.44 3.88-1.18 5.07-2.11.58-.46.97-.91 1.11-1.35.09-.27.05-.6-.15-.97-.34-.64-1.03-1.34-2.15-2.11L5.58 6.74l7.69 100.02c.1 1.36.37 2.32.75 2.92.22.35.49.55.77.61.45.1 1.04-.01 1.72-.28 1.39-.56 2.92-1.73 4.35-3.34l16.62-18.65c.19-.21.41-.39.66-.54 1.28-.74 2.93-.31 3.67.98l16.75 28.85c.06.1.15.16.28.19Z" stroke="rgba(23, 27, 35, 0.95)" stroke-width="6.4" stroke-linejoin="round"/>
    </svg>
  \`;

  const POINTER_SVG = \`
    <svg width="28" height="34" viewBox="0 0 106.17 122.88" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M29.96 67.49c-.16-.09-.32-.19-.47-.31-1.95-1.56-4.08-3.29-5.94-4.81-2.69-2.2-5.8-4.76-7.97-6.55-1.49-1.23-3.17-2.07-4.75-2.39-1.02-.2-1.95-.18-2.67.12-.59.24-1.1.72-1.45 1.48-.45.99-.66 2.41-.54 4.32.11 1.69.7 3.55 1.48 5.33 1.16 2.63 2.73 5.04 3.89 6.59.07.09.13.19.19.29l23.32 33.31c.3.43.47.91.53 1.4h.01c.46 3.85 1.28 6.73 2.49 8.54.88 1.31 2.01 1.98 3.42 1.94h.07v-.01h36.38c.09 0 .17 0 .26.01 2.28-.03 4.36-.71 6.25-2.02 2.09-1.44 3.99-3.68 5.72-6.7l.1-.16c.67-1.15 1.55-2.6 2.41-4.02 3.72-6.13 6.96-11.45 7.35-19.04l-.24-10.77a3.3 3.3 0 0 1-.03-.45l.03-2.46c.09-6.92.19-15.48-6.14-16.56h-4.05l-.04-.01c-.02 1.95-.15 3.93-.27 5.86-.11 1.71-.21 3.37-.21 4.95 0 1.7-1.38 3.08-3.08 3.08-1.7 0-3.08-1.38-3.08-3.08 0-1.58.12-3.42.24-5.33.41-6.51.89-13.99-4.33-14.93H74.8c-.23 0-.45-.02-.66-.07.04 2.36-.12 4.81-.27 7.16-.11 1.71-.21 3.37-.21 4.95 0 1.7-1.38 3.08-3.08 3.08-1.7 0-3.08-1.38-3.08-3.08 0-1.58.12-3.42.24-5.33.41-6.51.89-13.99-4.33-14.93h-4.05c-.28 0-.55-.04-.8-.11V49c0 1.7-1.38 3.08-3.08 3.08-1.7 0-3.08-1.38-3.08-3.08V17.05c0-5.35-2.18-8.73-4.97-10.14-1.02-.52-2.12-.78-3.21-.78-1.08 0-2.18.26-3.19.77-2.76 1.4-4.92 4.79-4.92 10.28v56c0 1.7-1.38 3.08-3.08 3.08-1.7 0-3.08-1.38-3.08-3.08v-5.69ZM58.57 31.15c.26-.07.53-.11.8-.11h4.24c.24 0 .47.03.69.08 5.65.88 8.17 4.18 9.2 8.43.39-.18.83-.29 1.3-.29h4.24c.24 0 .47.03.69.08 6.08.94 8.53 4.69 9.41 9.41.15-.02.31-.04.47-.04h4.24c.24 0 .47.03.69.08 11.64 1.8 11.5 13.37 11.38 22.71l-.01 2.35v.07l.24 10.77c.01.11.01.23 0 .34-.45 9.16-4.07 15.12-8.24 21.98-.7 1.14-1.41 2.32-2.34 3.93l-.07.13c-2.18 3.8-4.7 6.71-7.57 8.69-2.92 2.02-6.16 3.06-9.71 3.1-.09.01-.19.01-.28.01H41.58v-.01c-3.66.07-6.5-1.53-8.59-4.66-1.68-2.51-2.79-6.03-3.4-10.47L6.73 75.07l-.1-.12c-1.36-1.82-3.21-4.65-4.59-7.79C1 64.8.21 62.24.05 59.74c-.2-2.97.22-5.36 1.06-7.23 1.05-2.32 2.72-3.83 4.74-4.66 1.89-.77 4.01-.88 6.16-.45 2.57.51 5.22 1.81 7.49 3.68 1.86 1.54 4.95 4.07 7.95 6.52l2.52 2.06V17.18c0-8.14 3.63-13.39 8.28-15.76C40.12.47 42.17 0 44.23 0c2.05 0 4.1.48 5.98 1.43 4.69 2.37 8.36 7.62 8.36 15.62v14.1Z" fill="white"/>
      <path d="M29.96 67.49c-.16-.09-.32-.19-.47-.31-1.95-1.56-4.08-3.29-5.94-4.81-2.69-2.2-5.8-4.76-7.97-6.55-1.49-1.23-3.17-2.07-4.75-2.39-1.02-.2-1.95-.18-2.67.12-.59.24-1.1.72-1.45 1.48-.45.99-.66 2.41-.54 4.32.11 1.69.7 3.55 1.48 5.33 1.16 2.63 2.73 5.04 3.89 6.59.07.09.13.19.19.29l23.32 33.31c.3.43.47.91.53 1.4h.01c.46 3.85 1.28 6.73 2.49 8.54.88 1.31 2.01 1.98 3.42 1.94h.07v-.01h36.38c.09 0 .17 0 .26.01 2.28-.03 4.36-.71 6.25-2.02 2.09-1.44 3.99-3.68 5.72-6.7l.1-.16c.67-1.15 1.55-2.6 2.41-4.02 3.72-6.13 6.96-11.45 7.35-19.04l-.24-10.77a3.3 3.3 0 0 1-.03-.45l.03-2.46c.09-6.92.19-15.48-6.14-16.56h-4.05l-.04-.01c-.02 1.95-.15 3.93-.27 5.86-.11 1.71-.21 3.37-.21 4.95 0 1.7-1.38 3.08-3.08 3.08-1.7 0-3.08-1.38-3.08-3.08 0-1.58.12-3.42.24-5.33.41-6.51.89-13.99-4.33-14.93H74.8c-.23 0-.45-.02-.66-.07.04 2.36-.12 4.81-.27 7.16-.11 1.71-.21 3.37-.21 4.95 0 1.7-1.38 3.08-3.08 3.08-1.7 0-3.08-1.38-3.08-3.08 0-1.58.12-3.42.24-5.33.41-6.51.89-13.99-4.33-14.93h-4.05c-.28 0-.55-.04-.8-.11V49c0 1.7-1.38 3.08-3.08 3.08-1.7 0-3.08-1.38-3.08-3.08V17.05c0-5.35-2.18-8.73-4.97-10.14-1.02-.52-2.12-.78-3.21-.78-1.08 0-2.18.26-3.19.77-2.76 1.4-4.92 4.79-4.92 10.28v56c0 1.7-1.38 3.08-3.08 3.08-1.7 0-3.08-1.38-3.08-3.08v-5.69ZM58.57 31.15c.26-.07.53-.11.8-.11h4.24c.24 0 .47.03.69.08 5.65.88 8.17 4.18 9.2 8.43.39-.18.83-.29 1.3-.29h4.24c.24 0 .47.03.69.08 6.08.94 8.53 4.69 9.41 9.41.15-.02.31-.04.47-.04h4.24c.24 0 .47.03.69.08 11.64 1.8 11.5 13.37 11.38 22.71l-.01 2.35v.07l.24 10.77c.01.11.01.23 0 .34-.45 9.16-4.07 15.12-8.24 21.98-.7 1.14-1.41 2.32-2.34 3.93l-.07.13c-2.18 3.8-4.7 6.71-7.57 8.69-2.92 2.02-6.16 3.06-9.71 3.1-.09.01-.19.01-.28.01H41.58v-.01c-3.66.07-6.5-1.53-8.59-4.66-1.68-2.51-2.79-6.03-3.4-10.47L6.73 75.07l-.1-.12c-1.36-1.82-3.21-4.65-4.59-7.79C1 64.8.21 62.24.05 59.74c-.2-2.97.22-5.36 1.06-7.23 1.05-2.32 2.72-3.83 4.74-4.66 1.89-.77 4.01-.88 6.16-.45 2.57.51 5.22 1.81 7.49 3.68 1.86 1.54 4.95 4.07 7.95 6.52l2.52 2.06V17.18c0-8.14 3.63-13.39 8.28-15.76C40.12.47 42.17 0 44.23 0c2.05 0 4.1.48 5.98 1.43 4.69 2.37 8.36 7.62 8.36 15.62v14.1Z" stroke="rgba(23, 27, 35, 0.95)" stroke-width="5.6" stroke-linejoin="round"/>
    </svg>
  \`;

  const TEXT_SVG = \`
    <svg width="16" height="32" viewBox="0 0 43.84 122.88" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3.28 64.8C1.47 64.8 0 63.33 0 61.52c0-1.81 1.47-3.28 3.28-3.28h15.24V21.51c-.47-4.53-1.86-7.89-3.98-10.26-2.3-2.58-5.57-4.09-9.53-4.74-1.78-.29-2.99-1.97-2.7-3.76.29-1.78 1.97-2.99 3.76-2.7 5.41.89 9.98 3.07 13.34 6.84.86.96 1.63 2.02 2.31 3.17.86-1.49 1.88-2.8 3.05-3.96C28.28 2.62 32.98.72 38.59.02c1.8-.22 3.43 1.06 3.65 2.86.22 1.8-1.06 3.43-2.86 3.65-4.2.52-7.61 1.84-10 4.21-2.37 2.35-3.87 5.85-4.3 10.78v36.71h15.48c1.81 0 3.28 1.47 3.28 3.28 0 1.81-1.47 3.28-3.28 3.28H25.08v36.56c.43 4.93 1.93 8.44 4.3 10.78 2.39 2.36 5.8 3.69 10 4.21 1.8.22 3.08 1.86 2.86 3.65-.22 1.8-1.85 3.08-3.65 2.86-5.61-.7-10.31-2.6-13.82-6.08-1.17-1.16-2.19-2.47-3.05-3.96-.68 1.16-1.45 2.21-2.31 3.17-3.37 3.77-7.94 5.95-13.34 6.84-1.78.29-3.46-.92-3.76-2.7-.29-1.78.92-3.46 2.7-3.76 3.96-.65 7.23-2.16 9.53-4.74 2.12-2.37 3.51-5.74 3.98-10.26V64.8H3.28Z" fill="white"/>
      <path d="M3.28 64.8C1.47 64.8 0 63.33 0 61.52c0-1.81 1.47-3.28 3.28-3.28h15.24V21.51c-.47-4.53-1.86-7.89-3.98-10.26-2.3-2.58-5.57-4.09-9.53-4.74-1.78-.29-2.99-1.97-2.7-3.76.29-1.78 1.97-2.99 3.76-2.7 5.41.89 9.98 3.07 13.34 6.84.86.96 1.63 2.02 2.31 3.17.86-1.49 1.88-2.8 3.05-3.96C28.28 2.62 32.98.72 38.59.02c1.8-.22 3.43 1.06 3.65 2.86.22 1.8-1.06 3.43-2.86 3.65-4.2.52-7.61 1.84-10 4.21-2.37 2.35-3.87 5.85-4.3 10.78v36.71h15.48c1.81 0 3.28 1.47 3.28 3.28 0 1.81-1.47 3.28-3.28 3.28H25.08v36.56c.43 4.93 1.93 8.44 4.3 10.78 2.39 2.36 5.8 3.69 10 4.21 1.8.22 3.08 1.86 2.86 3.65-.22 1.8-1.85 3.08-3.65 2.86-5.61-.7-10.31-2.6-13.82-6.08-1.17-1.16-2.19-2.47-3.05-3.96-.68 1.16-1.45 2.21-2.31 3.17-3.37 3.77-7.94 5.95-13.34 6.84-1.78.29-3.46-.92-3.76-2.7-.29-1.78.92-3.46 2.7-3.76 3.96-.65 7.23-2.16 9.53-4.74 2.12-2.37 3.51-5.74 3.98-10.26V64.8H3.28Z" stroke="rgba(23, 27, 35, 0.95)" stroke-width="5.2" stroke-linejoin="round"/>
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
${hideSelectorsRule}

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
        transform: translate(-3px, -2px);
      }

      [data-variant="pointer"] {
        transform: translate(-9px, -4px);
      }

      [data-variant="text"] {
        transform: translate(-8px, -16px);
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
}

export async function installCursorOverlay(
  target: EvaluatedPageTarget,
  options: CursorOverlayInstallOptions = {},
): Promise<void> {
  const script = buildCursorOverlayScript(options);

  if ("addInitScript" in target) {
    await target.addInitScript({ content: script });
  }

  await target.evaluate(script);
}

export async function moveCursorOverlay(
  target: EvaluatedPageTarget,
  x: number,
  y: number,
): Promise<void> {
  await target.evaluate(
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

export async function clickCursorOverlay(target: EvaluatedPageTarget): Promise<void> {
  await target.evaluate(() => {
    (
      window as Window & {
        __motionCursorOverlay?: { click: () => void };
      }
    ).__motionCursorOverlay?.click();
  });
}
