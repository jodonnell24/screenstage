# Camera Lab

These examples are for tuning the camera, not for shipping polished showcase videos.

They all point at the same lab fixture under [demo-site](/home/jackie/projects/motion/examples/camera-lab/demo-site) but stress different motion patterns:

- `long-travel`: broad left-to-right travel across separated UI regions
- `reversal`: quick direction changes to catch overshoot and rebound
- `hover-jitter`: small pointer motion around one control to expose micro-shake
- `zoom-departure`: zoom in while arriving, then zoom back out while departing

Run them with:

```bash
node dist/cli.js run ./examples/camera-lab/long-travel.config.mjs
node dist/cli.js run ./examples/camera-lab/reversal.config.mjs
node dist/cli.js run ./examples/camera-lab/hover-jitter.config.mjs
node dist/cli.js run ./examples/camera-lab/zoom-departure.config.mjs
```

Each run writes `final.mp4`, `poster.png`, and `contact-sheet.png` under `examples/camera-lab/renders/`.
