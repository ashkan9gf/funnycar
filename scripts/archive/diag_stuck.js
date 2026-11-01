(() => {
  const F = window.__funnycar;
  const v = F.vehicle;
  const list = F.traffic.cars || F.traffic.list || (Array.isArray(F.traffic) ? F.traffic : []);
  const near = [];
  for (const c of list) {
    const d = Math.hypot(c.x - v.x, c.y - v.y);
    if (d < 400) near.push({ d: Math.round(d), spd: Math.round(c.speed) });
  }
  return JSON.stringify({
    trafficKeys: Object.keys(F.traffic).slice(0, 8).join(','),
    nearCount: near.length, near: near.slice(0, 5),
    crashCd: Math.round(F.crashCooldown || 0),
    hardLatch: !!F.hardCrashLatch,
    angle: Math.round(v.angle * 57.3),
    alive: v.alive !== false,
    hp: v.hp
  });
})()
