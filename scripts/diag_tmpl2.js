(() => {
  const R = window.__funnycar.renderer3d;
  const glb = R.glb;
  const count = (sc) => { let n = 0, statics = 0; sc.traverse((o) => { if (o.isMesh) { n++; if (o.name === '__static') statics++; } }); return n + 'm/' + statics + 's'; };
  const out = {};
  for (const v of ['player', 'pride', 'peugeot405', 'samand', 'nissan', 'tiba', 'taxi', 'police']) {
    const full = glb.ready.get('vehicles/' + v + '.glb');
    const lod = glb.ready.get('vehicles/' + v + '_lod1.glb');
    out[v] = { full: full ? count(full) : 'null', lod1: lod ? count(lod) : 'null' };
  }
  return JSON.stringify(out);
})()
