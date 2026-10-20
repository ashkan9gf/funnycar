// گزارش پارک v2 — قرارداد درست: angle 0/π = ماشین عمودی (طول روی Y)، ±π/2 = افقی (طول روی X)
(() => {
  const W = window.__funnycar;
  const cars = W.world.parkedCars;
  const LEN = 100, WID = 46; // نیم‌بعد
  const boxOf = (c) => {
    const vertical = Math.abs(Math.sin(c.angle)) < 0.5; // 0/π → طول روی Y
    const hx = vertical ? WID : LEN;
    const hz = vertical ? LEN : WID;
    return { x0: c.x - hx, x1: c.x + hx, z0: c.y - hz, z1: c.y + hz };
  };
  const isRoadAxis = (v) => Math.abs(v - (Math.round((v - 280) / 1400) * 1400 + 280));
  const rep = { total: cars.length, carCar: 0, carBuilding: [], carTree: [], inCrossRoad: [] };
  const near = cars.filter(c => c.x > -1600 && c.y > 3000 && c.x < 5200 && c.y < 9800);
  for (const c of near) {
    const b = boxOf(c);
    for (const o of near) {
      if (o === c) continue;
      const ob = boxOf(o);
      const ox = Math.min(b.x1, ob.x1) - Math.max(b.x0, ob.x0);
      const oz = Math.min(b.z1, ob.z1) - Math.max(b.z0, ob.z0);
      if (ox > 4 && oz > 4) rep.carCar++;
    }
    for (const p of W.world.props) {
      if (p.kind !== 'building') continue;
      const ox = Math.min(b.x1, p.x + p.w) - Math.max(b.x0, p.x);
      const oz = Math.min(b.z1, p.y + p.h) - Math.max(b.z0, p.y);
      if (ox > 6 && oz > 6) { rep.carBuilding.push([c.kind, c.x, c.y, Math.round(ox), Math.round(oz)]); break; }
    }
    for (const p of W.world.props) {
      if (p.kind !== 'gtree' && p.kind !== 'gtreeSmall' && p.kind !== 'tree') continue;
      const ox = Math.min(b.x1, p.x + p.w) - Math.max(b.x0, p.x);
      const oz = Math.min(b.z1, p.y + p.h) - Math.max(b.z0, p.y);
      if (ox > 10 && oz > 10) { rep.carTree.push([c.kind, c.x, c.y, p.kind, Math.round(ox), Math.round(oz)]); break; }
    }
    if (isRoadAxis(c.x) < 340 && isRoadAxis(c.y) < 340) rep.inCrossRoad.push([c.kind, c.x, c.y]);
  }
  return JSON.stringify(rep);
})()
