(() => {
  const w = window.__funnycar;
  const r = w.renderer3d;
  const out = {};
  // یک قطعه تازه بساز و زمان هر مرحله را دستی ثبت کن
  const i = 1, j = 0, key = '1_0';
  const ch = w.world.chunkFor(i, j);
  const gen = r.buildChunkVisualGen(i, j, key);
  const times = [];
  let guard = 0;
  for (;;) {
    const t0 = performance.now();
    const step = gen.next();
    times.push(Math.round(performance.now() - t0));
    if (step.done || ++guard > 40) break;
  }
  out.stepTimes = times;
  out.total = times.reduce((a, b) => a + b, 0);
  r.unloadChunkVisual(key, r.chunkVis.get(key));
  return JSON.stringify(out);
})()
