export default async function demo({ cursor }) {
  await cursor.wait(250);
  await cursor.moveToSelector("[data-demo='nav-scenes']", { durationMs: 850 });
  await cursor.wait(120);

  await cursor.moveToSelector("[data-demo='search']", {
    camera: {
      follow: true,
      zoomFrom: 1,
      zoomTo: 1.75,
    },
    durationMs: 1550,
  });
  await cursor.wait(180);

  await cursor.moveToSelector("[data-demo='inspector-primary']", {
    camera: {
      follow: true,
      zoomFrom: 1.75,
      zoomTo: 1.9,
    },
    durationMs: 1450,
  });
  await cursor.wait(180);

  await cursor.moveToSelector("[data-demo='stat-left']", {
    camera: {
      follow: true,
      zoomFrom: 1.9,
      zoomTo: 1.55,
    },
    durationMs: 1500,
  });
  await cursor.wait(180);

  await cursor.moveToSelector("[data-demo='inspector-secondary']", {
    camera: {
      follow: true,
      zoomFrom: 1.55,
      zoomTo: 1.35,
    },
    durationMs: 1700,
  });
  await cursor.wait(450);
}
