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
  name: "starter-workspace",
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
      domain: "workspace.local",
      style: "minimal",
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

const DEMO_TEMPLATE = `export default async function demo({ camera, cursor, page }) {
  await camera.wide({ durationMs: 0 });
  await cursor.wait(450);

  await cursor.typeSelector("[data-demo='search']", "design tokens", {
    delayMs: 72,
    durationMs: 860,
  });
  await cursor.wait(220);

  await cursor.clickSelector("[data-demo='save']", {
    durationMs: 620,
  });
  await cursor.wait(360);

  await page.mouse.wheel(0, 760);
  await cursor.sample("wait");
  await cursor.wait(520);

  await cursor.clickSelector("[data-demo='review-copy']", {
    durationMs: 740,
  });
  await cursor.wait(280);

  await cursor.typeSelector(
    "[data-demo='note']",
    "Tone down the release copy and keep the states readable in the capture.",
    {
      delayMs: 55,
      durationMs: 900,
    },
  );
  await cursor.wait(240);

  await cursor.clickSelector("[data-demo='publish']", {
    durationMs: 720,
  });
  await cursor.wait(420);

  await page.mouse.wheel(0, 920);
  await cursor.sample("wait");
  await cursor.wait(560);

  await cursor.clickSelector("[data-demo='ready']", {
    durationMs: 760,
  });
  await cursor.wait(900);
}
`;

const RECORDING_PLACEHOLDER_TEMPLATE = `export default async function demo({ camera, cursor }) {
  await camera.wide({ durationMs: 0 });
  await cursor.wait(1200);
}
`;

const SETUP_PLACEHOLDER_TEMPLATE = `export default async function setup({ target }) {
  await target.waitForSelector("body");
}
`;

const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Screenstage Starter</title>
    <style>
      /* bg: #f3efe8; surface: #ffffff; accent: #4ea87a; text: #181818 / #686868 */
      :root {
        color-scheme: light;
        --bg: #f3efe8;
        --surface: #ffffff;
        --surface-muted: #f7f4ee;
        --line: #ddd6ca;
        --text: #181818;
        --muted: #6f6a63;
        --accent: #4ea87a;
        --accent-strong: #3d8761;
        --accent-soft: #eef6f1;
      }

      * {
        box-sizing: border-box;
      }

      html {
        background: var(--bg);
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family: "Instrument Sans", "Avenir Next", system-ui, sans-serif;
      }

      button,
      input,
      textarea {
        font: inherit;
      }

      .app {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 24px;
        max-width: 1500px;
        margin: 0 auto;
        padding: 32px;
      }

      .sidebar {
        position: sticky;
        top: 32px;
        display: grid;
        gap: 18px;
        align-self: start;
      }

      .panel {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 20px;
      }

      .sidebar-card {
        padding: 20px;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        padding: 6px 10px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent-strong);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .sidebar h1 {
        margin: 14px 0 8px;
        font-size: 34px;
        line-height: 0.98;
        letter-spacing: -0.04em;
      }

      .sidebar p {
        margin: 0;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.55;
      }

      .nav {
        display: grid;
        gap: 8px;
      }

      .nav a {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 14px;
        border: 1px solid var(--line);
        border-radius: 14px;
        color: var(--text);
        text-decoration: none;
        background: var(--surface);
      }

      .nav a span:last-child {
        color: var(--muted);
        font-size: 12px;
      }

      .main {
        display: grid;
        gap: 24px;
        min-width: 0;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 260px;
        gap: 20px;
        padding: 24px;
      }

      .hero-copy h2 {
        margin: 16px 0 10px;
        max-width: 12ch;
        font-size: 58px;
        line-height: 0.92;
        letter-spacing: -0.06em;
      }

      .hero-copy p {
        margin: 0;
        max-width: 52ch;
        color: var(--muted);
        font-size: 16px;
        line-height: 1.6;
      }

      .search-row {
        margin-top: 24px;
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
      }

      .search-row input,
      textarea {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface-muted);
        color: var(--text);
      }

      .search-row input {
        padding: 14px 16px;
      }

      button {
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
        color: var(--text);
        padding: 12px 16px;
        cursor: pointer;
      }

      button.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: #f7fffb;
      }

      button:hover {
        background: #f1ede6;
      }

      button.primary:hover {
        background: var(--accent-strong);
      }

      .status-card {
        display: grid;
        gap: 10px;
        padding: 18px;
        align-content: start;
        background: var(--surface-muted);
      }

      .label {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }

      .status-card strong {
        font-size: 15px;
      }

      .status-card p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .stack {
        display: grid;
        gap: 24px;
      }

      .section {
        padding: 24px;
      }

      .section-heading {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
      }

      .section-heading h3 {
        margin: 6px 0 8px;
        font-size: 28px;
        line-height: 1;
        letter-spacing: -0.04em;
      }

      .section-heading p {
        margin: 0;
        max-width: 48ch;
        color: var(--muted);
        line-height: 1.6;
      }

      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }

      .pill {
        padding: 8px 12px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: var(--surface-muted);
        color: var(--muted);
        font-size: 13px;
      }

      .pill.is-active {
        background: var(--accent-soft);
        border-color: #cce3d6;
        color: var(--accent-strong);
      }

      .list {
        margin-top: 22px;
        display: grid;
        gap: 14px;
      }

      .list-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 18px;
        align-items: center;
        padding: 16px 18px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--surface);
      }

      .list-item strong,
      .note-preview strong,
      .finish-banner strong {
        display: block;
        font-size: 16px;
      }

      .list-item p,
      .note-preview p,
      .finish-banner p {
        margin: 6px 0 0;
        color: var(--muted);
        line-height: 1.55;
      }

      .note-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 280px;
        gap: 18px;
        margin-top: 22px;
      }

      textarea {
        min-height: 220px;
        padding: 16px;
        resize: vertical;
      }

      .note-actions {
        margin-top: 12px;
        display: flex;
        gap: 12px;
      }

      .note-preview,
      .finish-banner {
        padding: 18px;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--surface-muted);
      }

      .finish-banner.is-ready {
        background: var(--accent-soft);
        border-color: #cce3d6;
      }

      .spacer {
        height: 120px;
      }
    </style>
  </head>
  <body>
    <main class="app">
      <aside class="sidebar">
        <section class="panel sidebar-card">
          <div class="eyebrow">Starter</div>
          <h1>One page to test the recorder.</h1>
          <p>
            This starter keeps the UI basic on purpose. It is here to make browser capture behavior
            obvious, not to pretend to be a launch site.
          </p>
        </section>

        <nav class="nav">
          <a href="#overview"><span>Overview</span><span>Top</span></a>
          <a href="#review"><span>Review</span><span>Mid</span></a>
          <a href="#notes"><span>Notes</span><span>Mid</span></a>
          <a href="#finish"><span>Finish</span><span>Bottom</span></a>
        </nav>
      </aside>

      <section class="main">
        <article class="panel hero" id="overview">
          <div class="hero-copy">
            <div class="eyebrow">Starter Workspace</div>
            <h2>Record clean browser actions, then cut them up later.</h2>
            <p>
              Use the input, review list, note field, and finish state below. The layout is calm so
              cursor motion, clicks, and scroll behavior stay easy to judge.
            </p>

            <div class="search-row">
              <input data-demo="search" placeholder="Search a note or section" />
              <button class="primary" data-demo="save">Save filter</button>
            </div>

            <div class="pill-row">
              <button class="pill is-active" data-demo="scope-all">All</button>
              <button class="pill" data-demo="scope-review">Review</button>
              <button class="pill" data-demo="scope-notes">Notes</button>
            </div>
          </div>

          <aside class="status-card panel">
            <div class="label">Session status</div>
            <strong data-demo="status-title">Ready to capture</strong>
            <p data-demo="status-copy">Use the top controls, scroll into the notes section, then finish at the bottom action.</p>
          </aside>
        </article>

        <section class="panel section stack" id="review">
          <div class="section-heading">
            <div>
              <div class="label">Review queue</div>
              <h3>Keep the interactions visible.</h3>
            </div>
            <p>
              Each row updates when clicked so recorded actions produce obvious state changes.
            </p>
          </div>

          <div class="list">
            <article class="list-item">
              <div>
                <strong>Review the copy tone</strong>
                <p data-demo="review-copy-state">Needs a final pass before export.</p>
              </div>
              <button data-demo="review-copy">Review</button>
            </article>

            <article class="list-item">
              <div>
                <strong>Confirm the spacing rhythm</strong>
                <p data-demo="review-spacing-state">Still marked as pending.</p>
              </div>
              <button data-demo="review-spacing">Approve</button>
            </article>

            <article class="list-item">
              <div>
                <strong>Check the browser shell</strong>
                <p data-demo="review-shell-state">Minimal chrome, no in-shot controls.</p>
              </div>
              <button data-demo="review-shell">Pin</button>
            </article>
          </div>
        </section>

        <section class="panel section" id="notes">
          <div class="section-heading">
            <div>
              <div class="label">Notes</div>
              <h3>Write something long enough to watch typing.</h3>
            </div>
            <p>
              The note field is here so you can judge typing rhythm and see a visible saved state.
            </p>
          </div>

          <div class="note-layout">
            <div>
              <textarea data-demo="note" placeholder="Add a note for the capture review."></textarea>
              <div class="note-actions">
                <button class="primary" data-demo="publish">Publish note</button>
                <button data-demo="clear-note">Clear</button>
              </div>
            </div>

            <aside class="note-preview">
              <div class="label">Preview</div>
              <strong data-demo="preview-title">No note published yet</strong>
              <p data-demo="preview-copy">Publish a note to update this panel.</p>
            </aside>
          </div>
        </section>

        <section class="panel section" id="finish">
          <div class="section-heading">
            <div>
              <div class="label">Finish</div>
              <h3>End on one clear state change.</h3>
            </div>
            <p>
              The final action flips the banner into a ready state so a finished capture has one obvious closing beat.
            </p>
          </div>

          <div class="finish-banner" data-demo="finish-banner">
            <div class="label">Ready state</div>
            <strong data-demo="finish-title">Still in review</strong>
            <p data-demo="finish-copy">Nothing has been marked ready yet.</p>
          </div>

          <div class="note-actions">
            <button class="primary" data-demo="ready">Mark ready</button>
            <button data-demo="reset">Reset state</button>
          </div>
        </section>

        <div class="spacer"></div>
      </section>
    </main>

    <script>
      const query = (selector) => document.querySelector(selector);
      const statusTitle = query("[data-demo='status-title']");
      const statusCopy = query("[data-demo='status-copy']");
      const previewTitle = query("[data-demo='preview-title']");
      const previewCopy = query("[data-demo='preview-copy']");
      const note = query("[data-demo='note']");
      const finishBanner = query("[data-demo='finish-banner']");
      const finishTitle = query("[data-demo='finish-title']");
      const finishCopy = query("[data-demo='finish-copy']");
      const reviewCopyState = query("[data-demo='review-copy-state']");
      const reviewSpacingState = query("[data-demo='review-spacing-state']");
      const reviewShellState = query("[data-demo='review-shell-state']");

      const setStatus = (title, copy) => {
        statusTitle.textContent = title;
        statusCopy.textContent = copy;
      };

      query("[data-demo='search']").addEventListener("input", (event) => {
        const value = event.currentTarget.value.trim();
        setStatus(
          value ? 'Filtering for "' + value + '"' : "Ready to capture",
          value
            ? "Search input updated. Save it if you want a visible state change."
            : "Use the top controls, scroll into the notes section, then finish at the bottom action.",
        );
      });

      query("[data-demo='save']").addEventListener("click", () => {
        setStatus("Filter saved", "The search state has been saved into the workspace.");
      });

      query("[data-demo='review-copy']").addEventListener("click", () => {
        reviewCopyState.textContent = "Reviewed and ready for the next pass.";
        setStatus("Copy reviewed", "The copy row was updated.");
      });

      query("[data-demo='review-spacing']").addEventListener("click", () => {
        reviewSpacingState.textContent = "Approved for this capture.";
        setStatus("Spacing approved", "The spacing row now reflects a completed review.");
      });

      query("[data-demo='review-shell']").addEventListener("click", () => {
        reviewShellState.textContent = "Pinned for the release cut.";
        setStatus("Shell pinned", "The browser shell note has been pinned.");
      });

      query("[data-demo='publish']").addEventListener("click", () => {
        const value = note.value.trim();
        previewTitle.textContent = value ? "Published note" : "No note published yet";
        previewCopy.textContent = value || "Publish a note to update this panel.";
        setStatus("Note published", value ? "The note preview was updated." : "The note area is still empty.");
      });

      query("[data-demo='clear-note']").addEventListener("click", () => {
        note.value = "";
        previewTitle.textContent = "No note published yet";
        previewCopy.textContent = "Publish a note to update this panel.";
        setStatus("Note cleared", "The note field was reset.");
      });

      query("[data-demo='ready']").addEventListener("click", () => {
        finishBanner.classList.add("is-ready");
        finishTitle.textContent = "Ready for export";
        finishCopy.textContent = "This workspace is marked ready for the final capture pass.";
        setStatus("Marked ready", "The bottom banner is now in its finished state.");
      });

      query("[data-demo='reset']").addEventListener("click", () => {
        finishBanner.classList.remove("is-ready");
        finishTitle.textContent = "Still in review";
        finishCopy.textContent = "Nothing has been marked ready yet.";
        reviewCopyState.textContent = "Needs a final pass before export.";
        reviewSpacingState.textContent = "Still marked as pending.";
        reviewShellState.textContent = "Minimal chrome, no in-shot controls.";
        previewTitle.textContent = "No note published yet";
        previewCopy.textContent = "Publish a note to update this panel.";
        note.value = "";
        query("[data-demo='search']").value = "";
        setStatus("Ready to capture", "Use the top controls, scroll into the notes section, then finish at the bottom action.");
      });
    </script>
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

  if (answers.projectKind === "local-app") {
    lines.push(
      "  setup: {",
      '    module: "./demo/setup-app.mjs",',
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
  await writeFileIfMissing(path.join(targetDir, "screenstage.config.mjs"), CONFIG_TEMPLATE);
  await writeFileIfMissing(path.join(targetDir, "demo", "starter-demo.mjs"), DEMO_TEMPLATE);
  await writeFileIfMissing(path.join(targetDir, "demo-site", "index.html"), HTML_TEMPLATE);
}

async function writeGuidedProject(answers: InitAnswers): Promise<void> {
  const targetDir = path.resolve(answers.directory);
  const demoFilename =
    answers.projectKind === "static-starter" ? "starter-demo.mjs" : "recording-demo.mjs";

  await writeFileIfMissing(
    path.join(targetDir, "screenstage.config.mjs"),
    buildConfigSource(answers),
  );
  await writeFileIfMissing(
    path.join(targetDir, "demo", demoFilename),
    answers.projectKind === "static-starter"
      ? DEMO_TEMPLATE
      : RECORDING_PLACEHOLDER_TEMPLATE,
  );

  if (answers.projectKind === "local-app") {
    await writeFileIfMissing(
      path.join(targetDir, "demo", "setup-app.mjs"),
      SETUP_PLACEHOLDER_TEMPLATE,
    );
  }

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
