# Screenstage For Agents

Screenstage is a browser demo video tool with two capture paths:

- `run`: motion is preprogrammed in a demo module
- `record`: motion comes from a human driving the browser live in the headed studio workflow

The rendered outputs are the same class of artifacts either way. The difference is where the cursor and camera movement come from.

## What An Agent Should Do

Use Screenstage when the task is to produce a polished browser video artifact, not just automate the browser.

Typical requests:

- record a feature walkthrough
- make a launch clip from localhost
- capture a changelog demo
- turn this app flow into a browser video
- generate a bug repro video

## Choosing `run` Versus `record`

Choose `run` when:

- the flow should be reproducible
- the cursor and camera movement should be authored in code
- the capture is part of an iterative development loop

Choose `record` when:

- the human should control the mouse live
- the studio workflow is the desired recording mode
- the final outputs should still be rendered by Screenstage, but the motion should come from the live session

## Portable Skill

This repo includes a portable Screenstage skill at:

`skills/screenstage/`

That skill is intentionally generic so it can be adapted to other skill-capable agent systems. It teaches:

- when to use Screenstage
- how to choose `run` or `record`
- how to prefer `--json`
- how to use the manifest as the output contract

Key files:

- `skills/screenstage/SKILL.md`
- `skills/screenstage/references/config-patterns.md`
- `skills/screenstage/references/troubleshooting.md`

## Machine Contract

For agent integrations, the CLI contract matters more than the skill packaging.

Useful commands:

```bash
screenstage run ./screenstage.config.mjs --json
screenstage record ./screenstage.config.mjs --json
screenstage init ./demo-project --yes
```

Useful overrides:

```bash
screenstage run ./screenstage.config.mjs --json --output-dir ./tmp/screenstage
screenstage record ./screenstage.config.mjs --json --visible
screenstage run ./screenstage.config.mjs --json --headless
```

The JSON event stream and manifest contract are documented in:

`docs/cli-contract.md`

## Output Handoff

An agent should prefer returning:

- the main video path
- the manifest path
- whether the run ended as `success`, `partial`, or `cancelled`

Do not guess file names if `manifest.json` exists.

Use:

- terminal JSON events for status
- `manifestPath` as the canonical handoff
- manifest artifact paths for output discovery

## Recommended Public Positioning

When describing Screenstage publicly, keep the distinction simple:

- scripted capture with `run`
- human-headed studio capture with `record`
- same output pipeline, different motion source

That framing is cleaner than describing `record` as a collaborative mode.
