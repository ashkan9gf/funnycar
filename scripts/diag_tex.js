(() => {
  const S = window.__funnycar.renderer3d.scene;
  const out = [];
  S.children.forEach((m) => {
    if (!m.isMesh) return;
    const p = m.geometry.attributes.position;
    const tris = p ? p.count / 3 : 0;
    if (tris < 30000) return;
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    let texSrc = 'no';
    if (mat && mat.map && mat.map.image && mat.map.image.src) {
      texSrc = String(mat.map.image.src).split('/').pop().slice(0, 40);
    }
    out.push({ tris: Math.round(tris), mat: mat ? mat.name : '?', tex: texSrc });
  });
  out.sort((a, b) => b.tris - a.tris);
  return JSON.stringify(out.slice(0, 20));
})()
