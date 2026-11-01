(() => {
  const S = window.__funnycar.renderer3d.scene;
  const items = [];
  S.traverse((o) => {
    const m = o;
    if (!m.isMesh || m.isInstancedMesh) return;
    const p = m.geometry.attributes.position;
    const tris = p ? p.count / 3 : 0;
    if (tris < 40000) return;
    const e = m.matrixWorld.elements;
    let par = m.parent; const chain = [];
    for (let i = 0; i < 6 && par; i++) {
      chain.push((par.name || par.type).slice(0, 16));
      par = par.parent;
    }
    items.push({
      tris: Math.round(tris),
      x: Math.round(e[12]), z: Math.round(e[14]),
      vis: m.visible,
      chain: chain.join('<'),
      geo: m.geometry.uuid.slice(0, 8),
    });
  });
  items.sort((a, b) => b.tris - a.tris);
  return JSON.stringify(items.slice(0, 10));
})()
