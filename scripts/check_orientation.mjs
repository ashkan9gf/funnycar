// check_orientation.mjs — بررسی واقعی جهت مدل نوشته‌شده با three.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';

const file = process.argv[2];
const buf = fs.readFileSync(file);
const loader = new GLTFLoader();
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const gb = new THREE.Box3().setFromObject(scene);
  const size = gb.getSize(new THREE.Vector3());
  const center = gb.getCenter(new THREE.Vector3());
  console.log(`bbox size: X=${size.x.toFixed(0)} Y=${size.y.toFixed(0)} Z=${size.z.toFixed(0)}  center=(${center.x.toFixed(0)},${center.y.toFixed(0)},${center.z.toFixed(0)})`);
  console.log(`bbox min.y=${gb.min.y.toFixed(1)} max.y=${gb.max.y.toFixed(1)}`);
  scene.traverse((o) => {
    if (o.isMesh && /wheel/i.test(o.name)) {
      const wb = new THREE.Box3().setFromObject(o);
      const wc = wb.getCenter(new THREE.Vector3());
      console.log(`wheel '${o.name}': centerY=${wc.y.toFixed(1)}  (body midY=${(gb.min.y + gb.max.y) / 2 | 0})  z=${wc.z.toFixed(0)} x=${wc.x.toFixed(0)}`);
    }
  });
}, (err) => { console.error('parse error:', err.message); process.exit(1); });
