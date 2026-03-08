export default async function demo({ camera, cursor }) {
  await camera.zoomOut({ durationMs: 0 });
  await cursor.wait(250);

  await cursor.moveToSelector("[data-demo='card-1']", {
    durationMs: 900,
  });
  await cursor.wait(200);

  await cursor.moveToSelector("[data-demo='email']", {
    camera: {
      follow: true,
      zoomFrom: 1,
      zoomTo: 2.9,
    },
    durationMs: 1400,
  });
  await cursor.wait(180);
  await cursor.click();
  await cursor.type("demo@atlas.dev", { delayMs: 75 });
  await cursor.wait(180);

  await cursor.moveToSelector("[data-demo='cta']", {
    camera: {
      follow: true,
      zoomFrom: 2.9,
      zoomTo: 2.55,
    },
    durationMs: 700,
  });
  await cursor.click();

  await cursor.wait(200);

  await cursor.moveToSelector("[data-demo='card-2']", {
    camera: {
      follow: true,
      zoomFrom: 2.55,
      zoomTo: 1.15,
    },
    durationMs: 1300,
  });
  await cursor.wait(350);

  await camera.zoomOut({
    durationMs: 600,
    followCursor: true,
  });
  await cursor.wait(450);
}
