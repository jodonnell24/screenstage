# Record Lab

These examples are for manual `record` sessions, especially scroll-heavy flows that do not show up well in the current camera lab.

The main fixture is a tall launch-planning page with multiple sticky, mid-page, and lower-page interaction targets:

- sticky filter/search bar near the top
- campaign cards and checklist controls in the middle
- proof gallery and CTA controls near the bottom

Use it with:

```bash
npm run dev -- record ./examples/record-lab/scroll-journey.config.mjs
```

There is also a mobile-shell variant:

```bash
npm run dev -- record ./examples/record-lab/phone-scroll.config.mjs
```

That phone config now points at a dedicated mobile-first fixture rather than the desktop page in a phone shell. It is designed for:

- sticky top controls and a narrow search path
- thumb-sized tap targets in the middle
- expandable lower-page proof blocks
- a bottom CTA after a real vertical scroll

This config is intentionally a little sharper than the default starter:

- source viewport: `1728x1080`
- output preset: `motion-edit`
- format: `mp4`

That makes it a better place to judge both scroll behavior and perceived crispness.
