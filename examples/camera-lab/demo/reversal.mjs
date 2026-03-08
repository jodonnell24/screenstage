export default async function demo({ cursor }) {
  await cursor.wait(200);

  await cursor.moveToSelector("[data-demo='filter-launch']", {
    camera: {
      follow: true,
      zoomFrom: 1,
      zoomTo: 1.85,
    },
    durationMs: 900,
  });
  await cursor.wait(100);

  await cursor.moveToSelector("[data-demo='filter-ship']", {
    camera: {
      follow: true,
      zoomFrom: 1.85,
      zoomTo: 1.92,
    },
    durationMs: 950,
  });
  await cursor.wait(100);

  await cursor.moveToSelector("[data-demo='filter-proof']", {
    camera: {
      follow: true,
      zoomFrom: 1.92,
      zoomTo: 1.92,
    },
    durationMs: 650,
  });
  await cursor.wait(90);

  await cursor.moveToSelector("[data-demo='filter-convert']", {
    camera: {
      follow: true,
      zoomFrom: 1.92,
      zoomTo: 1.88,
    },
    durationMs: 620,
  });
  await cursor.wait(90);

  await cursor.moveToSelector("[data-demo='filter-launch']", {
    camera: {
      follow: true,
      zoomFrom: 1.88,
      zoomTo: 1.82,
    },
    durationMs: 780,
  });
  await cursor.wait(420);
}
