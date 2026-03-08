Pipeline 1: Playwright + FFmpeg (works for every web app)
should inject a DOM cursor element directly into your page
(white dot + click ripples), so it shows up in the recording without
any OS-level trickery. it then builds a piecewise crop expression in
FFmpeg that encodes the entire cursor path as a mathematical function
— FFmpeg evaluates it per-frame and smoothly follows the cursor.
No paid tools, no screen capture tricks.

Pipeline 2: Remotion (for when you want zero-compromise quality)
This one renders your video as React —
your app runs in an iframe, the cursor is a React
component with spring physics, and the camera is just CSS
transforms with easing. Since every frame is a rendered React
tree, the output is mathematically perfect. You define scenes
(what the camera focuses on + zoom level) and cursor waypoints
(where it moves and when it clicks), and Remotion handles the animation.

Apple Motion integration: both pipelines output standard MP4 (or ProRes from Remotion). Drop into Motion for title cards, particle backgrounds, and the final App Store export.

How it works

Playwright opens a real Chromium window at your URL
A custom DOM cursor element is injected (white dot with ripples on click)
Your demoFn interactions are recorded
Cursor positions are logged every frame
FFmpeg post-processes with a piecewise crop expression that smoothly pans and zooms to follow the cursor

Tips for great recordings

Use page.mouse.move(x, y, { steps: 25 }) — more steps = smoother motion
Add page.waitForTimeout(500-1000) pauses so the camera has time to settle
Record at 1440x900, render at 1920x1080 — gives headroom for zoom
After export, import into Apple Motion for title cards and backgrounds

Pipeline 2: Remotion
Programmatically compose your video in React. Zero screen recording — pure rendered frames. Best for marketing/launch videos where you want total control.

Apple Motion / Final Cut Integration
Both pipelines output standard H.264 MP4 files. For the cleanest Motion workflow:

Use Remotion's npm run render:prores for a lossless source file
Import into Motion as a layer
Add your background, title cards, and lower thirds on top
Use Motion's Follow Path behavior for additional camera moves
Export from Motion as ProRes 4444 for App Store submission

Recommended Motion setup for product demos:

Background: custom gradient or particle system behind the browser window
Drop shadow: use Motion's shadow generator (more control than CSS)
Title sequence: 2-3 second text reveal before the browser appears
End card: freeze last frame, fade in CTA text
