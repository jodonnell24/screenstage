export default {
  name: "hero-walkthrough",
  url: new URL("./demo-site/index.html", import.meta.url).href,
  demo: "./demo/hero-walkthrough.mjs",
  viewport: {
    width: 1440,
    height: 900,
  },
  output: {
    dir: "./renders",
    preset: "release-hero",
    formats: ["mp4"],
  },
  camera: {
    mode: "follow",
    zoom: 1.75,
  },
  composition: {
    preset: "studio-browser",
    background: {
      colors: ["#f6eadf", "#d8e7f2"],
      angle: 118,
    },
    browser: {
      domain: "launch.northstar.so",
    },
  },
  browser: {
    headless: true,
  },
};
