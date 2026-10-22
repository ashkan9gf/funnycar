// dump_police_meshes.mjs — accurate world bbox for every mesh of police.glb (raw GLB, no assemble)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import fs from 'fs';

const buf = fs.readFileSync('public/assets/models/vehicles/challenger.glb');
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const g = gltf.scene;
  g.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(g);
  const size = bb.getSize(new THREE.Vector3());
  console.log('model bbox:', JSON.stringify(bb.min), JSON.stringify(bb.max), 'size:', JSON.stringify(size));
  g.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const wb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = wb.getCenter(new THREE.Vector3());
    const sz = wb.getSize(new THREE.Vector3());
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const col = mats[0]?.color ? `#${mats[0].color.getHexString()}` : '?';
    console.log(`${o.name.slice(0, 42).padEnd(42)} c=(${c.x.toFixed(2)},${c.y.toFixed(2)},${c.z.toFixed(2)}) sz=(${sz.x.toFixed(2)},${sz.y.toFixed(2)},${sz.z.toFixed(2)}) mat=${col}`);
  });
}, (e) => { console.error('parse error', e); process.exit(1); });
