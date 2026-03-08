# Motion Creator

TypeScript CLI for producing polished browser-product demos from any web app.

It is designed for the workflow you described:

- record real browser interactions against any web-based UI
- keep the cursor visible in the footage with a professional-looking overlay
- direct the camera toward important UI moments instead of relying only on raw cursor-following
- author demos as a sequence of named shots instead of one long imperative script
- present the capture inside a browser-style composition shell before it reaches Motion
- export lightweight review MP4s and edit-friendly ProRes files for Apple Motion / Final Cut Pro

This is a Playwright + FFmpeg pipeline. It works with React apps and non-React web apps because it records the browser, not the framework.

## What It Does

- Opens a real Chromium page with Playwright.
- Can optionally start a local dev server, wait for it to come up, and shut it down after capture.
- Records the live session as source video.
- Injects a cursor overlay that behaves more like a real mouse:
  - arrow cursor by default
  - hand cursor over interactive elements
  - text caret over text inputs
  - click ripple and press feedback
- Lets your demo script control:
  - cursor movement
  - clicking
  - human-looking typing
  - camera focus / wide shots / reframing
  - shot-by-shot scene sequencing
- Post-processes the recording in FFmpeg into:
  - a composed browser presentation shell with background and chrome presets
  - `mp4` for fast review/sharing
  - `prores` for Motion / Final Cut editing

Pipeline 2, the fully rendered Remotion approach, is still not implemented.

## Requirements

- Node.js 22+
- `ffmpeg` on `PATH`
- Playwright Chromium runtime

Install:

```bash
npm install
npx playwright install chromium
```

## Quick Start

Build the CLI:

```bash
npm run build
```

Scaffold a starter project:

```bash
node dist/cli.js init ./demo-project
```

Run the starter demo:

```bash
node dist/cli.js run ./demo-project/motion.config.mjs
```

Each run creates a timestamped folder inside the configured output directory with artifacts like:

- `source.webm`
- `final.mp4`
- `final-prores.mov`
- `timeline.json`

## CLI

```bash
motion-creator init [directory]
motion-creator run <config-path>
```

Development shortcuts:

```bash
npm run dev -- init ./demo-project
npm run dev -- run ./demo-project/motion.config.mjs
```

`init` is non-destructive. It only writes starter files that do not already exist.

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
    formats: ["mp4", "prores"],
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
```

### Config Notes

- `url` can point to any reachable web app, including local HTML files, local dev servers, or deployed apps.
- `output.formats` accepts:
  - `"mp4"` for lightweight H.264 output
  - `"prores"` for high-quality `.mov` output that is better suited for Motion / Final Cut
- `camera.zoom` is the default follow-cam zoom when you are not manually keyframing the camera.
- `camera.padding` keeps the target away from the crop edge.
- `composition.preset` controls the presentation shell around the app capture.

Current composition presets:

- `"none"`: raw full-frame render with no presentation shell
- `"studio-browser"`: soft light background with polished browser chrome
- `"spotlight-browser"`: darker, more cinematic presentation shell

For local apps you can add a `serve` block:

```js
export default {
  url: "http://127.0.0.1:3000",
  demo: "./demo/starter-demo.mjs",
  serve: {
    command: "npm run dev",
    cwd: ".",
    readyText: "ready",
    timeoutMs: 30000,
  },
};
```

`serve.command` is started before capture, the tool waits for `url` to respond, and the process is shut down when recording finishes.

## Authoring Model

Your demo module can export either:

- a default async function for full manual control
- a default scene array for declarative shot sequencing

If you want repeatable release-style captures, the scene array is now the recommended default.

## Demo Runtime API

Async demo functions receive:

- `page`: the Playwright page
- `cursor`: visible cursor controller
- `camera`: framing controller for post-processing
- `config`: resolved runtime config
- `sessionDir`: output directory for the active run

Manual example:

```js
export default async function demo({ camera, cursor }) {
  await camera.wide({ durationMs: 400 });
  await cursor.wait(600);

  await camera.focusSelector("[data-demo='email']", {
    durationMs: 850,
    zoom: 2,
  });

  await cursor.typeSelector(
    "[data-demo='email']",
    "hello@getrestocky.com",
    { durationMs: 900, delayMs: 75 },
  );

  await camera.followCursor({ durationMs: 300 });
  await cursor.moveToSelector("[data-demo='cta']", { durationMs: 850 });
  await cursor.click();
}
```

## Scene API

Scene programs are exported as a plain array:

```js
export default [
  {
    type: "wide",
    durationMs: 400,
    label: "Start on a broad establishing shot",
  },
  {
    type: "focus-selector",
    selector: "[data-demo='email']",
    durationMs: 850,
    zoom: 2,
  },
  {
    type: "type-selector",
    selector: "[data-demo='email']",
    text: "hello@getrestocky.com",
    durationMs: 900,
    delayMs: 75,
  },
  {
    type: "follow-cursor",
    durationMs: 300,
  },
  {
    type: "move-selector",
    selector: "[data-demo='cta']",
    durationMs: 850,
  },
  {
    type: "click",
  },
  {
    type: "wait",
    durationMs: 800,
    target: "camera",
  },
];
```

Supported scene types:

- `wide`
- `follow-cursor`
- `focus-selector`
- `focus-point`
- `move-selector`
- `move-point`
- `click`
- `click-selector`
- `type`
- `type-selector`
- `wait`

`wait.target` accepts `"cursor"`, `"camera"`, or `"both"`.

### Cursor Helpers

- `cursor.move({ x, y }, options)`
- `cursor.moveToSelector(selector, options)`
- `cursor.click(options)`
- `cursor.clickSelector(selector, options)`
- `cursor.type(text, options)`
- `cursor.typeSelector(selector, text, options)`
- `cursor.wait(durationMs)`
- `cursor.sample(kind)`

### Camera Helpers

- `camera.focus({ x, y }, options)`
- `camera.focusSelector(selector, options)`
- `camera.followCursor(options)`
- `camera.wide(options)`
- `camera.wait(durationMs)`
- `camera.sample(kind)`

## Recommended Workflow

For strong release-style captures:

- Use a source viewport around `1440x900` and render at `1920x1080`.
- Pause deliberately with `cursor.wait()` or `camera.wait()` so the camera has time to settle.
- Use `camera.focusSelector()` before important interactions instead of letting every shot be cursor-led.
- Use `cursor.typeSelector()` for form entries so the footage reads like a real person using the app.
- Export `prores` when the clip is headed into Motion or Final Cut for finishing.

## Current Scope

Implemented now:

- real browser recording
- realistic cursor overlay
- hover-aware cursor variants
- manual camera keyframes
- declarative scene arrays
- local dev-server lifecycle
- browser-shell composition presets
- MP4 + ProRes rendering
- starter scaffold

Not implemented yet:

- Remotion pipeline
- transparent-alpha export
- browser-frame compositing
- timeline editor / scene DSL beyond the current script API
