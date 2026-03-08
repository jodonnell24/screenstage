export default async function demo({ camera, cursor }) {
  await cursor.moveToSelector("[data-demo='card-1']", {
    camera: {
      follow: true,
      zoomFrom: 1,
      zoomTo: 1.68,
    },
    durationMs: 1050,
  });
  await camera.wait(250);

  await cursor.moveToSelector("[data-demo='card-2']", {
    camera: {
      follow: true,
      zoomFrom: 1.68,
      zoomTo: 1.54,
    },
    durationMs: 1050,
  });
  await camera.wait(250);

  await cursor.moveToSelector("[data-demo='email']", {
    camera: {
      follow: true,
      zoomFrom: 1.54,
      zoomTo: 1.88,
    },
    durationMs: 950,
  });
  await cursor.click();
  await cursor.type("demo@atlas.dev", { delayMs: 75 });

  await cursor.moveToSelector("[data-demo='cta']", {
    camera: {
      follow: true,
      zoomFrom: 1.88,
      zoomTo: 1.72,
    },
    durationMs: 850,
  });
  await cursor.click();

  await camera.zoomOut({
    durationMs: 700,
    followCursor: true,
  });
  await cursor.wait(350);
}
