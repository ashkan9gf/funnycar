(() => {
  const w = window.__funnycar;
  const r = w.renderer3d;
  window.__svMax = 0;
  const orig = r.streamVisuals.bind(r);
  r.streamVisuals = (car) => {
    const t0 = performance.now();
    orig(car);
    const d = performance.now() - t0;
    if (d > window.__svMax) window.__svMax = d;
  };
  w.vehicle.x = 1750;
  w.vehicle.y = 300;
  w.camera.snapTo(1750, 300);
  return 'teleported far, instrumented';
})()
