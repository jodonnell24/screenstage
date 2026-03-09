# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project aims to follow Semantic Versioning once public releases start.

## [Unreleased]

- Nothing unreleased yet.

## [0.2.0] - 2026-03-09

- Added a machine-readable CLI contract for `run` and `record`, including JSON event streams, stable exit codes, manifest typing, and output/headless overrides.
- Added a portable `skills/screenstage/` skill with config and troubleshooting references for agent-oriented workflows.
- Rewrote the README into a shorter landing page and moved dense reference material into dedicated docs.
- Added dedicated docs for agent integration, CLI contracts, config reference, authoring guidance, and the Screenstage agent tooling plan.
- Clarified the distinction between scripted `run` captures and human-headed `record` studio captures, including framing and preset tradeoff guidance.

## [0.1.0] - 2026-03-08

- Initial public release of Screenstage.
- Scripted `run` mode for browser captures with FFmpeg camera/composition rendering.
- Manual `record` mode with editable generated demo scripts, studio mode, and marker cues.
- Guided `init` flow that writes `screenstage.config.mjs` and starter files.
- Desktop browser composition shell, phone shell support, and named background/chrome presets.
- Camera presets, zoom controls, and timing presets for cursor-led framing.
- MP4 review renders, ProRes edit exports, contact sheets, poster frames, manifests, and marker artifacts.
- Pre-capture setup hooks for local app state, including route, storage, cookies, and setup modules.
- Cursor options for Screenstage-owned cursors or app-owned custom cursors during capture.
