// debug_wheel_geo.mjs — توزیع رأس‌های هندسه چرخ: دیسک خالص یا چسبیده با قطعات بدنه؟
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import fs from 'fs';

const { assembleCarFromGLB } = await import('../src/game/render3d/GlbModels.ts');

const variant = process.argv[2] || 'renault4';
const buf = fs.readFileSync(`public/assets/models/vehicles/${variant}.glb`);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const model = assembleCarFromGLB(variant, gltf.scene, { external: true });
  model.group.updateMatrixWorld(true);
  for (const [i, ew] of (model.extWheels ?? []).entries()) {
    const mesh = ew.spinner.children.find((c) => c.isMesh);
    if (!mesh) continue;
    const pos = mesh.geometry.getAttribute('position');
    // مرکز هندسه در فضای محلی spinner (جا: مبدأ spinner = مرکز چرخ)
    const wp = new THREE.Vector3();
    const radii = [];
    let offCenter = 0, far = 0;
    const centerLocal = new THREE.Vector3(); // مرکز bbox هندسه در فضای spinner
    mesh.geometry.computeBoundingBox();
    const bc = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
    for (let v = 0; v < pos.count; v++) {
      wp.fromBufferAttribute(pos, v);
      const r = Math.hypot(wp.y - bc.y, wp.z - bc.z); // شعاع در صفحه چرخ (YZ)
      radii.push(r);
      if (r > 17.5) far++; // فراتر از شعاع دیسک (dia≈31)
    }
    radii.sort((a, b) => a - b);
    const p = (q) => radii[Math.floor(q * radii.length)].toFixed(1);
    console.log(`wheel[${i}] '${mesh.name}': verts=${pos.count} r: p50=${p(0.5)} p90=${p(0.9)} p99=${p(0.99)} max=${radii[radii.length - 1].toFixed(1)} | رأس‌های دور (>17.5): ${far} (${(100 * far / pos.count).toFixed(1)}%)`);
    console.log(`   bbox center در spinner-local: (${bc.x.toFixed(1)}, ${bc.y.toFixed(1)}, ${bc.z.toFixed(1)}) — باید نزدیک صفر باشد`);
    // آفرست مش نسبت به مبدأ spinner
    console.log(`   mesh.position در spinner: (${mesh.position.x.toFixed(1)}, ${mesh.position.y.toFixed(1)}, ${mesh.position.z.toFixed(1)})`);
  }
}, (err) => { console.error('parse error:', err?.message || err); process.exit(1); });
