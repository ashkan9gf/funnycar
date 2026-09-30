// debug_assemble.mjs — اجرای همان assembleCarFromGLB بازی روی مدل جدید در bun
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import fs from 'fs';

// TS import از سورس بازی (bun مستقیم TS می‌خواند)
const { assembleCarFromGLB } = await import('../src/game/render3d/GlbModels.ts');
const { VEHICLE_SPECS } = await import('../src/game/render3d/vehicleGeometry.ts');

const variant = process.argv[2] || 'renault4';
const buf = fs.readFileSync(`public/assets/models/vehicles/${variant}.glb`);
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  const scene = gltf.scene;
  console.log('src scene children:', scene.children.length);
  const sb = new THREE.Box3().setFromObject(scene);
  console.log('src bbox:', JSON.stringify({ min: sb.min.toArray().map(Math.round), max: sb.max.toArray().map(Math.round) }));
  try {
    const model = assembleCarFromGLB(variant, scene, { external: true });
    model.group.updateMatrixWorld(true);
    const gb = new THREE.Box3().setFromObject(model.group);
    console.log('assembled children:', model.group.children.length);
    console.log('assembled bbox:', JSON.stringify({ min: gb.min.toArray().map((v) => Math.round(v)), max: gb.max.toArray().map((v) => Math.round(v)) }));
    console.log('extWheels:', model.extWheels?.length, 'steerable:', model.steerable?.length);
    let meshes = 0, nanPos = 0;
    model.group.traverse((o) => {
      if (o.isMesh) {
        meshes++;
        const p = o.geometry.getAttribute('position');
        for (let i = 0; i < p.array.length; i++) {
          if (Number.isNaN(p.array[i])) { nanPos++; break; }
        }
      }
    });
    console.log('meshes:', meshes, 'meshes with NaN:', nanPos);
  } catch (e) {
    console.error('ASSEMBLE ERROR:', e.message, e.stack?.split('\n')[1]);
  }
}, (err) => { console.error('parse error:', err?.message || err); process.exit(1); });
