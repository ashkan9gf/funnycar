(() => {
  const S = window.__funnycar.renderer3d.scene;
  function V(){ this.x=0;this.y=0;this.z=0; }
  const out = [];
  S.children.forEach((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position;
    const tris = p ? p.count / 3 : 0;
    if (tris < 30000) return;
    if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    const sx = bb.max.x-bb.min.x, sy = bb.max.y-bb.min.y, szz = bb.max.z-bb.min.z;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    out.push({
      tris: Math.round(tris),
      size: [Math.round(sx), Math.round(sy), Math.round(szz)],
      mat: mat ? mat.type + ':' + (mat.name || 'noname') : 'null',
      tex: mat && mat.map ? (mat.map.image ? mat.map.image.width : 'pending') : 'no'
    });
  });
  out.sort((a, b) => b.tris - a.tris);
  return JSON.stringify(out.slice(0, 12));
})()
