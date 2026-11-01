(() => {
  const R = window.__funnycar.renderer3d;
  const glb = R.glb;
  const out = { parked: [], traffic: [] };
  const triOf = (sc) => { let t = 0, ms = 0; sc.traverse((o) => { const m = o; if (m.isMesh) { ms++; const p = m.geometry.attributes.position; if (p) t += p.count / 3; } }); return { tris: Math.round(t), meshes: ms }; };
  const kinds = ['peugeot405', 'samand', 'renault4', 'vintage'];
  for (const k of kinds) {
    const full = glb.ready.get('vehicles/' + k + '.glb');
    const lod = glb.ready.get('vehicles/' + k + '_lod1.glb');
    out.parked.push(k + ': full=' + (full ? JSON.stringify(triOf(full)) : 'null') + ' lod1=' + (lod ? JSON.stringify(triOf(lod)) : 'null'));
  }
  for (const v of ['player', 'pride', 'tiba', 'taxi', 'police', 'nissan']) {
    const full = glb.ready.get('vehicles/' + v + '.glb');
    const lod = glb.ready.get('vehicles/' + v + '_lod1.glb');
    out.traffic.push(v + ': full=' + (full ? JSON.stringify(triOf(full)) : 'null') + ' lod1=' + (lod ? JSON.stringify(triOf(lod)) : 'null'));
  }
  return JSON.stringify(out);
})()
