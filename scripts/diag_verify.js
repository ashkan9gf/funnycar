(() => {
  const R = window.__funnycar.renderer3d;
  const out = {};
  // مدل‌های ترافیک: تعداد مش per car
  const counts = [];
  R.trafficModels.forEach((m) => {
    let n = 0; m.group.traverse((o) => { if (o.isMesh) n++; });
    counts.push(n);
  });
  out.trafficMeshes = counts;
  // پارکی lod
  out.parkedLodSizes = R.parkedTmplLod ? [...R.parkedTmplLod.keys()] : 'none';
  let lodChunks = 0, fullChunks = 0;
  R.chunkVis.forEach((v) => { if (v.parkedLod) lodChunks++; else if (v.objects.length) fullChunks++; });
  out.lodChunks = lodChunks; out.fullChunks = fullChunks;
  // کل مش‌های صحنه
  let meshes = 0; R.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) meshes++; });
  out.totalMeshes = meshes;
  return JSON.stringify(out);
})()
