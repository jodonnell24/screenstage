export default async function demo({ camera, cursor, page }) {
  await camera.wide({ durationMs: 0 });
  await cursor.wait(450);

  await cursor.typeSelector("[data-demo='search']", "design tokens", {
    delayMs: 72,
    durationMs: 860,
  });
  await cursor.wait(220);

  await cursor.clickSelector("[data-demo='save']", {
    durationMs: 620,
  });
  await cursor.wait(360);

  await page.mouse.wheel(0, 760);
  await cursor.sample("wait");
  await cursor.wait(520);

  await cursor.clickSelector("[data-demo='review-copy']", {
    durationMs: 740,
  });
  await cursor.wait(280);

  await cursor.typeSelector(
    "[data-demo='note']",
    "Tone down the release copy and keep the states readable in the capture.",
    {
      delayMs: 55,
      durationMs: 900,
    },
  );
  await cursor.wait(240);

  await cursor.clickSelector("[data-demo='publish']", {
    durationMs: 720,
  });
  await cursor.wait(420);

  await page.mouse.wheel(0, 920);
  await cursor.sample("wait");
  await cursor.wait(560);

  await cursor.clickSelector("[data-demo='ready']", {
    durationMs: 760,
  });
  await cursor.wait(900);
}
