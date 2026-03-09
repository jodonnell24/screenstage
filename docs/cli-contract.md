# Screenstage CLI Contract

This document defines the first machine-facing contract for Screenstage.

## Scope

Current support:

- `screenstage run <config-path> --json`
- `screenstage record <config-path> --json`

Current non-goals:

- `init --json`

`run --json` and `record --json` are the first stable agent-facing paths.

## JSON Event Stream

When `--json` is passed to `screenstage run` or `screenstage record`, Screenstage writes newline-delimited JSON events to stdout.

Each line is one JSON object with an `event` field.

Human-readable renderer diagnostics are written to stderr when present and are not part of the JSON event stream. FFmpeg now runs in error-only mode by default, so successful renders should not spam progress output.

### Events

`command_started`

```json
{
  "event": "command_started",
  "command": "run",
  "configPath": "/abs/path/to/screenstage.config.mjs",
  "outputDir": "./output",
  "sessionDir": "output/demo-2026-03-09T12-00-00.000Z"
}
```

`service_started`

```json
{
  "event": "service_started",
  "command": "run",
  "configPath": "/abs/path/to/screenstage.config.mjs",
  "targetUrl": "http://127.0.0.1:3000"
}
```

`browser_started`

```json
{
  "event": "browser_started",
  "command": "run",
  "browserChannel": "chromium",
  "headless": true
}
```

`capture_started`

```json
{
  "event": "capture_started",
  "command": "run",
  "captureUrl": "http://127.0.0.1:3000",
  "viewport": {
    "width": 1440,
    "height": 900
  }
}
```

`capture_completed`

```json
{
  "event": "capture_completed",
  "command": "run",
  "sourceVideoPath": "output/demo/source.webm"
}
```

`render_started`

```json
{
  "event": "render_started",
  "command": "run",
  "plannedOutputs": [
    {
      "format": "mp4",
      "outputPath": "output/demo/final.mp4"
    }
  ]
}
```

`artifacts_written`

```json
{
  "event": "artifacts_written",
  "command": "run",
  "manifestPath": "output/demo/manifest.json",
  "sessionDir": "output/demo",
  "artifacts": {
    "source": {
      "path": "source.webm",
      "type": "source-video"
    }
  }
}
```

`render_completed`

```json
{
  "event": "render_completed",
  "command": "run",
  "durationMs": 18452,
  "manifestPath": "output/demo/manifest.json"
}
```

`command_completed`

```json
{
  "event": "command_completed",
  "command": "run",
  "durationMs": 18452,
  "manifestPath": "output/demo/manifest.json",
  "sessionDir": "output/demo",
  "status": "success"
}
```

If `ffmpeg` is unavailable, Screenstage still writes a manifest and finishes with:

```json
{
  "event": "command_completed",
  "command": "run",
  "durationMs": 9421,
  "manifestPath": "output/demo/manifest.json",
  "sessionDir": "output/demo",
  "status": "partial",
  "warning": "ffmpeg_missing"
}
```

`command_failed`

```json
{
  "event": "command_failed",
  "command": "run",
  "code": "TARGET_UNAVAILABLE",
  "exitCode": 3,
  "message": "Timed out waiting for http://127.0.0.1:3000 to respond."
}
```

## Exit Codes

- `0`: success
- `2`: invalid arguments or invalid config
- `3`: target unavailable or dev server did not become ready
- `4`: browser launch failure
- `5`: capture failure
- `6`: render failure
- `7`: required dependency missing

## Manifest Contract

Each successful `run` writes `manifest.json` inside the session directory.
Each successful `record` also writes `manifest.json` unless the manual recording was explicitly cancelled.

Important fields:

- `schemaVersion`: current manifest version
- `session.dir`: absolute session directory path
- `session.name`: session folder name
- `captureUrl`: resolved URL used for capture
- `config`: compact summary of the resolved config
- `artifacts`: relative paths to generated outputs
- artifact paths are relative when the file lives inside the session directory and absolute when it lives elsewhere
- `markers`: marker summary
- `durationSeconds`: video duration when available

### Example

```json
{
  "schemaVersion": 1,
  "mode": "run",
  "createdAt": "2026-03-09T12:00:00.000Z",
  "session": {
    "name": "demo-2026-03-09T12-00-00.000Z",
    "dir": "/abs/path/to/output/demo-2026-03-09T12-00-00.000Z"
  },
  "captureUrl": "http://127.0.0.1:3000",
  "config": {
    "name": "demo",
    "outputPreset": "release-hero",
    "fps": 30,
    "viewport": {
      "width": 1440,
      "height": 900
    }
  },
  "camera": {
    "mode": "follow",
    "preset": "showcase-follow",
    "zoom": 1.75
  },
  "composition": {
    "preset": "studio-browser",
    "device": "desktop"
  },
  "markerCount": 2,
  "markers": [
    {
      "label": "Feature ready",
      "source": "scene",
      "timeMs": 1800,
      "type": "focus"
    }
  ],
  "artifacts": {
    "source": {
      "path": "source.webm",
      "type": "source-video"
    },
    "timeline": {
      "path": "timeline.json",
      "type": "timeline"
    },
    "finalRenders": [
      {
        "path": "final.mp4",
        "type": "final-mp4"
      }
    ]
  }
}
```

## Integration Guidance

For agent integrations:

- use `command_completed` or `command_failed` as the terminal event
- use `manifestPath` as the canonical handoff into artifact inspection
- resolve artifact paths relative to the manifest's session directory unless the artifact path is already absolute
- prefer the manifest over shell log parsing

## CLI Overrides

The following flags now override config file behavior for `run` and `record`:

- `--output-dir <path>`
- `--headless`
- `--visible`

For `init`, agents can avoid prompts with:

- `--yes`
