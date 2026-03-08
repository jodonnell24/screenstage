export default {
  name: "camera-lab-long-travel",
  url: new URL("./demo-site/lab.html", import.meta.url).href,
  demo: "./demo/long-travel.mjs",
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
      colors: ["#0e1720", "#20394c", "#d9d1bf"],
      angle: 132,
    },
    browser: {
      domain: "lab.motion.local",
    },
  },
  browser: {
    headless: true,
  },
};
