// dump_assembled.mjs — dump every mesh of the ASSEMBLED car (real game code) + extWheels
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import fs from 'fs';

const car = process.argv[2] || 'police';
const { assembleCarFromGLB } = await import('../src/game/render3d/GlbModels.ts');

const buf = fs.readFileSync(`public/assets/models/vehicles/${car}.glb`);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const model = assembleCarFromGLB(car, gltf.scene, { external: true });
  model.group.updateMatrixWorld(true);
  model.group.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const wb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    const c = wb.getCenter(new THREE.Vector3());
    const sz = wb.getSize(new THREE.Vector3());
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const col = mats[0]?.color ? `#${mats[0].color.getHexString()}` : '?';
    // parent chain
    const chain = [];
    let p = o.parent;
    while (p && p !== model.group) { chain.unshift(p.type + (p.name ? `(${p.name.slice(0, 12)})` : '')); p = p.parent; }
    console.log(`${o.name.slice(0, 36).padEnd(36)} vis=${o.visible ? 1 : 0} c=(${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}) sz=(${sz.x.toFixed(1)},${sz.y.toFixed(1)},${sz.z.toFixed(1)}) ${col} chain=${chain.join('>')}`);
  });
  console.log('extWheels:', (model.extWheels ?? []).map((w) => `axis=(${w.axis.x.toFixed(2)},${w.axis.y.toFixed(2)},${w.axis.z.toFixed(2)}) sign=${w.sign}`).join(' | '));
}, (e) => { console.error('parse error', e); process.exit(1); });
