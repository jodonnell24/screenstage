import type { Locator } from "playwright";

import type { Point } from "./types.js";

export async function resolveLocatorCenter(locator: Locator): Promise<Point> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("Unable to resolve selector position; element has no box.");
  }

  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}
