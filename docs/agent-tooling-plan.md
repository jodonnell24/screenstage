# Screenstage Agent Tooling Plan

## Goal

Turn Screenstage from a strong human-operated CLI into a reliable tool that AI agents and vibe-coding workflows can use without guesswork.

The target outcome is not just "an AI can run the CLI." The target outcome is:

- an agent can discover the tool quickly
- an agent can choose the right workflow without reading the whole codebase
- an agent can run captures non-interactively
- an agent can inspect results through structured outputs
- an agent can recover from common failures
- the integration surface is stable enough to support Codex skills now and broader agent ecosystems later

## Product Positioning

Screenstage should be framed as:

- a browser demo capture engine
- a polished rendering pipeline for product videos
- an agent-friendly automation primitive for generating app walkthroughs, launch demos, changelog clips, and onboarding footage

That positioning matters because agents do not need "video editing software." They need a dependable tool that accepts a target app plus capture intent and returns artifacts they can reason about.

## Core Recommendation

Build this in three layers, in order:

1. Harden the CLI contract for non-interactive, machine-friendly use.
2. Add a Codex skill that teaches the workflow and wraps the CLI.
3. Add a broader integration surface only after the CLI contract is stable.

The likely broader surface is either:

- a small JavaScript API if the main audience is developers embedding Screenstage in scripts
- an MCP server if the goal is cross-agent interoperability across editors and AI runtimes

Do not start with MCP. A weak core contract wrapped in MCP is still weak. The first job is making the existing CLI predictable for agents.

## Why A Skill Is Worth Doing

A skill is the fastest path to immediate utility because it can teach an agent:

- when to use `screenstage init`
- when to use `screenstage run`
- when to use `screenstage record`
- how to scaffold a config
- how to point Screenstage at a local app or static file
- how to inspect `manifest.json`, markers, and output assets
- how to debug common local failures around Playwright, FFmpeg, and dev servers

This is especially useful in vibe-coding environments where the agent is already editing code, running a dev server, and automating the browser. Screenstage becomes the final output layer for "turn this finished flow into a polished demo."

## Why A Skill Alone Is Not Enough

A skill improves discoverability and workflow guidance, but it does not solve:

- ambiguous CLI behavior
- brittle stdout parsing
- interactive prompts in agent runs
- unclear exit conditions
- unstable artifact locations
- poor machine-readable error reporting

That is why the skill should be considered an orchestration layer, not the foundation.

## Phase 1: Agent-Ready CLI Contract

### Objective

Make `screenstage` safe for unattended runs and easy for agents to integrate with from shell execution.

### Changes

#### 1. Add structured output mode

Add a `--json` flag to every command where practical.

Expected behavior:

- emit newline-delimited JSON events or a single final JSON object
- include command name, config path, output directory, artifact paths, elapsed time, and status
- include structured errors with code, message, and likely remediation hint

Recommended event model:

- `command_started`
- `server_started`
- `browser_started`
- `capture_started`
- `capture_completed`
- `render_started`
- `render_completed`
- `artifacts_written`
- `command_completed`
- `command_failed`

#### 2. Add explicit non-interactive controls

Add flags that remove any ambiguity in agent contexts:

- `--yes` or `--non-interactive` for `init`
- `--output-dir <path>`
- `--headless`
- `--no-open`
- `--browser visible|headless` if you want a more expressive alternative
- `--timeout <ms>`

If `record` cannot be fully non-interactive by design, document that clearly and make its machine limits explicit.

#### 3. Define stable exit codes

Suggested exit code categories:

- `0`: success
- `2`: invalid config or arguments
- `3`: app target unavailable
- `4`: browser launch or Playwright failure
- `5`: capture failure
- `6`: FFmpeg/render failure
- `7`: dependency missing, such as `ffmpeg`

Agents can make much better recovery decisions if these are stable.

#### 4. Normalize artifact discovery

Make sure every successful run writes a machine-readable manifest with stable keys.

The existing `manifest.json` is already the right direction. Tighten it into a public contract:

- input metadata
- resolved config summary
- output directory
- artifact file paths
- marker summary
- timing summary
- warnings
- failure details if partial output exists

This manifest should be the canonical integration object.

#### 5. Improve error messages for agent recovery

Every major failure should include:

- what failed
- why it likely failed
- what the caller should try next

Examples:

- app server did not become reachable before timeout
- Chromium runtime not installed
- `ffmpeg` missing from `PATH`
- selector in demo script no longer matched
- viewport or composition config invalid

### Deliverables

- CLI flags implemented
- structured JSON output implemented
- documented exit codes
- manifest contract documented
- README updated with agent examples

### Acceptance Criteria

- an agent can run `screenstage` without parsing human prose
- an agent can determine success or failure from exit code plus JSON
- an agent can locate all generated assets from the manifest alone

## Phase 2: First-Class Agent Examples

### Objective

Give agents concrete examples they can copy instead of inferring usage from prose.

### Changes

#### 1. Add an "agent quickstart" example

Create a minimal example showing:

- local app startup
- config file
- scripted run
- output manifest inspection

This should be the example a coding agent uses first.

#### 2. Add an "AI workflow" section to the README

Include examples like:

```bash
screenstage run ./screenstage.config.mjs --json
```

and explain:

- what files to inspect after success
- what flags matter in CI or local agent sessions
- how to retry or narrow down failures

#### 3. Add canned task recipes

Example recipes:

- record a homepage walkthrough
- render a changelog clip for one new feature
- create a login-to-success-path demo against localhost
- turn a manual session into an editable generated demo

### Deliverables

- one or two copyable examples
- README section aimed at AI workflows
- sample JSON output in docs

### Acceptance Criteria

- a new agent can succeed by following examples instead of reverse-engineering the codebase

## Phase 3: Codex Skill

### Objective

Make Screenstage immediately usable inside Codex-style environments through a small, targeted skill.

### Recommended Skill Shape

Proposed folder:

`skills/screenstage/`

Suggested contents:

- `SKILL.md`
- `agents/openai.yaml`
- `references/config-patterns.md`
- `references/troubleshooting.md`

Optional:

- `scripts/inspect-manifest.mjs`
- `scripts/create-agent-config.mjs`

### What The Skill Should Teach

The `SKILL.md` should stay short and procedural. It should teach:

- use `screenstage` when the user wants a polished browser demo video
- prefer `run` for scripted, repeatable captures
- prefer `record` when the user wants to perform the browser flow manually
- inspect `manifest.json` and output assets after completion
- if the project has a local app, start or reuse its dev server before capture
- if the output should be polished for launch or docs, use composition and output presets instead of raw capture

### What Should Live In References

`references/config-patterns.md`:

- local app config pattern
- static HTML file pattern
- staging URL pattern
- common output presets
- composition guidance

`references/troubleshooting.md`:

- Playwright browser install issues
- `ffmpeg` availability
- local server timeouts
- selector drift
- headless versus visible run issues

### Skill Trigger Language

The skill description should trigger on requests like:

- "record a product demo"
- "make a walkthrough video of this app"
- "capture a polished browser demo"
- "render a launch video from localhost"
- "turn this app flow into a marketing clip"

### Deliverables

- skill directory created
- concise `SKILL.md`
- references for config patterns and troubleshooting
- generated `agents/openai.yaml`

### Acceptance Criteria

- an agent inside Codex can discover the skill from the metadata alone
- the skill body is short enough to load cheaply
- the agent only needs references when the task gets specific

## Phase 4: Vibe-Coder Experience

### Objective

Make Screenstage feel natural in fast, iterative coding loops where the user says things like:

- "make me a clean demo of the checkout flow"
- "record a quick video of the dashboard"
- "show the new onboarding in a launch-style clip"

### Changes

#### 1. Add intent-oriented presets

Human and agent users both benefit from named presets that imply outcome instead of mechanics.

Possible presets:

- `launch-demo`
- `feature-walkthrough`
- `social-vertical`
- `bug-repro`
- `docs-snippet`

These can resolve to output, camera, timing, and composition defaults.

#### 2. Add a guided "capture recipe" mode

Potential future command:

```bash
screenstage recipe feature-walkthrough --url http://127.0.0.1:3000
```

This would produce:

- a starter config
- a demo script template
- a recommended output preset

This is valuable because vibe coders want "the shortest path to a decent result."

#### 3. Add better post-run summaries

A successful run should tell both humans and agents:

- where the video is
- where the manifest is
- whether there were warnings
- what the next best action is

Examples:

- review `final.mp4`
- edit `generated-demo.mjs`
- rerun with a different preset

### Deliverables

- at least one intent-first preset
- an easier bootstrap path than hand-authoring config
- more actionable summaries after command completion

### Acceptance Criteria

- a new user can get a decent first capture with minimal domain knowledge
- an agent can map plain-English intent to Screenstage configuration with fewer assumptions

## Phase 5: Programmatic API

### Objective

Expose a small API for developers and advanced agent systems that do not want to shell out to the CLI.

### Recommendation

Add a deliberately narrow API instead of exporting internals:

```ts
runCapture(options): Promise<RunResult>
recordCapture(options): Promise<RecordResult>
loadConfig(path): Promise<ResolvedConfig>
```

Keep the API centered on the same contract as the CLI:

- resolved inputs
- status
- manifest path
- artifact paths
- warnings

### Why This Matters

This gives you:

- better embedding into custom dev tools
- less shell parsing
- easier future MCP implementation
- a more stable public surface than exposing internal modules directly

### Deliverables

- minimal public API
- typed result objects
- documentation aligned with CLI behavior

### Acceptance Criteria

- a Node script can drive Screenstage without invoking the CLI
- API results map cleanly to the manifest contract

## Phase 6: MCP Server

### Objective

Expose Screenstage to agent ecosystems that prefer tool calling over shell execution.

### Important Constraint

Only do this after Phases 1 through 3 are in good shape.

An MCP server should be a thin wrapper around stable underlying capabilities, not a place where business logic gets reimplemented.

### Likely MCP Tools

- `screenstage_init_project`
- `screenstage_run_capture`
- `screenstage_record_capture`
- `screenstage_get_manifest`
- `screenstage_list_outputs`

Possible future tools:

- `screenstage_generate_config`
- `screenstage_suggest_preset`

### Input Design

The MCP tools should accept plain, compact parameters:

- target URL or config path
- output intent
- viewport
- preset
- whether manual or scripted capture is desired

The implementation can then generate or resolve full config internally.

### Output Design

Return:

- manifest data
- key artifact paths
- warnings
- failure code and message

Avoid returning raw log streams unless the caller asks for them.

### Deliverables

- separate MCP package or folder
- thin wrapper over the stable core
- docs for tool contracts

### Acceptance Criteria

- an MCP-compatible agent can execute a capture without understanding repo internals
- the MCP server does not duplicate core logic already owned by the CLI or API layer

## Recommended Execution Order

### Track 1: Short-Term

1. Stabilize manifest and output contract.
2. Add `--json`, exit codes, and non-interactive flags.
3. Add one agent-oriented example and README docs.
4. Create the Codex skill.

### Track 2: Medium-Term

1. Add intent-oriented presets.
2. Add a simpler recipe/bootstrap workflow.
3. Add a minimal public JavaScript API.

### Track 3: Long-Term

1. Build an MCP server on top of the stable core.
2. Add richer prompt-to-config helpers if needed.

## What To Avoid

- do not make the skill huge; keep it procedural and rely on references
- do not make MCP the first integration layer
- do not require agents to scrape human log output
- do not let artifact discovery depend on naming conventions alone
- do not expose a broad unstable API surface too early
- do not optimize for "magic prompts" before the CLI contract is dependable

## Success Metrics

Screenstage is ready for agents when these statements are true:

- an agent can discover how to use it from docs or skill metadata in under a minute
- an agent can run it without getting stuck in interactive prompts
- an agent can detect and classify failures automatically
- an agent can find the final video and supporting artifacts from the manifest alone
- a developer can embed the core flow without shell-specific hacks

## Concrete Next Actions

Recommended next implementation steps for this repo:

1. Document the manifest schema and treat it as a public contract.
2. Add `--json` support to `run` first, then `record`, then `init`.
3. Add explicit non-interactive flags and stable exit codes.
4. Update the README with an "AI and agent workflows" section.
5. Create `skills/screenstage/` with a short `SKILL.md` and two reference files.
6. Reassess whether a JS API is needed before building MCP.

## Final Recommendation

Yes, you should make a skill. But the real product move is making Screenstage an agent-grade capture engine with a stable machine contract.

The best path is:

- skill now for immediate usability
- CLI hardening next for reliability
- API after that for embeddability
- MCP last for ecosystem reach

That sequence keeps the scope disciplined and gives you useful value at every step.
