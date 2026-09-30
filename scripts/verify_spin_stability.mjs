// verify_spin_stability.mjs — تست واقعی: bbox جهانی چرخ هنگام اسپین باید ثابت بماند
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import fs from 'fs';

const { assembleCarFromGLB } = await import('../src/game/render3d/GlbModels.ts');
const { spinWheels } = await import('../src/game/render3d/CarFactory3D.ts');

const variant = process.argv[2] || 'renault4';
const buf = fs.readFileSync(`public/assets/models/vehicles/${variant}.glb`);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const model = assembleCarFromGLB(variant, gltf.scene, { external: true });
  model.group.updateMatrixWorld(true);

  // bbox جهانی هر خوشه چرخ (از مش‌های داخل spinner)
  const wheelBox = (ew) => {
    const b = new THREE.Box3();
    for (const m of ew.spinner.children) {
      if (m.isMesh) b.expandByObject(m);
    }
    return b.getSize(new THREE.Vector3());
  };

  model.group.updateMatrixWorld(true);
  const sizes0 = (model.extWheels ?? []).map(wheelBox);
  console.log(`t=0   : ${sizes0.map((s) => `${s.x.toFixed(0)}x${s.y.toFixed(0)}x${s.z.toFixed(0)}`).join(' | ')}`);

  for (let i = 0; i < 150; i++) spinWheels(model, 0.12);
  model.group.updateMatrixWorld(true);
  const sizes1 = (model.extWheels ?? []).map(wheelBox);
  console.log(`t=150 : ${sizes1.map((s) => `${s.x.toFixed(0)}x${s.y.toFixed(0)}x${s.z.toFixed(0)}`).join(' | ')}`);

  for (let i = 0; i < 450; i++) spinWheels(model, 0.12);
  model.group.updateMatrixWorld(true);
  const sizes2 = (model.extWheels ?? []).map(wheelBox);
  console.log(`t=600 : ${sizes2.map((s) => `${s.x.toFixed(0)}x${s.y.toFixed(0)}x${s.z.toFixed(0)}`).join(' | ')}`);

  // قضاوت: بیشترین تغییر هر بُعد در هر خوشه
  let worst = 0;
  for (let k = 0; k < sizes0.length; k++) {
    const d = Math.max(
      Math.abs(sizes0[k].x - sizes2[k].x),
      Math.abs(sizes0[k].y - sizes2[k].y),
      Math.abs(sizes0[k].z - sizes2[k].z),
    );
    worst = Math.max(worst, d);
  }
  console.log(`MAX bbox drift = ${worst.toFixed(2)} units  ${worst < 1.5 ? '✅ محور چرخش درست است' : '❌ چرخ می‌غلتد/کج می‌شود!'}`);
}, (err) => { console.error('parse error:', err?.message || err); process.exit(1); });
