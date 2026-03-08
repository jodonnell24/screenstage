# Motion Creator

TypeScript CLI for generating cursor-following product demos with Playwright and FFmpeg.

The MVP implements Pipeline 1 from the original concept:

- Playwright opens a real Chromium page and records the session.
- A DOM cursor overlay is injected into the page so the cursor is visible in the recording.
- Your demo script drives the interaction through a typed cursor API.
- Cursor samples are converted into an FFmpeg crop expression that pans and zooms toward the action.
- The final output is a standard H.264 MP4 that can be dropped into Apple Motion or Final Cut.

Pipeline 2, the Remotion renderer, is not implemented yet.

## Requirements

- Node.js 22+
- `ffmpeg` on `PATH`
- Playwright Chromium runtime

Install project dependencies:

```bash
npm install
npx playwright install chromium
```

## Quick start

Scaffold a starter project:

```bash
node dist/cli.js init ./demo-project
```

Build the CLI:

```bash
npm run build
```

Run the starter render:

```bash
node dist/cli.js run ./demo-project/motion.config.mjs
```

The run creates a timestamped folder under your configured output directory with:

- `source.webm`: raw Playwright capture
- `final.mp4`: FFmpeg follow-cam render
- `timeline.json`: recorded cursor samples and generated FFmpeg plan

## Commands

```bash
motion-creator init [directory]
motion-creator run <config-path>
```

During development you can also use:

```bash
npm run dev -- init ./demo-project
npm run dev -- run ./demo-project/motion.config.mjs
```

## Config

`motion.config.mjs` exports a default object:

```js
export default {
  name: "starter-demo",
  url: new URL("./demo-site/index.html", import.meta.url).href,
  demo: "./demo/starter-demo.mjs",
  viewport: {
    width: 1440,
    height: 900,
  },
  output: {
    dir: "./output",
    width: 1920,
    height: 1080,
    fps: 30,
  },
  camera: {
    zoom: 1.7,
    padding: 96,
  },
  browser: {
    headless: true,
  },
  timing: {
    settleMs: 900,
  },
};
```

## Demo API

Your demo module exports a default async function. It receives:

- `page`: the Playwright page
- `cursor`: a typed controller for visible motion
- `config`: the resolved runtime config
- `sessionDir`: the output folder for the active run

Example:

```js
export default async function demo({ cursor, page }) {
  await cursor.wait(600);
  await cursor.moveToSelector("[data-demo='email']", { durationMs: 900 });
  await cursor.click();
  await page.locator("[data-demo='email']").fill("hello@getrestocky.com");

  await cursor.wait(350);
  await cursor.moveToSelector("[data-demo='cta']", { durationMs: 850 });
  await cursor.click();
  await cursor.wait(1000);
}
```

Available cursor helpers:

- `cursor.move({ x, y }, options)`
- `cursor.moveToSelector(selector, options)`
- `cursor.click(options)`
- `cursor.clickSelector(selector, options)`
- `cursor.wait(durationMs)`
- `cursor.sample(kind)`

For the camera to track smoothly, prefer the cursor helpers over raw `page.mouse` calls.

## Notes

- The camera expression is intentionally simplified for MVP reliability. It samples and condenses cursor motion before generating the FFmpeg crop formula.
- Playwright records a raw WebM source. FFmpeg transcodes that into the final MP4.
- The starter scaffold includes a deterministic local HTML page so the tool can be exercised without a dev server.
