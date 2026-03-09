export default {
  name: "quickstart-workspace",
  url: new URL("./demo-site/index.html", import.meta.url).href,
  demo: "./demo/basic-demo.mjs",
  viewport: {
    width: 1728,
    height: 1080,
  },
  output: {
    dir: "./output",
    preset: "motion-edit",
    formats: ["mp4"],
  },
  camera: {
    preset: "showcase-follow",
    zoom: 1.65,
    padding: 96,
  },
  composition: {
    preset: "studio-browser",
    device: "desktop",
    background: {
      preset: "soft-studio",
    },
    browser: {
      domain: "workspace.motion.local",
      style: "minimal",
    },
  },
  browser: {
    capture: {
      mode: "video",
    },
    headless: true,
    studio: {
      enabled: true,
    },
  },
  timing: {
    settleMs: 900,
  },
};
