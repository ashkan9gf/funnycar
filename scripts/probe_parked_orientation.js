// پروبه جهت قالب‌های پارکی — AABB جهانی از ۸ گوشه باکس لوکال هر مش
(async () => {
  const R = window.__funnycar.renderer3d;
  const g = R.glb;
  const out = {};
  for (const k of ['vintage', 'renault4', 'peugeot405', 'samand']) {
    let s = await g.loadCar(k, true);
    if (!s) s = await g.loadCar(k, false);
    if (!s) { out[k] = 'null'; continue; }
    s.updateMatrixWorld(true);
    let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9,minZ=1e9,maxZ=-1e9;
    s.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      const g2 = m.geometry;
      if (!g2.boundingBox) g2.computeBoundingBox();
      const bb = g2.boundingBox;
      const el = m.matrixWorld.elements;
      for (let ci = 0; ci < 8; ci++) {
        const x = (ci & 1) ? bb.max.x : bb.min.x;
        const y = (ci & 2) ? bb.max.y : bb.min.y;
        const z = (ci & 4) ? bb.max.z : bb.min.z;
        const wx = el[0]*x + el[4]*y + el[8]*z + el[12];
        const wy = el[1]*x + el[5]*y + el[9]*z + el[13];
        const wz = el[2]*x + el[6]*y + el[10]*z + el[14];
        if (wx<minX)minX=wx; if (wx>maxX)maxX=wx;
        if (wy<minY)minY=wy; if (wy>maxY)maxY=wy;
        if (wz<minZ)minZ=wz; if (wz>maxZ)maxZ=wz;
      }
    });
    out[k] = { dx: +(maxX-minX).toFixed(1), dy: +(maxY-minY).toFixed(1), dz: +(maxZ-minZ).toFixed(1), yMin: +minY.toFixed(1) };
  }
  return JSON.stringify(out);
})()
