export default async function demo({ cursor }) {
  await cursor.wait(250);
  await cursor.moveToSelector("[data-demo='nav-scenes']", { durationMs: 850 });
  await cursor.wait(120);

  await cursor.moveToSelector("[data-demo='search']", {
    camera: {
      follow: true,
      timingPreset: "late-arrival",
      zoomFrom: 1,
      zoomTo: 1.75,
    },
    durationMs: 1700,
  });
  await cursor.wait(260);

  await cursor.moveToSelector("[data-demo='inspector-primary']", {
    camera: {
      follow: true,
      timingPreset: "depart-reveal",
      zoomFrom: 1.75,
      zoomTo: 1.22,
    },
    durationMs: 1250,
  });
  await cursor.wait(220);

  await cursor.moveToSelector("[data-demo='inspector-primary']", {
    camera: {
      follow: true,
      timingPreset: "continuous",
      zoomFrom: 1.22,
      zoomTo: 1.82,
    },
    durationMs: 520,
  });
  await cursor.wait(180);

  await cursor.moveToSelector("[data-demo='stat-left']", {
    camera: {
      follow: true,
      timingPreset: "depart-reveal",
      followEnd: 0.88,
      zoomFrom: 1.82,
      zoomTo: 1.18,
    },
    durationMs: 1380,
  });
  await cursor.wait(180);

  await cursor.moveToSelector("[data-demo='stat-left']", {
    camera: {
      follow: true,
      timingPreset: "continuous",
      zoomFrom: 1.18,
      zoomTo: 1.58,
    },
    durationMs: 420,
  });
  await cursor.wait(180);

  await cursor.moveToSelector("[data-demo='inspector-secondary']", {
    camera: {
      follow: true,
      timingPreset: "depart-reveal",
      zoomFrom: 1.58,
      zoomTo: 1.08,
    },
    durationMs: 1680,
  });
  await cursor.wait(200);

  await cursor.moveToSelector("[data-demo='inspector-secondary']", {
    camera: {
      follow: true,
      timingPreset: "continuous",
      zoomFrom: 1.08,
      zoomTo: 1.42,
    },
    durationMs: 420,
  });
  await cursor.wait(450);
}
