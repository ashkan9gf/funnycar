// گزارش دقیق پارک‌ها با قرارداد درست AABB (گوشه بالا-چپ) — کل مبدأ شهر
(() => {
  const W = window.__funnycar;
  const cars = W.world.parkedCars;
  const HALF = { len: 100, wid: 46 }; // نیم‌بعد تقریبی بعد از merge سه‌بعدی (target~196-206)
  const boxOf = (c) => {
    const horiz = Math.abs(Math.cos(c.angle)) > 0.5;
    const hx = horiz ? HALF.len : HALF.wid;
    const hz = horiz ? HALF.wid : HALF.len;
    return { x0: c.x - hx, x1: c.x + hx, z0: c.y - hz, z1: c.y + hz };
  };
  const isRoadAxis = (v) => { const k = Math.round((v - 280) / 1400); return Math.abs(v - (k * 1400 + 280)); };
  const rep = { total: cars.length, carCar: [], carBuilding: [], carTree: [], inCrossRoad: [] };
  const near = cars.filter(c => c.x > -1600 && c.y > 3000 && c.x < 5000 && c.y < 9800);
  for (const c of near) {
    const b = boxOf(c);
    // ماشین با ماشین
    for (const o of near) {
      if (o === c) continue;
      const ob = boxOf(o);
      const ox = Math.min(b.x1, ob.x1) - Math.max(b.x0, ob.x0);
      const oz = Math.min(b.z1, ob.z1) - Math.max(b.z0, ob.z0);
      if (ox > 4 && oz > 4 && (c.x < o.x || (c.x === o.x && c.y < o.y))) rep.carCar.push([c.kind, c.x, c.y, o.kind, o.x, o.y, Math.round(Math.min(ox, oz))]);
    }
    // ماشین با ساختمان (collider اول ساختمان‌ها: props kind=building)
    for (const p of W.world.props) {
      if (p.kind !== 'building') continue;
      const ox = Math.min(b.x1, p.x + p.w) - Math.max(b.x0, p.x);
      const oz = Math.min(b.z1, p.y + p.h) - Math.max(b.z0, p.y);
      if (ox > 6 && oz > 6) { rep.carBuilding.push([c.kind, c.x, c.y, Math.round(ox), Math.round(oz)]); break; }
    }
    // ماشین با درخت خیابانی
    for (const p of W.world.props) {
      if (p.kind !== 'gtree' && p.kind !== 'gtreeSmall' && p.kind !== 'tree') continue;
      const ox = Math.min(b.x1, p.x + p.w) - Math.max(b.x0, p.x);
      const oz = Math.min(b.z1, p.y + p.h) - Math.max(b.z0, p.y);
      if (ox > 10 && oz > 10) { rep.carTree.push([c.kind, c.x, c.y, p.kind, Math.round(ox), Math.round(oz)]); break; }
    }
    // ماشین داخل باند جادهٔ عمودش (سر چهارراه)
    const dv = isRoadAxis(c.x);
    const dh = isRoadAxis(c.y);
    if (dv < 280 + 60 && dh < 280 + 60) rep.inCrossRoad.push([c.kind, c.x, c.y, Math.round(dv), Math.round(dh)]);
  }
  return JSON.stringify(rep).slice(0, 3500);
})()
