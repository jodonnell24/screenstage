# Troubleshooting

Use this file when Screenstage fails or produces partial output.

## Config Or Argument Failures

Symptoms:

- exit code `2`
- `command_failed` with `INVALID_ARGUMENTS`

Check:

- config path exists
- config exports a default object
- `url` is present and non-empty
- `demo` path is present and valid
- CLI flags were passed in the supported order and format

## Target Unavailable

Symptoms:

- exit code `3`
- timeout waiting for the app URL
- serve command exits before the app is ready

Check:

- target URL is correct
- port matches the real app
- `serve.command` works outside Screenstage
- `readyText` actually appears in the dev server logs
- the timeout is long enough for the app to boot

## Browser Failures

Symptoms:

- exit code `4`
- Chromium launch failure

Check:

- Playwright browser runtime is installed
- the chosen browser channel exists
- headless versus visible mode is appropriate for the environment

Typical fix:

```bash
npx playwright install chromium
```

## Capture Failures

Symptoms:

- exit code `5`
- no source video produced
- manual recording did not complete

Check:

- the page reached a stable loaded state
- the automation path actually finished the manual recorder
- the browser stayed open for the full session

If using `record` programmatically with automation, ensure the automation explicitly finishes or cancels the recorder.

## Render Failures

Symptoms:

- exit code `6`
- capture succeeded but final outputs were not rendered

Check:

- `ffmpeg` exists on `PATH`
- there is enough disk space in the output directory
- the intermediate source video exists

If the run ends as partial success, use the manifest and source artifact paths to inspect what was produced.

## Missing Dependency

Symptoms:

- exit code `7`
- `ffmpeg` not found

Check:

- `ffmpeg` is installed and reachable in the current shell environment

Typical fix:

```bash
ffmpeg -version
```

If that fails, install FFmpeg before retrying.

## Manifest Interpretation

When the run succeeded or partially succeeded, inspect:

- `manifest.json`
- `artifacts.source`
- `artifacts.finalRenders`
- `artifacts.recording`
- `artifacts.generatedDemo`

Do not guess file names if the manifest already exists.

## Practical Recovery Order

When debugging, use this order:

1. inspect the terminal JSON event and exit code
2. inspect the manifest if present
3. confirm the target app was reachable
4. confirm Playwright Chromium is installed
5. confirm `ffmpeg` is available
6. retry with `--output-dir` pointing at a fresh temp folder
