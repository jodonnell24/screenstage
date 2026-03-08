# Template Showcases

These examples each use their own fixture page under [demo-site](/home/jackie/projects/motion/examples/template-showcases/demo-site) and save renders into `./renders/`.

- `hero-walkthrough`: staged launch-style sequence with a wide open, focused conversion, and proof reveal
- `feature-tour`: more kinetic product tour with camera-follow travel between UI regions
- `form-fill`: static square form demo that keeps the whole browser shell in frame

Run them with:

```bash
node dist/cli.js run ./examples/template-showcases/hero-walkthrough.config.mjs
node dist/cli.js run ./examples/template-showcases/feature-tour.config.mjs
node dist/cli.js run ./examples/template-showcases/form-fill.config.mjs
```

The resulting MP4s, poster frames, and contact sheets are written under `examples/template-showcases/renders/`.
