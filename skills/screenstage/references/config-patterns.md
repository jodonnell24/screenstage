# Config Patterns

Use these patterns when adapting or creating `screenstage.config.mjs`.

## 1. Local App With Existing Dev Server

Use this when the app is already running and the user wants a quick capture.

```js
export default {
  name: "dashboard-demo",
  url: "http://127.0.0.1:3000",
  demo: "./demo/dashboard-demo.mjs",
  output: {
    dir: "./output",
    preset: "release-hero",
  },
  browser: {
    headless: true,
  },
};
```

## 2. Local App Started By Screenstage

Use this when the repo has a known dev command and the app should be booted as part of capture.

```js
export default {
  name: "dashboard-demo",
  url: "http://127.0.0.1:3000",
  demo: "./demo/dashboard-demo.mjs",
  serve: {
    command: "npm run dev",
    readyText: "ready",
    timeoutMs: 30000,
  },
  output: {
    dir: "./output",
    preset: "release-hero",
  },
};
```

Tips:

- prefer `readyText` when the dev server logs a stable readiness line
- keep `url` explicit even when `serve.command` is present
- if the app binds a different port, match it exactly

## 3. Static Demo Or Fixture HTML

Use this when the repo contains a static page, fixture, or demo site.

```js
export default {
  name: "static-demo",
  url: new URL("./demo-site/index.html", import.meta.url).href,
  demo: "./demo/static-demo.mjs",
  browser: {
    headless: true,
  },
};
```

This is the simplest path for smoke tests and documentation examples.

## 4. Staging Or Production URL

Use this when the app state already exists on a deployed environment.

```js
export default {
  name: "staging-demo",
  url: "https://staging.example.com",
  demo: "./demo/staging-demo.mjs",
  output: {
    dir: "./output",
    preset: "release-hero",
  },
};
```

Add setup if the page needs query params, routing, or preloaded storage before capture.

## 5. Agent-Friendly Run Overrides

Prefer CLI overrides instead of rewriting config when the change is ephemeral.

Examples:

```bash
screenstage run ./screenstage.config.mjs --json --output-dir ./tmp/screenstage
screenstage record ./screenstage.config.mjs --json --visible
screenstage run ./screenstage.config.mjs --json --headless
```

Use these for:

- isolated temp outputs
- switching visible versus headless behavior
- keeping user-owned config stable during agent iteration

## 6. Choosing `run` Versus `record`

Use `run` when you can script the flow cleanly.

Good fits:

- homepage walkthrough
- launch clip
- feature changelog demo
- onboarding path that will be rerun

Use `record` when the flow is easier to perform live or the user wants to refine the generated demo afterward.

Good fits:

- exploratory UX walkthrough
- manual bug repro capture
- quick product narrative assembled live

## 7. Output And Composition Defaults

Use built-in presets unless the user has a specific delivery target.

Good starting points:

- `release-hero` for normal landscape demos
- `social-square` for square exports
- `social-vertical` for portrait exports
- `studio-browser` for a polished browser-shell presentation

Avoid hand-tuning widths, heights, and camera parameters unless the preset is clearly wrong for the task.

## 8. Camera Choice Guidance

Treat camera options as tradeoffs, not quality rankings.

Use more cursor-led follow behavior when:

- the user wants a cinematic, guided product demo
- the action happens in small UI regions
- the point is to emphasize specific controls or form fields

Use calmer or more static framing when:

- the user needs more page context
- the app layout matters as much as the interaction
- the flow includes broad navigation, dashboards, or large page sections

Useful controls:

- `camera.mode: "follow"`: cursor-led reframing
- `camera.mode: "static"`: fixed framing
- lower `camera.zoom`: more context
- higher `camera.zoom`: more emphasis
- calmer presets like `lazy-follow`: slower reframing
- tighter presets like `tight-follow`: more aggressive reframing

If the user did not specify taste and the choice will materially change how understandable the video is, ask or make the smallest reasonable assumption instead of treating a preset name as a universal best practice.
