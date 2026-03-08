export default {
  name: "record-lab-scroll-journey",
  url: new URL("./demo-site/scroll-journey.html", import.meta.url).href,
  demo: "./demo/manual-scroll.mjs",
  viewport: {
    width: 1728,
    height: 1080,
  },
  output: {
    dir: "./renders",
    preset: "motion-edit",
    formats: ["mp4"],
  },
  camera: {
    preset: "showcase-follow",
    zoom: 1.8,
  },
  composition: {
    preset: "studio-browser",
    background: {
      colors: ["#f3ecdf", "#e7edf4", "#f1f5ed"],
      angle: 126,
    },
    browser: {
      domain: "scroll.motion.local",
    },
  },
  browser: {
    headless: true,
    studio: {
      enabled: true,
    },
  },
};
