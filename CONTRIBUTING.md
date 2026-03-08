# Contributing

## Local Setup

```bash
npm install
npx playwright install chromium
npm run check
npm run build
```

## Workflow

- Keep changes focused and small enough to review.
- Prefer TypeScript changes in `src/` and let `dist/` be rebuilt from source.
- Update `readme.md` when the config surface, CLI behavior, or output artifacts change.
- For runtime or render changes, run at least one real `motion-creator run` smoke test before opening a PR.

## Pull Requests

- Explain the user-facing behavior change, not just the code change.
- Include verification steps you ran.
- If the change affects rendering, attach or reference a generated artifact when possible.
