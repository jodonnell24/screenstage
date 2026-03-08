import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CompositionLayout, LoadedMotionConfig } from "./types.js";

const execFileAsync = promisify(execFile);

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function degreesToGradientPoint(angle: number): {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
} {
  const radians = (angle * Math.PI) / 180;
  const x = Math.cos(radians) * 50;
  const y = Math.sin(radians) * 50;

  return {
    x1: 50 - x,
    x2: 50 + x,
    y1: 50 - y,
    y2: 50 + y,
  };
}

function fitBrowserWindow(config: LoadedMotionConfig): CompositionLayout {
  const outputWidth = config.output.width;
  const outputHeight = config.output.height;
  const hasCaption =
    typeof config.composition.caption.title === "string" ||
    typeof config.composition.caption.eyebrow === "string";

  if (config.composition.preset === "none") {
    return {
      contentHeight: outputHeight,
      contentWidth: outputWidth,
      contentX: 0,
      contentY: 0,
      enabled: false,
      outputHeight,
      outputWidth,
      preset: "none",
    };
  }

  const padding = config.composition.browser.padding;
  const toolbarHeight = config.composition.browser.toolbarHeight;
  const captionReserve =
    hasCaption && config.composition.caption.align === "top-left"
      ? 140
      : 0;
  const bottomCaptionReserve =
    hasCaption && config.composition.caption.align === "bottom-left"
      ? 140
      : 0;
  const availableWidth = outputWidth - padding * 2;
  const availableHeight =
    outputHeight - padding * 2 - captionReserve - bottomCaptionReserve;
  const sourceAspect = config.viewport.width / config.viewport.height;

  let windowWidth = availableWidth;
  let contentHeight = windowWidth / sourceAspect;
  let windowHeight = contentHeight + toolbarHeight;

  if (windowHeight > availableHeight) {
    windowHeight = availableHeight;
    contentHeight = windowHeight - toolbarHeight;
    windowWidth = contentHeight * sourceAspect;
  }

  const contentWidth = windowWidth;
  const windowX = (outputWidth - windowWidth) / 2;
  const windowY =
    captionReserve +
    (outputHeight - captionReserve - bottomCaptionReserve - windowHeight) / 2;

  return {
    contentHeight: Math.round(contentHeight),
    contentWidth: Math.round(contentWidth),
    contentX: Math.round(windowX),
    contentY: Math.round(windowY + toolbarHeight),
    enabled: true,
    outputHeight,
    outputWidth,
    preset: config.composition.preset,
    windowHeight: Math.round(windowHeight),
    windowWidth: Math.round(windowWidth),
    windowX: Math.round(windowX),
    windowY: Math.round(windowY),
  };
}

function getPresetColors(config: LoadedMotionConfig): string[] {
  if (config.composition.background.colors.length > 0) {
    return config.composition.background.colors;
  }

  if (config.composition.preset === "spotlight-browser") {
    return ["#151d24", "#243748", "#dfd5c5"];
  }

  return ["#eef4ef", "#e7edf5"];
}

function buildContentHolePath(layout: CompositionLayout, radius: number): string {
  const x = layout.contentX;
  const y = layout.contentY;
  const width = layout.contentWidth;
  const height = layout.contentHeight;
  const safeRadius = Math.min(radius, width / 2, height / 2);

  return [
    `M ${formatNumber(x)} ${formatNumber(y)}`,
    `L ${formatNumber(x + width)} ${formatNumber(y)}`,
    `L ${formatNumber(x + width)} ${formatNumber(y + height - safeRadius)}`,
    `A ${formatNumber(safeRadius)} ${formatNumber(safeRadius)} 0 0 1 ${formatNumber(x + width - safeRadius)} ${formatNumber(y + height)}`,
    `H ${formatNumber(x + safeRadius)}`,
    `A ${formatNumber(safeRadius)} ${formatNumber(safeRadius)} 0 0 1 ${formatNumber(x)} ${formatNumber(y + height - safeRadius)}`,
    "Z",
  ].join(" ");
}

function buildCaptionMarkup(config: LoadedMotionConfig, layout: CompositionLayout): string {
  const title = config.composition.caption.title?.trim();
  const eyebrow = config.composition.caption.eyebrow?.trim();

  if (!title && !eyebrow) {
    return "";
  }

  const isSpotlight = config.composition.preset === "spotlight-browser";
  const panelWidth = Math.min(Math.max(layout.outputWidth * 0.24, 320), 460);
  const eyebrowHeight = eyebrow ? 22 : 0;
  const titleHeight = title ? 44 : 0;
  const panelHeight = 44 + eyebrowHeight + titleHeight;
  const margin = Math.max(config.composition.browser.padding, 56);
  const x = margin;
  const y =
    config.composition.caption.align === "bottom-left"
      ? layout.outputHeight - panelHeight - margin
      : margin;
  const panelFill = isSpotlight ? "#10202d" : "#ffffff";
  const panelFillOpacity = isSpotlight ? "0.84" : "0.82";
  const textFill = isSpotlight ? "#f7fbff" : "#182126";
  const textMuted = isSpotlight ? "#96adbf" : "#5f6a6f";
  const accentFill = isSpotlight ? "#7be0c6" : "#1f8f72";

  return `
    <g filter="url(#shadow)">
      <rect
        x="${formatNumber(x)}"
        y="${formatNumber(y)}"
        width="${formatNumber(panelWidth)}"
        height="${formatNumber(panelHeight)}"
        rx="24"
        fill="${panelFill}"
        fill-opacity="${panelFillOpacity}"
      />
      ${
        eyebrow
          ? `
      <text
        x="${formatNumber(x + 28)}"
        y="${formatNumber(y + 34)}"
        fill="${accentFill}"
        font-family="DejaVu Sans, Arial, sans-serif"
        font-size="14"
        font-weight="700"
        letter-spacing="1.8"
      >${escapeXml(eyebrow.toUpperCase())}</text>
      `
          : ""
      }
      ${
        title
          ? `
      <text
        x="${formatNumber(x + 28)}"
        y="${formatNumber(y + (eyebrow ? 74 : 56))}"
        fill="${textFill}"
        font-family="DejaVu Sans, Arial, sans-serif"
        font-size="32"
        font-weight="700"
      >${escapeXml(title)}</text>
      `
          : ""
      }
      <text
        x="${formatNumber(x + panelWidth - 28)}"
        y="${formatNumber(y + panelHeight - 20)}"
        fill="${textMuted}"
        font-family="DejaVu Sans, Arial, sans-serif"
        font-size="12"
        font-weight="600"
        text-anchor="end"
      >motion-creator</text>
    </g>
  `;
}

function buildCompositionSvg(
  config: LoadedMotionConfig,
  layout: CompositionLayout,
): string {
  const colors = getPresetColors(config).map(escapeXml);
  const angle = config.composition.background.angle;
  const gradient = degreesToGradientPoint(angle);
  const radius = config.composition.browser.radius;
  const toolbarHeight = config.composition.browser.toolbarHeight;
  const windowX = layout.windowX!;
  const windowY = layout.windowY!;
  const windowWidth = layout.windowWidth!;
  const windowHeight = layout.windowHeight!;
  const holePath = buildContentHolePath(layout, radius);
  const captionMarkup = buildCaptionMarkup(config, layout);
  const addressBarWidth = windowWidth * 0.38;
  const addressBarHeight = Math.max(18, toolbarHeight * 0.34);
  const addressBarX = windowX + (windowWidth - addressBarWidth) / 2;
  const addressBarY = windowY + (toolbarHeight - addressBarHeight) / 2;

  const backgroundStops =
    colors.length === 1
      ? `<stop offset="0%" stop-color="${colors[0]}"/><stop offset="100%" stop-color="${colors[0]}"/>`
      : colors
          .map((color, index) => {
            const offset =
              colors.length === 1 ? 0 : (index / (colors.length - 1)) * 100;
            return `<stop offset="${formatNumber(offset)}%" stop-color="${color}"/>`;
          })
          .join("");

  const trafficLights = config.composition.browser.showTrafficLights
    ? `
      <circle cx="${formatNumber(windowX + 22)}" cy="${formatNumber(windowY + toolbarHeight / 2)}" r="5.5" fill="#ff5f57"/>
      <circle cx="${formatNumber(windowX + 42)}" cy="${formatNumber(windowY + toolbarHeight / 2)}" r="5.5" fill="#febc2e"/>
      <circle cx="${formatNumber(windowX + 62)}" cy="${formatNumber(windowY + toolbarHeight / 2)}" r="5.5" fill="#28c840"/>
    `
    : "";

  const addressBar = config.composition.browser.showAddressBar
    ? `
      <rect
        x="${formatNumber(addressBarX)}"
        y="${formatNumber(addressBarY)}"
        width="${formatNumber(addressBarWidth)}"
        height="${formatNumber(addressBarHeight)}"
        rx="${formatNumber(addressBarHeight / 2)}"
        fill="#6e7e90"
        fill-opacity="0.14"
      />
      <circle
        cx="${formatNumber(addressBarX + 16)}"
        cy="${formatNumber(addressBarY + addressBarHeight / 2)}"
        r="3"
        fill="#5e6d80"
        fill-opacity="0.52"
      />
    `
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.outputWidth}" height="${layout.outputHeight}" viewBox="0 0 ${layout.outputWidth} ${layout.outputHeight}" fill="none">
  <defs>
    <linearGradient id="bg" x1="${formatNumber(gradient.x1)}%" y1="${formatNumber(gradient.y1)}%" x2="${formatNumber(gradient.x2)}%" y2="${formatNumber(gradient.y2)}%">
      ${backgroundStops}
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="28" stdDeviation="26" flood-color="#1c2b3b" flood-opacity="0.18"/>
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#1c2b3b" flood-opacity="0.08"/>
    </filter>
    <mask id="cutout">
      <rect width="100%" height="100%" fill="white"/>
      <path d="${holePath}" fill="black"/>
    </mask>
  </defs>

  <g mask="url(#cutout)">
    <rect width="100%" height="100%" fill="url(#bg)"/>

    <g filter="url(#shadow)">
      <rect
        x="${formatNumber(windowX)}"
        y="${formatNumber(windowY)}"
        width="${formatNumber(windowWidth)}"
        height="${formatNumber(windowHeight)}"
        rx="${formatNumber(radius)}"
        fill="#ffffff"
        fill-opacity="0.98"
      />
    </g>

    <path
      d="M ${formatNumber(windowX + radius)} ${formatNumber(windowY)} H ${formatNumber(windowX + windowWidth - radius)} A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1 ${formatNumber(windowX + windowWidth)} ${formatNumber(windowY + radius)} V ${formatNumber(windowY + toolbarHeight)} H ${formatNumber(windowX)} V ${formatNumber(windowY + radius)} A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1 ${formatNumber(windowX + radius)} ${formatNumber(windowY)} Z"
      fill="#f8fafc"
      fill-opacity="0.98"
    />

    <path
      d="${holePath}"
      fill="url(#bg)"
    />

    <rect
      x="${formatNumber(windowX)}"
      y="${formatNumber(windowY + toolbarHeight - 0.5)}"
      width="${formatNumber(windowWidth)}"
      height="1"
      fill="#495466"
      fill-opacity="0.14"
    />

    ${trafficLights}
    ${addressBar}
    ${captionMarkup}

    <rect
      x="${formatNumber(windowX + 0.5)}"
      y="${formatNumber(windowY + 0.5)}"
      width="${formatNumber(windowWidth - 1)}"
      height="${formatNumber(windowHeight - 1)}"
      rx="${formatNumber(Math.max(radius - 0.5, 0))}"
      stroke="#343f4f"
      stroke-opacity="0.14"
      stroke-width="1"
    />
  </g>
</svg>`;
}

async function rasterizeWithRsvg(svgPath: string, outputPath: string): Promise<void> {
  await execFileAsync("rsvg-convert", [svgPath, "-o", outputPath]);
}

async function rasterizeWithInkscape(
  svgPath: string,
  outputPath: string,
): Promise<void> {
  await execFileAsync("inkscape", [svgPath, `--export-filename=${outputPath}`]);
}

async function rasterizeComposition(svgPath: string, outputPath: string): Promise<void> {
  try {
    await rasterizeWithRsvg(svgPath, outputPath);
    return;
  } catch (rsvgError) {
    try {
      await rasterizeWithInkscape(svgPath, outputPath);
      return;
    } catch (inkscapeError) {
      throw new Error(
        `Unable to rasterize composition overlay.\nrsvg-convert: ${String(rsvgError)}\ninkscape: ${String(inkscapeError)}`,
      );
    }
  }
}

export async function prepareComposition(
  sessionDir: string,
  config: LoadedMotionConfig,
): Promise<CompositionLayout> {
  const layout = fitBrowserWindow(config);

  if (!layout.enabled) {
    return layout;
  }

  const svgPath = path.join(sessionDir, "composition.svg");
  const assetPath = path.join(sessionDir, "composition.png");
  const svg = buildCompositionSvg(config, layout);
  await fs.writeFile(svgPath, svg, "utf8");
  await rasterizeComposition(svgPath, assetPath);

  return {
    ...layout,
    assetPath,
  };
}
