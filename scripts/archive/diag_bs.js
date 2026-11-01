(() => {
  const S = window.__funnycar.renderer3d.scene;
  const out = [];
  S.children.forEach((m, idx) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position;
    const tris = p ? p.count / 3 : 0;
    if (tris < 30000) return;
    if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const bs = m.geometry.boundingSphere;
    out.push({ idx, tris: Math.round(tris), bsR: Math.round(bs.radius), bsC: [Math.round(bs.center.x), Math.round(bs.center.y), Math.round(bs.center.z)], culled: m.frustumCulled });
  });
  out.sort((a, b) => b.tris - a.tris);
  const kinds = {};
  for (const o of out) { const k = o.tris; kinds[k] = (kinds[k] || 0) + 1; }
  return JSON.stringify({ n: out.length, sample: out.slice(0, 6), kinds });
})()
