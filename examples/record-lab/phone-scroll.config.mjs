export default {
  name: "record-lab-phone-journey",
  url: new URL("./demo-site/phone-journey.html", import.meta.url).href,
  demo: "./demo/manual-phone.mjs",
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
      colors: ["#09131d", "#102638", "#14212f"],
      angle: 144,
    },
    phone: {
      color: "#0b1117",
    },
  },
  browser: {
    headless: true,
  },
};
