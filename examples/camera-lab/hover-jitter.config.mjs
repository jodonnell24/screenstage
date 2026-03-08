export default {
  name: "camera-lab-hover-jitter",
  url: new URL("./demo-site/lab.html", import.meta.url).href,
  demo: "./demo/hover-jitter.mjs",
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
    preset: "lazy-follow",
    zoom: 2.25,
  },
  composition: {
    preset: "spotlight-browser",
    background: {
      colors: ["#09131d", "#1d3647", "#d8d0c0"],
      angle: 126,
    },
    browser: {
      domain: "hover.motion.local",
    },
  },
  browser: {
    headless: true,
  },
};
