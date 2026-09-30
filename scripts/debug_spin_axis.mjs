// debug_spin_axis.mjs — چرا چرخ حول محور اشتباه می‌چرخد؟
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
  const ew = model.extWheels[0];
  const mesh = ew.spinner.children.find((c) => c.isMesh);
  console.log('axis(local)=', ew.axis.toArray().map((v) => +v.toFixed(2)), 'sign=', ew.sign);
  console.log('spinner localQ=', ew.spinner.quaternion.toArray().map((v) => +v.toFixed(2)));
  console.log('spinner worldQ=', ew.spinner.getWorldQuaternion(new THREE.Quaternion()).toArray().map((v) => +v.toFixed(2)));
  console.log('mesh localQ (in spinner)=', mesh.quaternion.toArray().map((v) => +v.toFixed(2)));
  console.log('mesh worldQ=', mesh.getWorldQuaternion(new THREE.Quaternion()).toArray().map((v) => +v.toFixed(2)));
  // محور واقعی لاستیک: باریک‌ترین بعد جهانی هندسه بعد از اعمال ماتریس جهانی مش
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const sz = mesh.geometry.boundingBox.getSize(new THREE.Vector3());
  console.log('geometry LOCAL size=', sz.toArray().map((v) => +v.toFixed(1)));
  // چه محوری در spinner-local باید بچرخد تا world-X شود؟
  const invSpinner = ew.spinner.getWorldQuaternion(new THREE.Quaternion()).invert();
  const desiredLocal = new THREE.Vector3(1, 0, 0).applyQuaternion(invSpinner);
  console.log('world-X در spinner-local =', desiredLocal.toArray().map((v) => +v.toFixed(2)));

  // تست: چرخش حول محور درست (world-X) در برابر محور فعلی
  const measure = () => {
    model.group.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(mesh);
    return b.getSize(new THREE.Vector3()).toArray().map((v) => +v.toFixed(0)).join('x');
  };
  console.log('bbox t=0:', measure());
  for (let i = 0; i < 100; i++) spinWheels(model, 0.12);
  console.log('bbox t=100 (کد فعلی):', measure());

  // حالا با محور اصلاح‌شده (world-X → spinner-local)
  ew.angle = 0;
  const fixedAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(
    ew.spinner.getWorldQuaternion(new THREE.Quaternion()).invert(),
  );
  if (Math.abs(fixedAxis.x) >= Math.abs(fixedAxis.z)) fixedAxis.set(Math.sign(fixedAxis.x) || 1, 0, 0);
  else fixedAxis.set(0, 0, Math.sign(fixedAxis.z));
  const q = new THREE.Quaternion();
  for (let i = 0; i < 100; i++) {
    ew.angle += ew.sign * 0.12;
    ew.spinner.quaternion.copy(ew.base).multiply(q.setFromAxisAngle(fixedAxis, ew.angle));
  }
  console.log('bbox t=100 (محور اصلاح):', measure(), 'fixedAxis=', fixedAxis.toArray().map((v) => +v.toFixed(1)));
}, (err) => { console.error('parse error:', err?.message || err); process.exit(1); });
