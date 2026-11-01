(() => {
  const S = window.__funnycar.renderer3d.scene;
  const roots = new Map();
  S.traverse((o) => {
    const m = o;
    if (!m.isMesh || m.isInstancedMesh) return;
    const p = m.geometry.attributes.position;
    const tris = p ? p.count / 3 : 0;
    if (tris < 30000) return;
    let r = m;
    while (r.parent && r.parent !== S) r = r.parent;
    const k = r.uuid;
    const e = roots.get(k) || {
      type: r.type, name: r.name || '', sx: +r.scale.x.toFixed(3),
      children: r.children.length, meshes: 0, tris: 0, vis: r.visible,
      ud: Object.keys(r.userData || {}).join(','),
    };
    e.meshes++; e.tris += tris;
    roots.set(k, e);
  });
  const arr = [...roots.entries()].map(([k, v]) => ({ id: k.slice(0, 6), ...v, tris: Math.round(v.tris) }));
  arr.sort((a, b) => b.tris - a.tris);
  return JSON.stringify({ roots: arr.length, list: arr.slice(0, 16) });
})()
