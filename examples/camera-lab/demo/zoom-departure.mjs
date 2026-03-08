export default async function demo({ camera, cursor }) {
  await camera.zoomOut({ durationMs: 0 });
  await cursor.wait(250);

  await cursor.moveToSelector("[data-demo='search-button']", {
    camera: {
      follow: true,
      zoomFrom: 1,
      zoomTo: 2.4,
    },
    durationMs: 1350,
  });
  await cursor.click();
  await cursor.wait(180);

  await cursor.moveToSelector("[data-demo='inspector-secondary']", {
    camera: {
      follow: true,
      zoomFrom: 2.4,
      zoomTo: 1.12,
    },
    durationMs: 1650,
  });
  await cursor.wait(220);

  await camera.zoomOut({
    durationMs: 550,
    followCursor: true,
  });
  await cursor.wait(420);
}
