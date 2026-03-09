# Config Reference

`screenstage.config.mjs` exports a default object:

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
    preset: "release-hero",
  },
  camera: {
    preset: "showcase-follow",
    zoom: 1.7,
  },
  composition: {
    preset: "studio-browser",
    device: "desktop",
    background: {
      preset: "soft-studio",
    },
    browser: {
      domain: "app.example.com",
      style: "polished",
    },
  },
  browser: {
    capture: {
      mode: "video",
    },
    cursor: {
      mode: "motion",
    },
    headless: true,
    studio: {
      enabled: true,
    },
  },
  timing: {
    settleMs: 900,
  },
};
```

## Config Notes

- `url` can point to any reachable web app, including local HTML files, local dev servers, or deployed apps.
- `output.preset` gives you sensible defaults for common delivery targets. You can still override `width`, `height`, `fps`, or `formats` manually when a preset is close but not exact.
- `output.formats` accepts `"mp4"` and `"prores"`.
- `camera.zoom` is the default follow-cam zoom when you are not manually keyframing the camera.
- `camera.preset` gives you a tuned baseline before any manual overrides.
- `camera.mode` can be `"follow"` or `"static"`.
- `camera.padding` keeps the target away from the crop edge.
- `camera.smoothingMs` softens raw cursor-led camera tracking.
- `camera.deadzonePx` prevents tiny cursor changes from nudging the camera.
- `camera.verticalWeight` lets the follow cam react less aggressively to small vertical cursor noise.
- `composition.preset` controls the presentation shell around the app capture.
- `composition.device` controls whether that shell is a desktop browser or a phone frame.
- `composition.background.colors` and `composition.background.angle` control the shell background.
- `composition.background.preset` gives you named backdrop looks without hand-picking gradient stops.
- `composition.browser.domain` sets the label shown in the browser address bar.
- `composition.browser.style` changes the desktop browser chrome mood.
- `browser.studio.enabled` wraps local targets in a same-origin studio shell so the recorder controls sit outside the captured app stage.
- `browser.studio.controlsWidth` and `browser.studio.padding` tune that wrapper layout.
- `browser.capture.mode` controls manual recording fidelity: `video`, `balanced`, or `rgb-frames`.
- `browser.cursor.mode` controls which cursor ends up in the recording: `motion` or `app`.
- `browser.cursor.hideSelectors` lets you hide custom DOM cursor layers when you want Screenstage's cursor but the app also renders its own follower elements.
- `setup` lets you put the app into the right pre-record state before capture starts.

## Presets

### Camera Presets

- `"showcase-follow"`: balanced default for release-style motion with calmer hover behavior
- `"tight-follow"`: more responsive for compact UI and faster travel
- `"lazy-follow"`: slower, calmer tracking for broad navigation or hover-heavy sequences
- `"static"`: fixed framing with no follow-cam movement

### Output Presets

- `"release-hero"`: 1920x1080, 30 fps, `mp4` + `prores`
- `"social-square"`: 1080x1080, 30 fps, `mp4`
- `"social-vertical"`: 1080x1920, 30 fps, `mp4`
- `"motion-edit"`: 2560x1440, 30 fps, `mp4` + `prores`

### Composition Presets

- `"none"`: raw full-frame render with no presentation shell
- `"studio-browser"`: soft light background with polished browser chrome
- `"spotlight-browser"`: darker, more cinematic presentation shell

### Composition Devices

- `"desktop"`: browser-window shell that scales proportionally with the output size
- `"phone"`: mobile-device shell for portrait exports and phone-sized viewports

### Background Presets

- `"soft-studio"`: airy neutral green-blue backdrop
- `"warm-editor"`: warmer editorial paper-and-sky mix
- `"cool-stage"`: cooler product-launch backdrop
- `"midnight-fade"`: dark cinematic stage

### Browser Styles

- `"polished"`: balanced default with fuller chrome and depth
- `"minimal"`: quieter shell with less glow and ornament
- `"glass"`: brighter, more luminous shell treatment

## Examples

### Shell Customization

```js
composition: {
  preset: "studio-browser",
  device: "desktop",
  background: {
    preset: "warm-editor",
  },
  browser: {
    domain: "launch.example.com",
    style: "glass",
  },
}
```

### Phone Shell

```js
composition: {
  preset: "studio-browser",
  device: "phone",
  phone: {
    color: "#10141a",
  },
}
```

### Local App With Managed Dev Server

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

### Camera Override

```js
camera: {
  preset: "lazy-follow",
  zoom: 1.45,
}
```

## Setup Hooks

`setup` is the pre-capture state layer. It is meant for getting a real app into the right browser state before recording starts, not for editing the final video.

### Declarative Example

```js
setup: {
  route: "/docs/palette-lab",
  query: {
    mode: "dark",
    panel: "tokens",
  },
  colorScheme: "dark",
  localStorage: {
    "duotone:theme": "dark",
    "duotone:last-tab": "tokens",
  },
  sessionStorage: {
    "motion:capture": "true",
  },
  waitFor: {
    selector: "[data-ready='true']",
    timeoutMs: 10000,
  },
},
```

### Setup Module

```js
setup: {
  module: "./demo/setup-app.mjs",
},
```

Setup modules export a default async function and receive:

- `config`
- `context`
- `page`
- `target`
- `sessionDir`
- `url`

`target` is the actual app surface:

- the page itself in normal captures
- the embedded app frame in studio mode

Example:

```js
export default async function setup({ target }) {
  await target.click("[data-demo='open-auth-bypass']");
  await target.waitForSelector("[data-demo='dashboard']");
}
```

Manual overrides still win, so you can start from a preset and then tune just one value:

```js
camera: {
  preset: "showcase-follow",
  deadzonePx: 28,
  smoothingMs: 250,
}
```

## Manual Record Mode

`record` is the human-headed capture path:

1. Launch the target app in a visible Chromium window.
2. Inject the polished cursor overlay and recorder controls.
3. Perform the flow manually.
4. Tag camera beats while you record.
5. Finish from the controls or press `Alt+Shift+R`.
6. Get an immediate rendered video plus an editable generated demo file.

When `browser.studio.enabled` is on, the app is loaded inside a local wrapper page and only the iframe stage is recorded. That is the recommended setup for local dev tools because the controls stay outside the shot while still feeling integrated.

On machines with `ffmpeg` installed, manual recordings can use one of three paths:

- `video`: the stable default using Playwright's browser-video capture
- `balanced`: JPEG frames plus a high-quality intermediate
- `rgb-frames`: PNG frames plus a lossless RGB intermediate for maximum fidelity

For real local apps, the current recommendation is:

- `browser.capture.mode: "video"`
- a larger source viewport like `1728x1080` on desktop
- `output.preset: "motion-edit"` with both `mp4` and `prores`

Built-in shot markers:

- `Alt+Shift+1`: `Wide`
- `Alt+Shift+2`: `Punch In`
- `Alt+Shift+3`: `Hold`

Manual record sessions save these extra artifacts:

- `recording.json`: raw captured actions and cursor samples
- `generated-demo.mjs`: a generated runnable demo module in the session folder
- `*.recorded-<timestamp>.mjs`: a copy of that generated demo saved next to your configured demo file so you can edit and reuse it
