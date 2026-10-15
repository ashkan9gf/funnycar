(() => {
  const F = window.__funnycar;
  window.__t1 = { kmh: Math.round(F.vehicle.speed * 3.6), last: F.lastFrame, fps: F.fpsValue, raf: !!F.raf };
  return 'snap1';
})()
