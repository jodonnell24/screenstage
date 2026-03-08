export default {
  name: "form-fill",
  url: new URL("./demo-site/form-focus.html", import.meta.url).href,
  demo: "./demo/form-fill.mjs",
  viewport: {
    width: 1440,
    height: 900,
  },
  output: {
    dir: "./renders",
    preset: "social-square",
    formats: ["mp4"],
  },
  camera: {
    mode: "static",
    zoom: 1,
  },
  composition: {
    preset: "studio-browser",
    background: {
      colors: ["#efe6dd", "#dbe9de"],
      angle: 145,
    },
    browser: {
      domain: "forms.restocky.io",
    },
  },
  browser: {
    headless: true,
  },
};
