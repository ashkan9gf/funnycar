import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
const buf = await fetch('/assets/models/vehicles/nissan.glb').then((r) => r.arrayBuffer());
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise((res, rej) => loader.parse(buf, '', res, rej));
gltf.scene.traverse((o) => {
  if (o.isMesh) {
    const m = o.material;
    console.log('mesh', o.name, '| mat type:', m.type, '| vertexColors:', m.vertexColors, '| metalness:', m.metalness, '| roughness:', m.roughness, '| color:', JSON.stringify(m.color));
  }
});
