---
name: screenstage
description: Capture polished browser demo videos from local apps, static pages, or deployed URLs with the Screenstage CLI. Use when an agent needs to record a product walkthrough, launch clip, changelog demo, onboarding flow, bug repro video, or other browser-based video artifact from a web app. Trigger on requests to record, render, capture, or generate a browser demo video, especially when the target is localhost, a staging site, or an app in the current repo.
---

# Screenstage

Use Screenstage as the final capture layer for browser-based product videos.

Prefer it when the user wants a polished output artifact, not just browser automation. The core job is: point Screenstage at the right app state, choose `run` or `record`, execute the capture, then hand the caller the manifest and output video paths.

## Quick Start

Use `screenstage run` for scripted, repeatable captures.

Use `screenstage record` for the headed human workflow, especially when:

- the user wants to control the mouse live in the browser
- the camera and cursor movement should come from a human-run session instead of a scripted demo
- you want the same output artifacts, but with the motion captured from a live session

Use `screenstage init` when the repo does not already have a usable `screenstage.config.mjs`.

For agent-safe runs, prefer:

```bash
screenstage run ./path/to/screenstage.config.mjs --json
screenstage record ./path/to/screenstage.config.mjs --json
screenstage init ./demo-project --yes
```

## Workflow

### 1. Find or create the config

Look for an existing `screenstage.config.mjs` first.

If none exists, run:

```bash
screenstage init ./demo-project --yes
```

Then adapt the generated config to the target app.

For concrete config shapes, read [config-patterns.md](./references/config-patterns.md).

### 2. Point Screenstage at the right target

Choose one of these target modes:

- local dev server already running
- local dev server that Screenstage should start with `serve.command`
- static `file://` target for fixture or demo HTML
- deployed or staging URL

If the repo already has a dev command, prefer wiring that into config instead of asking the user to start a server manually.

### 3. Choose `run` or `record`

Choose `run` when:

- the capture should be reproducible
- the flow can be scripted
- the user will likely rerun it during iteration

Choose `record` when:

- the human should steer the browser live in the headed studio workflow
- the cursor and camera motion should come from the live recording session instead of a preprogrammed demo
- the user still wants the same rendered output artifacts afterward

### 4. Prefer machine-facing execution

When acting as an agent, prefer JSON mode and explicit overrides:

```bash
screenstage run ./screenstage.config.mjs --json --output-dir ./tmp/screenstage
screenstage record ./screenstage.config.mjs --json --output-dir ./tmp/screenstage --visible
```

Use `--headless` for unattended scripted runs unless visible mode is necessary for the task.

### 5. Read the result from the manifest

Do not scrape prose logs if `manifest.json` exists.

Use:

- `command_completed` or `command_failed` as the terminal JSON event
- `manifestPath` as the canonical handoff
- manifest artifact paths to locate `final.mp4`, `poster.png`, `contact-sheet.png`, `recording.json`, and generated demo files

If an artifact path in the manifest is relative, resolve it from the session directory. If it is absolute, use it as-is.

For the exact CLI and manifest contract, read [../../docs/cli-contract.md](../../docs/cli-contract.md).

## Output Expectations

Expect these outcomes from successful runs:

- `run` usually produces `final.mp4` plus manifest and marker artifacts
- `record` also produces `recording.json` and generated demo files
- the rendered outputs are the same class of artifacts; the difference is whether motion came from a scripted demo (`run`) or a human-headed live session (`record`)
- if `ffmpeg` is missing, Screenstage can still produce partial outputs and a manifest with a partial completion state

Prefer returning these to the user:

- the main video artifact path
- the manifest path
- one sentence on whether the run was full success, partial success, or cancelled

## Failure Handling

Map failures to the structured contract first:

- exit code `2`: invalid arguments or config
- exit code `3`: target unavailable
- exit code `4`: browser failure
- exit code `5`: capture failure
- exit code `6`: render failure
- exit code `7`: missing dependency

When a run fails, inspect:

- the CLI JSON `command_failed` event
- the config target and output overrides
- whether Playwright Chromium and `ffmpeg` are available
- whether the app became reachable before timeout

For common fixes, read [troubleshooting.md](./references/troubleshooting.md).

## Good Defaults

Prefer these defaults unless the task suggests otherwise:

- `run` over `record` for repeatable feature demos
- `record` when the user explicitly wants to drive the browser live in studio mode
- `--json` for agent execution
- `--output-dir` to keep artifacts isolated from user-owned folders during iteration
- `--headless` for automated runs
- the manifest over ad hoc file guessing

When the user asks for a polished clip but does not specify styling, keep the existing Screenstage presets rather than inventing a custom visual treatment.
