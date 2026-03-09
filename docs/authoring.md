# Authoring Guide

## Authoring Model

Your demo module can export either:

- a default async function for full manual control
- a default scene array for declarative shot sequencing

If you want repeatable release-style captures, the scene array is the recommended default.

If you want to avoid hand-building scene arrays for every launch asset, you can also generate them from the built-in templates.

The repo ships with one public example under [../examples/quickstart/README.md](../examples/quickstart/README.md).

Treat authoring choices as framing decisions:

- scene arrays are good when you want explicit structure and deliberate beats
- freeform demo functions are good when you want custom motion and interaction logic
- more camera follow and zoom create emphasis
- less camera follow and lower zoom preserve more context

## Demo Runtime API

Async demo functions receive:

- `page`: the Playwright page
- `cursor`: visible cursor controller
- `camera`: framing controller for post-processing
- `config`: resolved runtime config
- `sessionDir`: output directory for the active run

### Manual Example

```js
export default async function demo({ camera, cursor }) {
  await cursor.moveToSelector("[data-demo='card-1']", {
    durationMs: 950,
    camera: {
      follow: true,
      zoomFrom: 1,
      zoomTo: 1.7,
    },
  });
  await camera.wait(250);
  await cursor.moveToSelector("[data-demo='cta']", {
    durationMs: 800,
    camera: {
      follow: true,
      zoomFrom: 1.7,
      zoomTo: 1.9,
    },
  });
  await cursor.click();
  await camera.zoomOut({ durationMs: 700, followCursor: true });
}
```

You can also stage camera timing inside a single move:

```js
await cursor.moveToSelector("[data-demo='search']", {
  durationMs: 1600,
  camera: {
    follow: true,
    timingPreset: "late-arrival",
    zoomFrom: 1,
    zoomTo: 1.8,
  },
});
```

Built-in move timing presets:

- `"continuous"`: follow and zoom through the whole move
- `"late-arrival"`: stay broader early, then tighten near arrival
- `"depart-reveal"`: widen earlier as the cursor departs, then travel broader
- `"settle"`: slower handoff suited to smaller local corrections or hover-heavy beats

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
    cameraFollow: true,
    timingPreset: "late-arrival",
    zoomFrom: 1,
    zoomTo: 1.9,
  },
  {
    type: "click",
  },
  {
    type: "zoom-out",
    durationMs: 700,
    followCursor: true,
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
- `zoom-to`
- `zoom-out`
- `click`
- `click-selector`
- `type`
- `type-selector`
- `wait`

`wait.target` accepts `"cursor"`, `"camera"`, or `"both"`.

## Templates

Template helpers generate scene arrays for common flows:

- `createFeatureTour()`: guided multi-step product tours with travel between selectors
- `createFormFillCapture()`: steadier form-entry and submit flows
- `createHeroWalkthrough()`: a more presentation-led landing-page or hero sequence

### Hero Walkthrough Example

```js
import { createHeroWalkthrough } from "screenstage";

export default createHeroWalkthrough({
  fieldSelector: "[data-demo='email']",
  fieldText: "hello@getrestocky.com",
  ctaSelector: "[data-demo='cta']",
  metricSelector: "[data-demo='card-2']",
});
```

### Feature Tour Example

```js
import { createFeatureTour } from "screenstage";

export default createFeatureTour({
  introPauseMs: 500,
  steps: [
    {
      selector: "[data-demo='email']",
      action: "type",
      text: "hello@getrestocky.com",
      zoom: 2,
    },
    {
      selector: "[data-demo='cta']",
      action: "click",
      zoom: 1.8,
    },
    {
      selector: "[data-demo='card-2']",
      action: "move",
      cameraFollow: true,
      zoom: 1.8,
      pauseMs: 900,
      pauseTarget: "camera",
    },
  ],
});
```

## Cursor Helpers

- `cursor.move({ x, y }, options)`
- `cursor.moveToSelector(selector, options)`
- `cursor.click(options)`
- `cursor.clickSelector(selector, options)`
- `cursor.type(text, options)`
- `cursor.typeSelector(selector, text, options)`
- `cursor.wait(durationMs)`
- `cursor.sample(kind)`

You can also import move timing helpers directly:

```js
import { createCameraMoveTiming } from "screenstage";

await cursor.moveToSelector("[data-demo='search']", {
  durationMs: 1600,
  camera: {
    follow: true,
    zoomFrom: 1,
    zoomTo: 1.8,
    ...createCameraMoveTiming("late-arrival", {
      followEnd: 0.96,
    }),
  },
});
```

## Camera Helpers

- `camera.focus({ x, y }, options)`
- `camera.focusSelector(selector, options)`
- `camera.followCursor(options)`
- `camera.wide(options)`
- `camera.wait(durationMs)`
- `camera.sample(kind)`

If you want a traditional non-followed browser recording with the composition shell still applied, set:

```js
camera: {
  mode: "static",
  zoom: 1,
}
```

## Framing Guidance

Use these as tradeoffs, not defaults:

- use a source viewport around `1440x900` and render at `1920x1080` when you want a normal desktop capture baseline
- use `output.preset` for repeatable delivery targets instead of hand-tuning every config
- pause deliberately with `cursor.wait()` or `camera.wait()` so the camera has time to settle
- use `camera.focusSelector()` when a specific interaction deserves emphasis
- increase `camera.smoothingMs` if cursor-led motion feels too twitchy, or reduce it if it feels too slow
- switch `camera.mode` to `"static"` when the goal is full-page readability rather than cursor-led motion
- use `cursor.typeSelector()` for form entries so the footage reads like a real person using the app
- export `prores` when the clip is headed into Motion or Final Cut for finishing

## Current Scope

Implemented now:

- real browser recording
- realistic cursor overlay
- hover-aware cursor variants
- manual camera keyframes
- declarative scene arrays
- local dev-server lifecycle
- browser-shell composition presets
- smoother cursor-led camera tracking
- reusable output presets
- reusable scene templates
- poster frame and contact sheet review artifacts
- MP4 and ProRes rendering
- starter scaffold

Not implemented yet:

- Remotion pipeline
- transparent-alpha export
- timeline editor or a more advanced scene DSL beyond the current script API
