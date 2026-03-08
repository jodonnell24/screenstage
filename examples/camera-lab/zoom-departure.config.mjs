export default {
  name: "camera-lab-zoom-departure",
  url: new URL("./demo-site/lab.html", import.meta.url).href,
  demo: "./demo/zoom-departure.mjs",
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
    preset: "showcase-follow",
  },
  composition: {
    preset: "spotlight-browser",
    background: {
      colors: ["#0b1520", "#234156", "#d9d2c3"],
      angle: 132,
    },
    browser: {
      domain: "zoom.motion.local",
    },
  },
  browser: {
    headless: true,
  },
};
