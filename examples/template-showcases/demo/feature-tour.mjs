import { createFeatureTour } from "../../../dist/index.js";

export default createFeatureTour({
  introPauseMs: 500,
  steps: [
    {
      action: "focus",
      label: "Start on the lead form",
      pauseMs: 250,
      selector: "[data-demo='email']",
      zoom: 2,
    },
    {
      action: "type",
      label: "Type a real-looking email",
      pauseMs: 250,
      selector: "[data-demo='email']",
      text: "demo@atlas.dev",
      zoom: 2,
    },
    {
      action: "click",
      label: "Hit the waitlist CTA",
      pauseMs: 900,
      selector: "[data-demo='cta']",
      zoom: 1.8,
    },
    {
      action: "move",
      label: "Move across to the proof card",
      moveDurationMs: 950,
      pauseMs: 850,
      pauseTarget: "camera",
      selector: "[data-demo='card-1']",
      zoom: 1.8,
    },
    {
      action: "move",
      label: "Finish on the secondary metric",
      moveDurationMs: 950,
      pauseMs: 900,
      pauseTarget: "camera",
      selector: "[data-demo='card-2']",
      zoom: 1.8,
    },
  ],
});
