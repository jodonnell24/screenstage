import fs from "node:fs/promises";
import path from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import type { CompositionDevice, OutputPreset } from "./types.js";

type ProjectKind = "local-app" | "static-starter";

type DetectedProject = {
  packageJsonDir?: string;
  packageName?: string;
  recommendedCommand?: string;
  recommendedUrl?: string;
};

type InitAnswers = {
  device: CompositionDevice;
  directory: string;
  outputPreset: OutputPreset;
  projectKind: ProjectKind;
  serveCommand?: string;
  studioEnabled: boolean;
  url: string;
};

const CONFIG_TEMPLATE = `export default {
  name: "starter-demo",
  url: new URL("./demo-site/index.html", import.meta.url).href,
  demo: "./demo/starter-demo.mjs",
  viewport: {
    width: 1440,
    height: 900,
  },
  output: {
    dir: "./output",
    preset: "release-hero",
  },
  camera: {
    mode: "follow",
    zoom: 1.7,
    padding: 96,
  },
  composition: {
    preset: "studio-browser",
    background: {
      preset: "soft-studio",
    },
    browser: {
      domain: "app.example.com",
      style: "polished",
    },
  },
  browser: {
    headless: true,
  },
  timing: {
    settleMs: 900,
  },
};
`;

const DEMO_TEMPLATE = `export default [
  {
    type: "wide",
    durationMs: 400,
    label: "Open on a broad establishing shot",
  },
  {
    type: "wait",
    durationMs: 600,
  },
  {
    type: "focus-selector",
    selector: "[data-demo='email']",
    durationMs: 850,
    zoom: 2,
    label: "Reframe onto the email field",
  },
  {
    type: "type-selector",
    selector: "[data-demo='email']",
    text: "hello@getrestocky.com",
    durationMs: 900,
    delayMs: 75,
    label: "Type like a human instead of filling instantly",
  },
  {
    type: "wait",
    durationMs: 350,
  },
  {
    type: "follow-cursor",
    durationMs: 300,
    label: "Hand control back to the cursor",
  },
  {
    type: "move-selector",
    selector: "[data-demo='cta']",
    durationMs: 850,
  },
  {
    type: "click",
    label: "Commit the CTA click",
  },
  {
    type: "wait",
    durationMs: 1000,
  },
  {
    type: "focus-selector",
    selector: "[data-demo='card-2']",
    durationMs: 900,
    zoom: 1.8,
    label: "Pan to the supporting metric card",
  },
  {
    type: "move-selector",
    selector: "[data-demo='card-2']",
    durationMs: 900,
  },
  {
    type: "wait",
    durationMs: 800,
    target: "camera",
  },
];
`;

const RECORDING_PLACEHOLDER_TEMPLATE = `export default async function demo({ camera, cursor }) {
  await camera.wide({ durationMs: 0 });
  await cursor.wait(1200);
}
`;

const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Motion Creator Starter</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3ede3;
        --panel: rgba(255, 255, 255, 0.82);
        --ink: #182126;
        --muted: #5f6a6f;
        --line: rgba(24, 33, 38, 0.08);
        --accent: #1f8f72;
        --accent-strong: #156652;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Instrument Sans", "Avenir Next", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(255, 255, 255, 0.95), transparent 40%),
          linear-gradient(135deg, #f8f2e9 0%, #e9f0eb 48%, #d5e7ef 100%);
      }

      .shell {
        padding: 56px;
      }

      .hero {
        display: grid;
        grid-template-columns: 1.15fr 0.85fr;
        gap: 28px;
        align-items: stretch;
      }

      .panel {
        backdrop-filter: blur(18px);
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 28px;
        box-shadow: 0 28px 70px rgba(52, 66, 74, 0.16);
      }

      .content {
        padding: 40px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        border-radius: 999px;
        background: rgba(31, 143, 114, 0.12);
        color: var(--accent-strong);
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 24px 0 14px;
        max-width: 12ch;
        font-size: 72px;
        line-height: 0.92;
        letter-spacing: -0.06em;
      }

      p {
        margin: 0;
        max-width: 44ch;
        color: var(--muted);
        font-size: 19px;
        line-height: 1.55;
      }

      .stack {
        margin-top: 28px;
        display: flex;
        gap: 14px;
        align-items: center;
      }

      input {
        width: 100%;
        padding: 18px 20px;
        border: 1px solid rgba(24, 33, 38, 0.1);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.8);
        color: var(--ink);
        font: inherit;
      }

      button {
        border: 0;
        border-radius: 18px;
        padding: 18px 24px;
        color: white;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
        font: inherit;
        font-weight: 700;
        box-shadow: 0 18px 34px rgba(21, 102, 82, 0.25);
      }

      .cards {
        display: grid;
        gap: 16px;
      }

      .card {
        padding: 24px;
      }

      .metric {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
      }

      .metric strong {
        font-size: 38px;
        letter-spacing: -0.05em;
      }

      .metric span {
        color: var(--muted);
        font-size: 14px;
      }

      .mini-chart {
        margin-top: 20px;
        height: 86px;
        border-radius: 18px;
        background:
          linear-gradient(180deg, rgba(31, 143, 114, 0.26), rgba(31, 143, 114, 0) 70%),
          linear-gradient(120deg, rgba(255, 255, 255, 0.7), rgba(223, 236, 232, 0.9));
        position: relative;
        overflow: hidden;
      }

      .mini-chart::after {
        content: "";
        position: absolute;
        inset: 24px 18px 16px;
        border-radius: 999px;
        border-bottom: 3px solid rgba(24, 33, 38, 0.18);
        border-left: 3px solid rgba(24, 33, 38, 0.18);
        transform: skewX(-18deg);
      }

      .list {
        margin: 18px 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 14px;
      }

      .list li {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        color: var(--muted);
      }

      .list strong {
        color: var(--ink);
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <article class="panel content">
          <div class="eyebrow">Product Demo Starter</div>
          <h1>Shape polished launch videos in code.</h1>
          <p>
            This starter page gives the Motion Creator MVP something deterministic
            to record: a form field, a call to action, and a card grid for cursor
            pans.
          </p>
          <div class="stack">
            <input data-demo="email" placeholder="Drop your work email" />
            <button data-demo="cta">Join waitlist</button>
          </div>
        </article>

        <aside class="cards">
          <section class="panel card" data-demo="card-1">
            <div class="metric">
              <strong>2.4x</strong>
              <span>demo conversion</span>
            </div>
            <div class="mini-chart"></div>
          </section>
          <section class="panel card" data-demo="card-2">
            <div class="metric">
              <strong>18s</strong>
              <span>time to value</span>
            </div>
            <ul class="list">
              <li><strong>Scripted cursor</strong><span>Visible in recording</span></li>
              <li><strong>FFmpeg camera</strong><span>Follows the action</span></li>
              <li><strong>TypeScript setup</strong><span>Ready for extension</span></li>
            </ul>
          </section>
        </aside>
      </section>
    </main>
  </body>
</html>
`;

function defaultViewportFor(device: CompositionDevice): {
  height: number;
  width: number;
} {
  return device === "phone"
    ? {
        height: 932,
        width: 430,
      }
    : {
        height: 900,
        width: 1440,
      };
}

function defaultViewportForProject(
  projectKind: ProjectKind,
  device: CompositionDevice,
): {
  height: number;
  width: number;
} {
  if (device === "phone") {
    return defaultViewportFor(device);
  }

  return projectKind === "local-app"
    ? {
        height: 1080,
        width: 1728,
      }
    : defaultViewportFor(device);
}

function defaultOutputPresetFor(device: CompositionDevice): OutputPreset {
  return device === "phone" ? "social-vertical" : "motion-edit";
}

function defaultUrlFor(projectKind: ProjectKind, detected?: DetectedProject): string {
  if (projectKind === "local-app") {
    return detected?.recommendedUrl ?? "http://127.0.0.1:3000";
  }

  return 'new URL("./demo-site/index.html", import.meta.url).href';
}

function defaultNameFor(targetDir: string, projectKind: ProjectKind): string {
  const basename = path.basename(targetDir) || "motion-project";
  const normalized = basename
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized || (projectKind === "local-app" ? "local-app-demo" : "starter-demo");
}

function inferDomainLabel(url: string): string | undefined {
  if (url.startsWith("new URL(")) {
    return "app.example.com";
  }

  try {
    const parsed = new URL(url);
    return parsed.host || undefined;
  } catch {
    return undefined;
  }
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function parseBooleanAnswer(value: string, defaultValue: boolean): boolean {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return defaultValue;
  }

  if (["y", "yes", "true", "1"].includes(normalized)) {
    return true;
  }

  if (["n", "no", "false", "0"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parseChoice<T extends string>(
  value: string,
  options: T[],
  defaultValue: T,
): T {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return defaultValue;
  }

  return (
    options.find((option) => option.toLowerCase() === normalized) ?? defaultValue
  );
}

function parseOutputPreset(value: string, defaultValue: OutputPreset): OutputPreset {
  return parseChoice(
    value,
    ["motion-edit", "release-hero", "social-square", "social-vertical"],
    defaultValue,
  );
}

function parseDevice(value: string, defaultValue: CompositionDevice): CompositionDevice {
  return parseChoice(value, ["desktop", "phone"], defaultValue);
}

function parseProjectKind(value: string, defaultValue: ProjectKind): ProjectKind {
  return parseChoice(value, ["local-app", "static-starter"], defaultValue);
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findNearestPackageJson(startDir: string): Promise<string | undefined> {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, "package.json");

    if (await pathExists(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

function inferCommandFromScripts(
  scripts: Record<string, string>,
): string | undefined {
  const orderedKeys = [
    "dev",
    "start",
    "preview",
    "web",
    "serve",
  ];

  for (const key of orderedKeys) {
    const script = scripts[key];

    if (typeof script === "string" && script.trim().length > 0) {
      return `npm run ${key}`;
    }
  }

  return undefined;
}

function inferPortFromScript(script: string): number | undefined {
  const explicit =
    script.match(/(?:--port|--ports?|--host-port|-p)\s+(\d{3,5})/) ??
    script.match(/PORT=(\d{3,5})/) ??
    script.match(/localhost:(\d{3,5})/) ??
    script.match(/127\.0\.0\.1:(\d{3,5})/);

  if (explicit?.[1]) {
    return Number(explicit[1]);
  }

  const normalized = script.toLowerCase();

  if (normalized.includes("vite")) {
    return 5173;
  }

  if (normalized.includes("astro")) {
    return 4321;
  }

  if (normalized.includes("next")) {
    return 3000;
  }

  if (normalized.includes("react-scripts")) {
    return 3000;
  }

  if (
    normalized.includes("nuxt") ||
    normalized.includes("remix") ||
    normalized.includes("react-router") ||
    normalized.includes("svelte-kit") ||
    normalized.includes("webpack")
  ) {
    return 3000;
  }

  return undefined;
}

async function detectProject(targetDir: string): Promise<DetectedProject | undefined> {
  const packageJsonPath = await findNearestPackageJson(targetDir);

  if (!packageJsonPath) {
    return undefined;
  }

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8")) as {
    name?: string;
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};
  const recommendedCommand = inferCommandFromScripts(scripts);
  const scriptSource =
    recommendedCommand?.replace(/^npm run /, "") &&
    scripts[recommendedCommand.replace(/^npm run /, "")];
  const port = scriptSource ? inferPortFromScript(scriptSource) : undefined;

  return {
    packageJsonDir: path.dirname(packageJsonPath),
    packageName: packageJson.name,
    recommendedCommand,
    recommendedUrl: port ? `http://127.0.0.1:${port}` : undefined,
  };
}

function buildConfigSource(answers: InitAnswers): string {
  const viewport = defaultViewportForProject(
    answers.projectKind,
    answers.device,
  );
  const domain = inferDomainLabel(answers.url);
  const lines = [
    "export default {",
    `  name: ${quote(defaultNameFor(answers.directory, answers.projectKind))},`,
    `  url: ${answers.projectKind === "static-starter" ? answers.url : quote(answers.url)},`,
    `  demo: "./demo/${answers.projectKind === "static-starter" ? "starter-demo" : "recording-demo"}.mjs",`,
    "  viewport: {",
    `    width: ${viewport.width},`,
    `    height: ${viewport.height},`,
    "  },",
    "  output: {",
    '    dir: "./output",',
    `    preset: ${quote(answers.outputPreset)},`,
    "  },",
    "  camera: {",
    '    mode: "follow",',
    `    zoom: ${answers.device === "phone" ? "1.45" : "1.7"},`,
    `    padding: ${answers.device === "phone" ? "84" : "96"},`,
    "  },",
    "  composition: {",
    '    preset: "studio-browser",',
    `    device: ${quote(answers.device)},`,
    "    background: {",
    `      preset: ${quote(answers.projectKind === "local-app" ? "cool-stage" : "soft-studio")},`,
    "    },",
    "    browser: {",
      `      domain: ${quote(domain ?? "app.example.com")},`,
    `      style: ${quote(answers.projectKind === "local-app" ? "glass" : "polished")},`,
    "    },",
    "  },",
    "  browser: {",
    `    capture: { mode: ${quote(answers.projectKind === "local-app" ? "video" : "balanced")} },`,
    "    headless: true,",
  ];

  if (answers.studioEnabled) {
    lines.push("    studio: {", "      enabled: true,", "    },");
  }

  lines.push("  },");

  if (answers.projectKind === "local-app" && answers.serveCommand) {
    lines.push(
      "  serve: {",
      `    command: ${quote(answers.serveCommand)},`,
      '    cwd: ".",',
      "  },",
    );
  }

  lines.push("  timing: {", "    settleMs: 900,", "  },", "};", "");
  return lines.join("\n");
}

async function writeFileIfMissing(filePath: string, contents: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contents, "utf8");
  }
}

function canPrompt(): boolean {
  return Boolean(input.isTTY && output.isTTY);
}

async function promptForInit(
  directoryArg: string | undefined,
  detected?: DetectedProject,
): Promise<InitAnswers> {
  const rl = createInterface({ input, output });
  const initialDirectory = directoryArg ?? ".";
  const defaultProjectKind: ProjectKind = detected?.recommendedCommand
    ? "local-app"
    : "static-starter";
  const defaultDevice: CompositionDevice = "desktop";

  try {
    const directoryAnswer = await rl.question(
      `Project directory (${initialDirectory}): `,
    );
    const directory = directoryAnswer.trim() || initialDirectory;
    const projectKindAnswer = await rl.question(
      `Project type [local-app/static-starter] (${defaultProjectKind}): `,
    );
    const projectKind = parseProjectKind(projectKindAnswer, defaultProjectKind);
    const deviceAnswer = await rl.question(
      `Device [desktop/phone] (${defaultDevice}): `,
    );
    const device = parseDevice(deviceAnswer, defaultDevice);
    const outputPresetDefault = defaultOutputPresetFor(device);
    const outputPresetAnswer = await rl.question(
      `Output preset [motion-edit/release-hero/social-square/social-vertical] (${outputPresetDefault}): `,
    );
    const outputPreset = parseOutputPreset(outputPresetAnswer, outputPresetDefault);
    const studioDefault = projectKind === "local-app";
    const studioAnswer = await rl.question(
      `Enable studio mode controls outside the shot? [Y/n] (${studioDefault ? "Y" : "N"}): `,
    );
    const studioEnabled = parseBooleanAnswer(studioAnswer, studioDefault);
    const urlDefault = defaultUrlFor(projectKind, detected);
    const urlPrompt =
      projectKind === "local-app"
        ? `App URL (${urlDefault}): `
        : `Starter URL expression (${urlDefault}): `;
    const urlAnswer = await rl.question(urlPrompt);
    const url = urlAnswer.trim() || urlDefault;
    let serveCommand: string | undefined;

    if (projectKind === "local-app") {
      const serveDefault = detected?.recommendedCommand ?? "";
      const serveAnswer = await rl.question(
        `Dev command to start the app (${serveDefault || "leave blank"}): `,
      );
      serveCommand = (serveAnswer.trim() || serveDefault || "").trim() || undefined;
    }

    return {
      device,
      directory,
      outputPreset,
      projectKind,
      serveCommand,
      studioEnabled,
      url,
    };
  } finally {
    rl.close();
  }
}

async function writeStarterProject(targetDir: string): Promise<void> {
  await writeFileIfMissing(path.join(targetDir, "motion.config.mjs"), CONFIG_TEMPLATE);
  await writeFileIfMissing(path.join(targetDir, "demo", "starter-demo.mjs"), DEMO_TEMPLATE);
  await writeFileIfMissing(path.join(targetDir, "demo-site", "index.html"), HTML_TEMPLATE);
}

async function writeGuidedProject(answers: InitAnswers): Promise<void> {
  const targetDir = path.resolve(answers.directory);
  const demoFilename =
    answers.projectKind === "static-starter" ? "starter-demo.mjs" : "recording-demo.mjs";

  await writeFileIfMissing(
    path.join(targetDir, "motion.config.mjs"),
    buildConfigSource(answers),
  );
  await writeFileIfMissing(
    path.join(targetDir, "demo", demoFilename),
    answers.projectKind === "static-starter"
      ? DEMO_TEMPLATE
      : RECORDING_PLACEHOLDER_TEMPLATE,
  );

  if (answers.projectKind === "static-starter") {
    await writeFileIfMissing(
      path.join(targetDir, "demo-site", "index.html"),
      HTML_TEMPLATE,
    );
  }
}

export async function initProject(directoryArg = "."): Promise<void> {
  if (!canPrompt()) {
    await writeStarterProject(path.resolve(directoryArg));
    return;
  }

  const targetDir = path.resolve(directoryArg);
  const detected = await detectProject(targetDir);
  const answers = await promptForInit(directoryArg, detected);
  await writeGuidedProject(answers);
}
