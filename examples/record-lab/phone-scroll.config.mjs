export default {
  name: "record-lab-phone-scroll",
  url: new URL("./demo-site/scroll-journey.html", import.meta.url).href,
  demo: "./demo/manual-scroll.mjs",
  viewport: {
    width: 430,
    height: 932,
  },
  output: {
    dir: "./renders",
    preset: "social-vertical",
    formats: ["mp4"],
  },
  camera: {
    preset: "showcase-follow",
    zoom: 1.5,
  },
  composition: {
    preset: "studio-browser",
    device: "phone",
    background: {
      colors: ["#f3ecdf", "#e7edf4", "#f1f5ed"],
      angle: 126,
    },
    phone: {
      color: "#10141a",
    },
  },
  browser: {
    headless: true,
  },
};
