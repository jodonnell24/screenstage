import fs from "node:fs/promises";
import path from "node:path";

const CONFIG_TEMPLATE = `export default {
  name: "starter-demo",
  url: new URL("./demo-site/index.html", import.meta.url).href,
  demo: "./demo/starter-demo.mjs",
  // For local apps, switch url to your local server and uncomment serve:
  // url: "http://127.0.0.1:3000",
  // serve: {
  //   command: "npm run dev",
  //   cwd: ".",
  //   readyText: "ready",
  // },
  viewport: {
    width: 1440,
    height: 900,
  },
  output: {
    dir: "./output",
    preset: "release-hero",
  },
  camera: {
    zoom: 1.7,
    padding: 96,
  },
  composition: {
    preset: "studio-browser",
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

async function writeFileIfMissing(filePath: string, contents: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contents, "utf8");
  }
}

export async function initProject(directory = "."): Promise<void> {
  const targetDir = path.resolve(directory);

  await writeFileIfMissing(
    path.join(targetDir, "motion.config.mjs"),
    CONFIG_TEMPLATE,
  );
  await writeFileIfMissing(
    path.join(targetDir, "demo", "starter-demo.mjs"),
    DEMO_TEMPLATE,
  );
  await writeFileIfMissing(
    path.join(targetDir, "demo-site", "index.html"),
    HTML_TEMPLATE,
  );
}
