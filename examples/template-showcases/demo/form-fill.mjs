import { createFormFillCapture } from "../../../dist/index.js";

export default createFormFillCapture({
  fields: [
    {
      label: "Fill the headline form",
      selector: "[data-demo='email']",
      text: "hello@getrestocky.com",
      zoom: 2,
    },
  ],
  submitPauseMs: 1000,
  submitSelector: "[data-demo='cta']",
  submitZoom: 1.8,
});
