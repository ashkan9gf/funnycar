// dump_glb_json.mjs — خواندن مستقیم JSON داخل GLB (بدون واسط کتابخانه)
import fs from 'fs';

for (const f of process.argv.slice(2)) {
  const buf = fs.readFileSync(f);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546C67) { console.log(f, 'NOT GLB'); continue; }
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));

  console.log('\n================', f.split('/').pop(), '================');
  console.log('asset:', JSON.stringify(json.asset));
  console.log('extensionsRequired:', json.extensionsRequired || '(none)');
  console.log('extensionsUsed:', json.extensionsUsed || '(none)');

  const stats = { nodes: json.nodes?.length || 0, meshes: json.meshes?.length || 0, materials: json.materials?.length || 0, textures: json.textures?.length || 0, images: json.images?.length || 0, accessors: json.accessors?.length || 0 };
  console.log('stats:', JSON.stringify(stats));

  console.log('\n-- meshes --');
  let tri = 0, vert = 0;
  (json.meshes || []).forEach((m, i) => {
    const prims = m.primitives.map(p => {
      const posAcc = json.accessors[p.attributes.POSITION];
      const idxAcc = p.indices !== undefined ? json.accessors[p.indices] : null;
      const t = idxAcc ? idxAcc.count / 3 : posAcc.count / 3;
      tri += t; vert += posAcc.count;
      const attrs = Object.keys(p.attributes).join('+');
      return `attrs=${attrs} verts=${posAcc.count} tris=${Math.round(t)} mode=${p.mode ?? 4}`;
    });
    console.log(`mesh[${i}] "${m.name || ''}" prims=${prims.length}`);
    prims.forEach(p => console.log('   ', p));
  });
  console.log('TOTAL tris:', Math.round(tri), 'verts:', vert);

  console.log('\n-- materials --');
  (json.materials || []).forEach((m, i) => {
    const pbr = m.pbrMetallicRoughness || {};
    const bc = pbr.baseColorFactor;
    const hex = bc ? '#' + bc.slice(0,3).map(x => Math.round(x*255).toString(16).padStart(2,'0')).join('') : '(default white)';
    console.log(`mat[${i}] "${m.name||''}" base=${hex} metal=${pbr.metallicFactor ?? 1} rough=${pbr.roughnessFactor ?? 1} baseTex=${pbr.baseColorTexture?'YES':'no'} ${Object.keys(m).filter(k=>!['name','pbrMetallicRoughness'].includes(k)).join(',') || ''}`);
  });

  console.log('\n-- images/textures --');
  (json.images || []).forEach((im, i) => console.log(`img[${i}] mime=${im.mimeType} name=${im.name||''}`));

  console.log('\n-- node tree (name | mesh | translation/rotation/scale) --');
  const dumpNode = (n, d) => {
    const t = n.translation ? `T[${n.translation.map(x=>Math.round(x)).join(',')}]` : '';
    const r = n.rotation ? `R[${n.rotation.map(x=>(+x).toFixed(2)).join(',')}]` : '';
    const s = n.scale ? `S[${n.scale.map(x=>Math.round(x*100)/100).join(',')}]` : '';
    console.log('  '.repeat(d) + `"${n.name||'(noname)'}" mesh=${n.mesh ?? '-'} ${t}${r}${s}`);
    (n.children || []).forEach(ci => dumpNode(json.nodes[ci], d + 1));
  };
  (json.scenes[json.scene || 0].nodes || []).forEach(ni => dumpNode(json.nodes[ni], 0));

  // world bbox via accessors min/max (approximate — ignores transforms unless applied)
  console.log('\n-- accessor min/max (POSITION) --');
  (json.accessors || []).forEach((a, i) => {
    if (a.type === 'VEC3' && a.min && a.max && json.meshes?.some(m => m.primitives.some(p => p.attributes.POSITION === undefined))) return;
  });
  // scene-level bbox: walk nodes with meshes, compose matrices
  const bbox = composeBBox(json);
  if (bbox) {
    const dim = [bbox.max[0]-bbox.min[0], bbox.max[1]-bbox.min[1], bbox.max[2]-bbox.min[2]];
    console.log(`WORLD BBOX min=[${bbox.min.map(v=>Math.round(v)).join(',')}] max=[${bbox.max.map(v=>Math.round(v)).join(',')}]`);
    console.log(`SIZE X(عرض)=${Math.round(dim[0])} Y(ارتفاع)=${Math.round(dim[1])} Z(طول)=${Math.round(dim[2])}  | متر: طول=${(dim[2]/48).toFixed(1)} عرض=${(dim[0]/48).toFixed(1)} ارتفاع=${(dim[1]/48).toFixed(1)} (1m=48u، پراید=172u)`);
  }
}

function composeBBox(json) {
  const min = [1e9,1e9,1e9], max = [-1e9,-1e9,-1e9];
  const ident = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const mul = (a, b) => { const o = new Array(16); for (let c=0;c<4;c++) for (let r=0;r<4;r++) { let s=0; for (let k=0;k<4;k++) s += a[k*4+r]*b[c*4+k]; o[c*4+r]=s; } return o; };
  const trs = (n) => {
    const m = [...ident];
    if (n.matrix) return [...n.matrix];
    if (n.translation) for (let r=0;r<3;r++) m[12+r] = n.translation[r];
    if (n.rotation) { const q = n.rotation; const rot = quatMat(q); const t = mul(m, rot); for (let i=0;i<16;i++) m[i]=t[i]; }
    if (n.scale) { for (let c=0;c<3;c++) for (let r=0;r<3;r++) m[c*4+r] *= n.scale[c]; }
    return m;
  };
  const quatMat = (q) => {
    const [x,y,z,w] = q;
    return [1-2*(y*y+z*z), 2*(x*y+z*w), 2*(x*z-y*w), 0,
            2*(x*y-z*w), 1-2*(x*x+z*z), 2*(y*z+x*w), 0,
            2*(x*z+y*w), 2*(y*z-x*w), 1-2*(x*x+y*y), 0,
            0,0,0,1];
  };
  const apply = (m, p) => [ m[0]*p[0]+m[1]*p[1]+m[2]*p[2]+m[3], m[4]*p[0]+m[5]*p[1]+m[6]*p[2]+m[7], m[8]*p[0]+m[9]*p[1]+m[10]*p[2]+m[11] ];
  const walk = (ni, pm) => {
    const n = json.nodes[ni];
    const m = mul(pm, trs(n));
    if (n.mesh !== undefined) {
      const mesh = json.meshes[n.mesh];
      for (const p of mesh.primitives) {
        const acc = json.accessors[p.attributes.POSITION];
        if (!acc?.min || !acc?.max) continue;
        for (const vx of [acc.min, acc.max]) for (const vy of [acc.min, acc.max]) for (const vz of [acc.min, acc.max]) {
          const w = apply(m, [vx[0], vy[1], vz[2]]);
          for (let a=0;a<3;a++){ if(w[a]<min[a]) min[a]=w[a]; if(w[a]>max[a]) max[a]=w[a]; }
        }
      }
    }
    (n.children || []).forEach(ci => walk(ci, m));
  };
  (json.scenes[json.scene || 0].nodes || []).forEach(ni => walk(ni, [...ident]));
  return (min[0] < 1e8) ? { min, max } : null;
}
