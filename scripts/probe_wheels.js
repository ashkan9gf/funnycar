(() => {
  const R = window.__funnycar.renderer3d;
  const t = R.parkedTmpl.get('vintage');
  t.tmpl.updateMatrixWorld(true);
  let res = null;
  t.tmpl.traverse((o) => {
    if (!o.isMesh || res) return;
    const pos = o.geometry.attributes.position;
    let topCount = 0, botCount = 0, ys = [];
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i), y = pos.getY(i);
      if (Math.abs(z) > 85) { ys.push(y); if (y > 50) topCount++; else botCount++; }
    }
    res = { vertAtZends: ys.length, highY: topCount, lowY: botCount, ymin: Math.min(...ys).toFixed(1), ymax: Math.max(...ys).toFixed(1) };
  });
  return JSON.stringify(res);
})()
