// پیدا کردن مش واقعی ماشین وارونه در (1110,5570) — AABB جهانی + زنجیره والد
(() => {
  const R = window.__funnycar.renderer3d;
  const hits = [];
  R.scene.traverseVisible((o) => {
    if (!o.isMesh) return;
    o.updateMatrixWorld(true);
    const g = o.geometry;
    if (!g || !g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox;
    const el = o.matrixWorld.elements;
    let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9,minZ=1e9,maxZ=-1e9;
    for (let ci = 0; ci < 8; ci++) {
      const x = (ci&1)?bb.max.x:bb.min.x, y=(ci&2)?bb.max.y:bb.min.y, z=(ci&4)?bb.max.z:bb.min.z;
      const wx = el[0]*x+el[4]*y+el[8]*z+el[12];
      const wy = el[1]*x+el[5]*y+el[9]*z+el[13];
      const wz = el[2]*x+el[6]*y+el[10]*z+el[14];
      if (wx<minX)minX=wx; if (wx>maxX)maxX=wx;
      if (wy<minY)minY=wy; if (wy>maxY)maxY=wy;
      if (wz<minZ)minZ=wz; if (wz>maxZ)maxZ=wz;
    }
    if (1110>minX-10 && 1110<maxX+10 && 5570>minZ-10 && 5570<maxZ+10 && maxY>10) {
      // زنجیره والد تا ریشه
      const chain = [];
      let p = o;
      for (let d = 0; d < 4 && p; d++) { chain.push(`${p.type}${p.rotation.x?('rx'+p.rotation.x.toFixed(2)):''}${p.rotation.y?('ry'+p.rotation.y.toFixed(2)):''}`); p = p.parent; }
      hits.push({
        dims: [Math.round(maxX-minX), Math.round(maxY-minY), Math.round(maxZ-minZ)],
        yMin: Math.round(minY), vcount: g.attributes.position.count,
        selfRot: { rx:+o.rotation.x.toFixed(2), ry:+o.rotation.y.toFixed(2), rz:+o.rotation.z.toFixed(2) },
        pos: [Math.round(o.position.x), Math.round(o.position.y), Math.round(o.position.z)],
        chain,
      });
    }
  });
  return JSON.stringify(hits.slice(0, 12));
})()
