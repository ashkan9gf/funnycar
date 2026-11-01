(() => {
  const R = window.__funnycar.renderer3d;
  const S = R.scene;
  const orphans = [];
  S.traverse((o) => {
    const m = o;
    if (!m.isMesh || m.isInstancedMesh) return;
    if (m.parent !== S) return;
    const p = m.geometry.attributes.position;
    const tris = p ? p.count / 3 : 0;
    if (tris < 30000) return;
    orphans.push({ mesh: m, tris: Math.round(tris), geoId: m.geometry.uuid });
  });
  // جمع‌آوری همهٔ صحنه‌های قالب GLB از کش
  const glb = R.glb;
  const templates = [];
  if (glb && glb.ready) {
    glb.ready.forEach((sc, path) => {
      sc.traverse((o) => {
        const m = o;
        if (m.isMesh) templates.push({ path, mesh: m });
      });
    });
  }
  const tmap = new Map();
  for (const t of templates) tmap.set(t.mesh.uuid, t.path);
  const hits = [];
  for (const or of orphans) {
    const hit = tmap.get(or.geoId);
    hits.push({ tris: or.tris, matched: hit || null });
  }
  const matched = hits.filter((h) => h.matched).length;
  return JSON.stringify({ orphans: orphans.length, templates: templates.length, matched, sample: hits.slice(0, 12) });
})()
