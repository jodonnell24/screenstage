export default {
  name: "feature-tour",
  url: new URL("./demo-site/index.html", import.meta.url).href,
  demo: "./demo/feature-tour.mjs",
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
    zoom: 1.7,
  },
  composition: {
    preset: "spotlight-browser",
    background: {
      colors: ["#111b24", "#21374b", "#d6cfbf"],
      angle: 132,
    },
    browser: {
      domain: "app.atlas.dev",
    },
  },
  browser: {
    headless: true,
  },
};
