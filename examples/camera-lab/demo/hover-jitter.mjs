function pointInBox(box, xRatio, yRatio) {
  return {
    x: box.x + box.width * xRatio,
    y: box.y + box.height * yRatio,
  };
}

export default async function demo({ cursor, page }) {
  const searchBox = await page.locator("[data-demo='search']").boundingBox();

  if (!searchBox) {
    throw new Error("Search box was not found for hover-jitter demo.");
  }

  await cursor.move(pointInBox(searchBox, 0.5, 0.5), {
    camera: {
      follow: true,
      zoomFrom: 1,
      zoomTo: 2.55,
    },
    durationMs: 1200,
  });

  const microTargets = [
    pointInBox(searchBox, 0.52, 0.46),
    pointInBox(searchBox, 0.49, 0.54),
    pointInBox(searchBox, 0.54, 0.49),
    pointInBox(searchBox, 0.47, 0.52),
    pointInBox(searchBox, 0.51, 0.48),
  ];

  for (const target of microTargets) {
    await cursor.move(target, {
      camera: {
        follow: true,
        zoomFrom: 2.55,
        zoomTo: 2.55,
      },
      durationMs: 280,
    });
    await cursor.wait(100);
  }

  await cursor.wait(450);
}
