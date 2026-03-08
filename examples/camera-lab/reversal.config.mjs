export default {
  name: "camera-lab-reversal",
  url: new URL("./demo-site/lab.html", import.meta.url).href,
  demo: "./demo/reversal.mjs",
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
    preset: "tight-follow",
  },
  composition: {
    preset: "spotlight-browser",
    background: {
      colors: ["#0f1722", "#193446", "#d7cfbf"],
      angle: 128,
    },
    browser: {
      domain: "reversal.motion.local",
    },
  },
  browser: {
    headless: true,
  },
};
