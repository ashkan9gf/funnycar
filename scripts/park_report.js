// گزارش پارک‌های اطراف یک نقطه — از داخل بازی (data layer)
// اجرا: agent-browser eval با paste — همه ماشین‌های پارک‌شده در شعاع 2200 از اسپاون + تداخل‌ها
(() => {
  const W = window.__funnycar;
  const cars = W.world.parkedCars;
  const props = W.world.props;
  const sx = 1750, sy = 6630, R = 2600;
  const near = cars.filter(c => Math.abs(c.x - sx) < R && Math.abs(c.y - sy) < R);
  const carLen = 200, carW = 92; // تقریبی بعد merge 3D
  const report = { count: near.length, overlaps: [], inTree: [], inWall: [], nearIntersection: [] };
  const isInter = (x, y) => {
    // فاصله تا نزدیک‌ترین مرکز جاده در هر دو محور
    const rc = k => k * 1400 + 280;
    const nearV = Math.abs(x - Math.round((x - 280) / 1400) * 1400 - 280);
    const nearH = Math.abs(y - Math.round((y - 280) / 1400) * 1400 - 280);
    return nearV < 420 && nearH < 420; // هر دو نزدیک = سر چهارراه
  };
  for (const c of near) {
    const hx = Math.abs(Math.cos(c.angle)) > 0.5 ? carLen : carW;
    const hz = Math.abs(Math.cos(c.angle)) > 0.5 ? carW : carLen;
    // تداخل ماشین با ماشین
    for (const o of near) {
      if (o === c || o.x < c.x) continue;
      const ohx = Math.abs(Math.cos(o.angle)) > 0.5 ? carLen : carW;
      const ohz = Math.abs(Math.cos(o.angle)) > 0.5 ? carW : carLen;
      const dx = Math.abs(o.x - c.x) - (hx + ohx) / 2;
      const dz = Math.abs(o.y - c.y) - (hz + ohz) / 2;
      if (dx < 0 && dz < 0) report.overlaps.push([c.x, c.y, o.x, o.y, c.kind, o.kind]);
    }
    // درخت/دیوار روی ماشین
    for (const p of props) {
      if (p.kind !== 'gtree' && p.kind !== 'gtreeSmall' && p.kind !== 'tree') continue;
      if (Math.abs(p.x - c.x) < (p.w + hx) / 2 && Math.abs(p.y - c.y) < (p.h + hz) / 2) report.inTree.push([c.x, c.y, c.kind, p.kind, p.x, p.y]);
      if (p.solid && Math.abs(p.x - c.x) < (p.w + hx) / 2 && Math.abs(p.y - c.y) < (p.h + hz) / 2) report.inWall.push([c.x, c.y, c.kind, p.kind]);
    }
    if (isInter(c.x, c.y)) report.nearIntersection.push([c.x, c.y, c.kind]);
  }
  // dedupe overlaps
  report.overlaps = report.overlaps.filter((v, i, a) => a.findIndex(u => u[0] === v[1] && u[1] === v[0]) < i);
  return JSON.stringify(report).slice(0, 3000);
})()
