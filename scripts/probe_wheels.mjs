// probe_wheels.mjs — کِی چرخ‌ها پایین‌اند یا بالا؟ تراکم مثلث در کره‌های پایین و بالا
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';

const file = process.argv[2];
const buf = fs.readFileSync(file);
const loader = new GLTFLoader();
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const g = gltf.scene;
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3());
  const H = size.y, L = size.z, W = size.x;
  const wheelR = L * 0.135;
  const axle = L * 0.32;
  let downTri = 0, upTri = 0;
  const r2 = Math.pow(wheelR * 1.5, 2);
  const centersDown = [], centersUp = [];
  for (const sx of [1, -1]) for (const sz of [1, -1]) {
    centersDown.push([sx * (W / 2 - wheelR * 0.55), wheelR, sz * axle]);
    centersUp.push([sx * (W / 2 - wheelR * 0.55), H - wheelR, sz * axle]);
  }
  g.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.getAttribute('position');
    const idx = o.geometry.getIndex();
    const parr = pos.array;
    const triOf = (i0, i1, i2) => {
      const vs = [[parr[i0*3],parr[i0*3+1],parr[i0*3+2]], [parr[i1*3],parr[i1*3+1],parr[i1*3+2]], [parr[i2*3],parr[i2*3+1],parr[i2*3+2]]];
      for (const [arr, dst] of [[centersDown, 'd'], [centersUp, 'u']]) {
        for (const c of arr) {
          let inside = true;
          for (const v of vs) {
            const dx = v[0]-c[0], dy = v[1]-c[1], dz = v[2]-c[2];
            if (dx*dx+dy*dy+dz*dz > r2) { inside = false; break; }
          }
          if (inside) return dst;
        }
      }
      return null;
    };
    const n = idx ? idx.count : pos.count;
    const useIdx = !!idx;
    for (let t = 0; t < n; t += 3) {
      const i0 = useIdx ? idx.array[t] : t, i1 = useIdx ? idx.array[t+1] : t+1, i2 = useIdx ? idx.array[t+2] : t+2;
      const r = triOf(i0, i1, i2);
      if (r === 'd') downTri++; else if (r === 'u') upTri++;
    }
  });
  console.log(`${file.split('/').pop()}:  tris in BOTTOM wheel-spheres = ${downTri}   tris in TOP wheel-spheres = ${upTri}   → ${downTri > upTri ? '✅ چرخ‌ها پایین (درست)' : '❌ چرخ‌ها بالا (وارونه!)'}`);
}, (e) => { console.error('parse fail', e?.message); process.exit(1); });
