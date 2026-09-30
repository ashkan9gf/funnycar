// verify_wheels.mjs — بررسی متریال/وضعیت چرخ‌ها بعد از assemble با کد واقعی بازی
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import fs from 'fs';

const { assembleCarFromGLB } = await import('../src/game/render3d/GlbModels.ts');

const variant = process.argv[2] || 'renault4';
const { spinWheels } = await import('../src/game/render3d/CarFactory3D.ts');
const buf = fs.readFileSync(`public/assets/models/vehicles/${variant}.glb`);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const model = assembleCarFromGLB(variant, gltf.scene, { external: true });
  model.group.updateMatrixWorld(true);
  // ۱) مش‌های wheel-named و متریالشان
  model.group.traverse((o) => {
    if (!o.isMesh) return;
    const n = (o.name || '').toLowerCase();
    if (n.includes('wheel') || n.includes('tire') || n.includes('tyre')) {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const isToon = m instanceof THREE.MeshToonMaterial;
      const col = m?.color ? `#${m.color.getHexString()}` : '?';
      const hasMap = !!m?.map;
      // آیا داخل spinner است؟
      let p = o.parent, inSpinner = false;
      while (p) { if (p.name === '' && p.type === 'Group' && p.parent && p.parent.type === 'Group') { /* noop */ } p = p.parent; }
      console.log(`wheel-mesh '${o.name}': mat=${isToon ? 'toon' : m?.type} color=${col} map=${hasMap}`);
    }
  });
  // ۲) خوشه‌های چرخ — محور/جهت/صلیب سفید
  console.log('extWheels:', model.extWheels?.length);
  for (const ew of model.extWheels ?? []) {
    console.log(`  spin axis=(${ew.axis.x.toFixed(1)},${ew.axis.y.toFixed(1)},${ew.axis.z.toFixed(1)}) sign=${ew.sign} children=${ew.spinner.children.length}`);
    // صلیب سفید نباید باشد: بچه‌های BoxGeometry با متریال روشن
    ew.spinner.traverse((c) => {
      if (c.isMesh && c.geometry?.type === 'BoxGeometry') {
        const m = c.material;
        console.log(`  ⚠ leftover spin-cross box! color=#${m?.color?.getHexString()}`);
      }
    });
  }
  // ۳) شبیه‌سازی ۶۰۰ فریم اسپین — چرخ نباید کج شود (کاترنیون مطلق)

  for (let i = 0; i < 600; i++) spinWheels(model, 0.12);
  if (model.extWheels?.length) {
    const q = model.extWheels[0].spinner.quaternion;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    console.log(`after 600 frames: spinner-up.y=${up.y.toFixed(3)} (باید ثابت بماند)`);
    const q2 = model.extWheels[0].spinner.quaternion;
    for (let i = 0; i < 600; i++) spinWheels(model, 0.12);
    const up2 = new THREE.Vector3(0, 1, 0).applyQuaternion(q2);
    console.log(`drift check: up.y بعد از ۱۲۰۰ فریم = ${up2.y.toFixed(3)}`);
  }
}, (err) => { console.error('parse error:', err?.message || err); process.exit(1); });
