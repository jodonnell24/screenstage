import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CompositionLayout, LoadedMotionConfig } from "./types.js";

const execFileAsync = promisify(execFile);
const DESKTOP_REFERENCE = {
  height: 1080,
  width: 1920,
};
const PHONE_REFERENCE = {
  height: 1920,
  width: 1080,
};

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

function scaleMetric(
  value: number,
  outputWidth: number,
  outputHeight: number,
  referenceWidth: number,
  referenceHeight: number,
): number {
  return value * Math.min(outputWidth / referenceWidth, outputHeight / referenceHeight);
}

function fitDesktopWindow(config: LoadedMotionConfig): CompositionLayout {
  const outputWidth = config.output.width;
  const outputHeight = config.output.height;
  const padding = scaleMetric(
    config.composition.browser.padding,
    outputWidth,
    outputHeight,
    DESKTOP_REFERENCE.width,
    DESKTOP_REFERENCE.height,
  );
  const toolbarHeight = scaleMetric(
    config.composition.browser.toolbarHeight,
    outputWidth,
    outputHeight,
    DESKTOP_REFERENCE.width,
    DESKTOP_REFERENCE.height,
  );
  const radius = scaleMetric(
    config.composition.browser.radius,
    outputWidth,
    outputHeight,
    DESKTOP_REFERENCE.width,
    DESKTOP_REFERENCE.height,
  );
  const availableWidth = outputWidth - padding * 2;
  const availableHeight = outputHeight - padding * 2;
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
  const windowY = (outputHeight - windowHeight) / 2;

  return {
    contentHeight: Math.round(contentHeight),
    contentRadius: Math.round(radius),
    contentWidth: Math.round(contentWidth),
    contentX: Math.round(windowX),
    contentY: Math.round(windowY + toolbarHeight),
    device: "desktop",
    enabled: true,
    outputHeight,
    outputWidth,
    preset: config.composition.preset,
    toolbarHeight: Math.round(toolbarHeight),
    windowHeight: Math.round(windowHeight),
    windowRadius: Math.round(radius),
    windowWidth: Math.round(windowWidth),
    windowX: Math.round(windowX),
    windowY: Math.round(windowY),
  };
}

function fitPhoneWindow(config: LoadedMotionConfig): CompositionLayout {
  const outputWidth = config.output.width;
  const outputHeight = config.output.height;
  const outerPadding = scaleMetric(
    Math.max(config.composition.browser.padding * 0.82, 56),
    outputWidth,
    outputHeight,
    PHONE_REFERENCE.width,
    PHONE_REFERENCE.height,
  );
  const framePadding = scaleMetric(
    config.composition.phone.framePadding,
    outputWidth,
    outputHeight,
    PHONE_REFERENCE.width,
    PHONE_REFERENCE.height,
  );
  const shellRadius = scaleMetric(
    54,
    outputWidth,
    outputHeight,
    PHONE_REFERENCE.width,
    PHONE_REFERENCE.height,
  );
  const screenRadius = scaleMetric(
    42,
    outputWidth,
    outputHeight,
    PHONE_REFERENCE.width,
    PHONE_REFERENCE.height,
  );
  const availableWidth = outputWidth - outerPadding * 2 - framePadding * 2;
  const availableHeight = outputHeight - outerPadding * 2 - framePadding * 2;
  const sourceAspect = config.viewport.width / config.viewport.height;

  let contentWidth = availableWidth;
  let contentHeight = contentWidth / sourceAspect;

  if (contentHeight > availableHeight) {
    contentHeight = availableHeight;
    contentWidth = contentHeight * sourceAspect;
  }

  const windowWidth = contentWidth + framePadding * 2;
  const windowHeight = contentHeight + framePadding * 2;
  const windowX = (outputWidth - windowWidth) / 2;
  const windowY = (outputHeight - windowHeight) / 2;

  return {
    contentHeight: Math.round(contentHeight),
    contentRadius: Math.round(screenRadius),
    contentWidth: Math.round(contentWidth),
    contentX: Math.round(windowX + framePadding),
    contentY: Math.round(windowY + framePadding),
    device: "phone",
    enabled: true,
    outputHeight,
    outputWidth,
    preset: config.composition.preset,
    windowHeight: Math.round(windowHeight),
    windowRadius: Math.round(shellRadius),
    windowWidth: Math.round(windowWidth),
    windowX: Math.round(windowX),
    windowY: Math.round(windowY),
  };
}

function fitCompositionWindow(config: LoadedMotionConfig): CompositionLayout {
  const outputWidth = config.output.width;
  const outputHeight = config.output.height;

  if (config.composition.preset === "none") {
    return {
      contentHeight: outputHeight,
      contentWidth: outputWidth,
      contentX: 0,
      contentY: 0,
      device: config.composition.device,
      enabled: false,
      outputHeight,
      outputWidth,
      preset: "none",
    };
  }

  if (config.composition.device === "phone") {
    return fitPhoneWindow(config);
  }

  return fitDesktopWindow(config);
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

function buildDesktopCompositionSvg(
  config: LoadedMotionConfig,
  layout: CompositionLayout,
): string {
  const colors = getPresetColors(config).map(escapeXml);
  const angle = config.composition.background.angle;
  const gradient = degreesToGradientPoint(angle);
  const radius = layout.windowRadius!;
  const toolbarHeight = layout.toolbarHeight!;
  const windowX = layout.windowX!;
  const windowY = layout.windowY!;
  const windowWidth = layout.windowWidth!;
  const windowHeight = layout.windowHeight!;
  const holePath = buildContentHolePath(layout, radius);
  const addressBarWidth = windowWidth * 0.38;
  const addressBarHeight = Math.max(18, toolbarHeight * 0.34);
  const addressBarX = windowX + (windowWidth - addressBarWidth) / 2;
  const addressBarY = windowY + (toolbarHeight - addressBarHeight) / 2;
  const addressBarLabel = config.composition.browser.domain?.trim();
  const toolbarCenterY = windowY + toolbarHeight / 2;
  const toolbarGlowHeight = Math.max(toolbarHeight * 0.72, 24);
  const browserFill =
    config.composition.preset === "spotlight-browser" ? "#f5f7fb" : "#ffffff";
  const chromeFill =
    config.composition.preset === "spotlight-browser" ? "#eef2f7" : "#f8fafc";

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
      ${
        addressBarLabel
          ? `
      <text
        x="${formatNumber(addressBarX + 28)}"
        y="${formatNumber(addressBarY + addressBarHeight / 2 + 4.5)}"
        fill="#6b7789"
        font-family="DejaVu Sans, Arial, sans-serif"
        font-size="12"
        font-weight="600"
      >${escapeXml(addressBarLabel)}</text>
      `
          : ""
      }
    `
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.outputWidth}" height="${layout.outputHeight}" viewBox="0 0 ${layout.outputWidth} ${layout.outputHeight}" fill="none">
  <defs>
    <linearGradient id="bg" x1="${formatNumber(gradient.x1)}%" y1="${formatNumber(gradient.y1)}%" x2="${formatNumber(gradient.x2)}%" y2="${formatNumber(gradient.y2)}%">
      ${backgroundStops}
    </linearGradient>
    <radialGradient id="ambientGlowA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${formatNumber(layout.outputWidth * 0.16)} ${formatNumber(layout.outputHeight * 0.18)}) rotate(34) scale(${formatNumber(layout.outputWidth * 0.36)} ${formatNumber(layout.outputHeight * 0.42)})">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="${config.composition.preset === "spotlight-browser" ? "0.24" : "0.42"}"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ambientGlowB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${formatNumber(layout.outputWidth * 0.78)} ${formatNumber(layout.outputHeight * 0.22)}) rotate(18) scale(${formatNumber(layout.outputWidth * 0.34)} ${formatNumber(layout.outputHeight * 0.28)})">
      <stop offset="0%" stop-color="#d6efe7" stop-opacity="${config.composition.preset === "spotlight-browser" ? "0.22" : "0.34"}"/>
      <stop offset="100%" stop-color="#d6efe7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ambientGlowC" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${formatNumber(layout.outputWidth * 0.64)} ${formatNumber(layout.outputHeight * 0.84)}) rotate(-16) scale(${formatNumber(layout.outputWidth * 0.44)} ${formatNumber(layout.outputHeight * 0.22)})">
      <stop offset="0%" stop-color="#cad7f0" stop-opacity="${config.composition.preset === "spotlight-browser" ? "0.16" : "0.28"}"/>
      <stop offset="100%" stop-color="#cad7f0" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="windowSheen" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.66"/>
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#d7dfea" stop-opacity="0.12"/>
    </linearGradient>
    <linearGradient id="toolbarWash" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.78"/>
      <stop offset="100%" stop-color="#eef3f9" stop-opacity="0.92"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="40" stdDeviation="34" flood-color="#152332" flood-opacity="0.18"/>
      <feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#152332" flood-opacity="0.1"/>
    </filter>
    <filter id="softBlur" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
    <mask id="cutout">
      <rect width="100%" height="100%" fill="white"/>
      <path d="${holePath}" fill="black"/>
    </mask>
  </defs>

  <g mask="url(#cutout)">
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <ellipse cx="${formatNumber(layout.outputWidth * 0.16)}" cy="${formatNumber(layout.outputHeight * 0.18)}" rx="${formatNumber(layout.outputWidth * 0.22)}" ry="${formatNumber(layout.outputHeight * 0.18)}" fill="url(#ambientGlowA)"/>
    <ellipse cx="${formatNumber(layout.outputWidth * 0.78)}" cy="${formatNumber(layout.outputHeight * 0.22)}" rx="${formatNumber(layout.outputWidth * 0.18)}" ry="${formatNumber(layout.outputHeight * 0.12)}" fill="url(#ambientGlowB)"/>
    <ellipse cx="${formatNumber(layout.outputWidth * 0.64)}" cy="${formatNumber(layout.outputHeight * 0.84)}" rx="${formatNumber(layout.outputWidth * 0.24)}" ry="${formatNumber(layout.outputHeight * 0.12)}" fill="url(#ambientGlowC)"/>
    <rect x="${formatNumber(windowX + windowWidth * 0.06)}" y="${formatNumber(windowY + windowHeight + 18)}" width="${formatNumber(windowWidth * 0.88)}" height="${formatNumber(windowHeight * 0.18)}" rx="${formatNumber(windowHeight * 0.09)}" fill="#102132" fill-opacity="${config.composition.preset === "spotlight-browser" ? "0.14" : "0.08"}" filter="url(#softBlur)"/>

    <g filter="url(#shadow)">
      <rect
        x="${formatNumber(windowX)}"
        y="${formatNumber(windowY)}"
        width="${formatNumber(windowWidth)}"
        height="${formatNumber(windowHeight)}"
        rx="${formatNumber(radius)}"
        fill="${browserFill}"
        fill-opacity="0.985"
      />
    </g>

    <rect
      x="${formatNumber(windowX + 1)}"
      y="${formatNumber(windowY + 1)}"
      width="${formatNumber(windowWidth - 2)}"
      height="${formatNumber(windowHeight * 0.42)}"
      rx="${formatNumber(Math.max(radius - 1, 0))}"
      fill="url(#windowSheen)"
      fill-opacity="0.74"
    />

    <path
      d="M ${formatNumber(windowX + radius)} ${formatNumber(windowY)} H ${formatNumber(windowX + windowWidth - radius)} A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1 ${formatNumber(windowX + windowWidth)} ${formatNumber(windowY + radius)} V ${formatNumber(windowY + toolbarHeight)} H ${formatNumber(windowX)} V ${formatNumber(windowY + radius)} A ${formatNumber(radius)} ${formatNumber(radius)} 0 0 1 ${formatNumber(windowX + radius)} ${formatNumber(windowY)} Z"
      fill="url(#toolbarWash)"
      fill-opacity="0.98"
    />

    <rect
      x="${formatNumber(windowX + 18)}"
      y="${formatNumber(toolbarCenterY - toolbarGlowHeight / 2)}"
      width="${formatNumber(windowWidth - 36)}"
      height="${formatNumber(toolbarGlowHeight)}"
      rx="${formatNumber(toolbarGlowHeight / 2)}"
      fill="#ffffff"
      fill-opacity="0.22"
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

    <rect
      x="${formatNumber(windowX + windowWidth - 112)}"
      y="${formatNumber(toolbarCenterY - 12)}"
      width="${formatNumber(84)}"
      height="${formatNumber(24)}"
      rx="12"
      fill="#6f8195"
      fill-opacity="0.12"
    />
    <circle cx="${formatNumber(windowX + windowWidth - 92)}" cy="${formatNumber(toolbarCenterY)}" r="3" fill="#6f8195" fill-opacity="0.38"/>
    <circle cx="${formatNumber(windowX + windowWidth - 76)}" cy="${formatNumber(toolbarCenterY)}" r="3" fill="#6f8195" fill-opacity="0.3"/>
    <circle cx="${formatNumber(windowX + windowWidth - 60)}" cy="${formatNumber(toolbarCenterY)}" r="3" fill="#6f8195" fill-opacity="0.22"/>

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

function buildPhoneCompositionSvg(
  config: LoadedMotionConfig,
  layout: CompositionLayout,
): string {
  const colors = getPresetColors(config).map(escapeXml);
  const angle = config.composition.background.angle;
  const gradient = degreesToGradientPoint(angle);
  const shellRadius = layout.windowRadius!;
  const screenRadius = layout.contentRadius ?? Math.max(shellRadius - 12, 0);
  const windowX = layout.windowX!;
  const windowY = layout.windowY!;
  const windowWidth = layout.windowWidth!;
  const windowHeight = layout.windowHeight!;
  const holePath = buildContentHolePath(layout, screenRadius);
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
  const shellScale = Math.min(
    layout.outputWidth / PHONE_REFERENCE.width,
    layout.outputHeight / PHONE_REFERENCE.height,
  );
  const islandWidth = 120 * shellScale;
  const islandHeight = 34 * shellScale;
  const islandX = windowX + (windowWidth - islandWidth) / 2;
  const islandY = windowY + 14 * shellScale;
  const homeIndicatorWidth = 134 * shellScale;
  const homeIndicatorHeight = 5 * shellScale;
  const homeIndicatorX = windowX + (windowWidth - homeIndicatorWidth) / 2;
  const homeIndicatorY = windowY + windowHeight - 16 * shellScale;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${layout.outputWidth}" height="${layout.outputHeight}" viewBox="0 0 ${layout.outputWidth} ${layout.outputHeight}" fill="none">
  <defs>
    <linearGradient id="bg" x1="${formatNumber(gradient.x1)}%" y1="${formatNumber(gradient.y1)}%" x2="${formatNumber(gradient.x2)}%" y2="${formatNumber(gradient.y2)}%">
      ${backgroundStops}
    </linearGradient>
    <radialGradient id="phoneAmbientA" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${formatNumber(layout.outputWidth * 0.28)} ${formatNumber(layout.outputHeight * 0.18)}) rotate(24) scale(${formatNumber(layout.outputWidth * 0.34)} ${formatNumber(layout.outputHeight * 0.24)})">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="phoneAmbientB" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(${formatNumber(layout.outputWidth * 0.72)} ${formatNumber(layout.outputHeight * 0.78)}) rotate(-18) scale(${formatNumber(layout.outputWidth * 0.3)} ${formatNumber(layout.outputHeight * 0.2)})">
      <stop offset="0%" stop-color="#b7d4ff" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#b7d4ff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="phoneShellEdge" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="phoneShadow" x="-30%" y="-20%" width="160%" height="180%">
      <feDropShadow dx="0" dy="42" stdDeviation="32" flood-color="#101823" flood-opacity="0.22"/>
      <feDropShadow dx="0" dy="16" stdDeviation="12" flood-color="#101823" flood-opacity="0.12"/>
    </filter>
    <mask id="screenCutout">
      <rect width="100%" height="100%" fill="white"/>
      <path d="${holePath}" fill="black"/>
    </mask>
  </defs>

  <g mask="url(#screenCutout)">
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <ellipse cx="${formatNumber(layout.outputWidth * 0.28)}" cy="${formatNumber(layout.outputHeight * 0.18)}" rx="${formatNumber(layout.outputWidth * 0.18)}" ry="${formatNumber(layout.outputHeight * 0.12)}" fill="url(#phoneAmbientA)"/>
    <ellipse cx="${formatNumber(layout.outputWidth * 0.72)}" cy="${formatNumber(layout.outputHeight * 0.78)}" rx="${formatNumber(layout.outputWidth * 0.16)}" ry="${formatNumber(layout.outputHeight * 0.1)}" fill="url(#phoneAmbientB)"/>

    <g filter="url(#phoneShadow)">
      <rect
        x="${formatNumber(windowX)}"
        y="${formatNumber(windowY)}"
        width="${formatNumber(windowWidth)}"
        height="${formatNumber(windowHeight)}"
        rx="${formatNumber(shellRadius)}"
        fill="${escapeXml(config.composition.phone.color)}"
      />
      <rect
        x="${formatNumber(windowX + 1)}"
        y="${formatNumber(windowY + 1)}"
        width="${formatNumber(windowWidth - 2)}"
        height="${formatNumber(windowHeight * 0.28)}"
        rx="${formatNumber(Math.max(shellRadius - 1, 0))}"
        fill="url(#phoneShellEdge)"
      />
    </g>
  </g>

  <rect
    x="${formatNumber(windowX + 0.5)}"
    y="${formatNumber(windowY + 0.5)}"
    width="${formatNumber(windowWidth - 1)}"
    height="${formatNumber(windowHeight - 1)}"
    rx="${formatNumber(Math.max(shellRadius - 0.5, 0))}"
    stroke="#ffffff"
    stroke-opacity="0.08"
    stroke-width="1"
  />

  ${
    config.composition.phone.showCameraIsland
      ? `
  <rect
    x="${formatNumber(islandX)}"
    y="${formatNumber(islandY)}"
    width="${formatNumber(islandWidth)}"
    height="${formatNumber(islandHeight)}"
    rx="${formatNumber(islandHeight / 2)}"
    fill="#090b0f"
    fill-opacity="0.92"
  />
  `
      : ""
  }

  ${
    config.composition.phone.showHomeIndicator
      ? `
  <rect
    x="${formatNumber(homeIndicatorX)}"
    y="${formatNumber(homeIndicatorY)}"
    width="${formatNumber(homeIndicatorWidth)}"
    height="${formatNumber(homeIndicatorHeight)}"
    rx="${formatNumber(homeIndicatorHeight / 2)}"
    fill="#ffffff"
    fill-opacity="0.62"
  />
  `
      : ""
  }
</svg>`;
}

function buildCompositionSvg(
  config: LoadedMotionConfig,
  layout: CompositionLayout,
): string {
  if (layout.device === "phone") {
    return buildPhoneCompositionSvg(config, layout);
  }

  return buildDesktopCompositionSvg(config, layout);
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
  const layout = fitCompositionWindow(config);

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
