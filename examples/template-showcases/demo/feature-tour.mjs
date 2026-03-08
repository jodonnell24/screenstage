import { createFeatureTour } from "../../../dist/index.js";

export default createFeatureTour({
  introPauseMs: 500,
  steps: [
    {
      action: "focus",
      label: "Start on the proof card to frame the product story",
      pauseMs: 300,
      selector: "[data-demo='card-1']",
      zoom: 1.7,
    },
    {
      action: "move",
      cameraFollow: true,
      label: "Guide the camera across to the second proof card",
      moveDurationMs: 1050,
      pauseMs: 550,
      pauseTarget: "camera",
      selector: "[data-demo='card-2']",
      zoom: 1.6,
    },
    {
      action: "move",
      cameraFollow: true,
      label: "Travel back to the conversion area",
      moveDurationMs: 1000,
      pauseMs: 300,
      pauseTarget: "camera",
      selector: "[data-demo='email']",
      zoom: 1.75,
    },
    {
      action: "type",
      label: "Type a real-looking email",
      pauseMs: 250,
      selector: "[data-demo='email']",
      text: "demo@atlas.dev",
      zoom: 1.95,
    },
    {
      action: "click",
      cameraFollow: true,
      label: "Chase the CTA and commit the action",
      moveDurationMs: 900,
      pauseMs: 900,
      selector: "[data-demo='cta']",
      zoom: 1.7,
    },
  ],
});
