# Quickstart Example

This is the single bundled example for trying Screenstage.

It gives you one calm, basic workspace page with enough interaction to test both:

- `run` for a scripted capture
- `record` for a manual session

Try the scripted pass:

```bash
node dist/cli.js run ./examples/quickstart/motion.config.mjs
```

Try the manual recorder:

```bash
node dist/cli.js record ./examples/quickstart/motion.config.mjs
```

Outputs are written under `./output/`.
