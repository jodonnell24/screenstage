import { createHeroWalkthrough } from "../../../dist/index.js";

export default createHeroWalkthrough({
  fieldSelector: "[data-demo='email']",
  fieldText: "launch@northstar.so",
  ctaSelector: "[data-demo='cta']",
  metricSelector: "[data-demo='card-2']",
});
