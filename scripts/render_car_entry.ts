/**
 * render_car_entry.ts — standalone headless render of a car GLB via real game code.
 * Bundle: bun build scripts/render_car_entry.ts --outfile scripts/render_car_bundle.js
 * Page:   scripts/render_car_page.html?car=police&view=all
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { assembleCarFromGLB } from '../src/game/render3d/GlbModels';
import { spinWheels } from '../src/game/render3d/CarFactory3D';

const params = new URLSearchParams(location.search);
const car = params.get('car') || 'police';
const spins = params.get('spins') === '1';
const buf = await fetch(`/assets/models/vehicles/${car}.glb`).then((r) => r.arrayBuffer());

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise<any>((res, rej) => loader.parse(buf, '', res, rej));

const model = assembleCarFromGLB(car, gltf.scene, { external: true });
model.group.updateMatrixWorld(true);
if (spins) for (let i = 0; i < 30; i++) spinWheels(model, 0.05);
model.group.updateMatrixWorld(true);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(560, 380);
renderer.setClearColor(0xdfe8ee);
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 1.1));
const dl = new THREE.DirectionalLight(0xffffff, 1.6);
dl.position.set(3, 6, 4);
scene.add(dl);
scene.add(model.group);

const bb = new THREE.Box3().setFromObject(model.group);
const c = bb.getCenter(new THREE.Vector3());
const size = bb.getSize(new THREE.Vector3());
const dist = Math.max(size.x, size.y, size.z) * 1.35;

const VIEWS: Array<[string, number, number]> = [
  ['fl', -0.7, 0.30],   // front-left 3/4
  ['fr', 0.7, 0.30],
  ['left', -1.57, 0.22],
  ['right', 1.57, 0.22],
  ['rear', 3.05, 0.25],
  ['low', -0.6, 0.06],  // low angle to see wheels
];
const out = document.createElement('div');
out.style.cssText = 'font:12px monospace;white-space:pre';
document.body.appendChild(out);

let idx = 0;
function shoot(): void {
  const [name, az, el] = VIEWS[idx];
  const cam = new THREE.PerspectiveCamera(38, 560 / 380, 0.1, 4000);
  cam.position.set(
    c.x + dist * Math.cos(el) * Math.sin(az),
    c.y + dist * Math.sin(el) + size.y * 0.1,
    c.z + dist * Math.cos(el) * Math.cos(az),
  );
  cam.lookAt(c.x, c.y, c.z);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');
  const img = new Image();
  img.src = url;
  img.style.width = '280px';
  document.body.appendChild(img);
  out.textContent += `${name} `;
  idx++;
  if (idx < VIEWS.length) setTimeout(shoot, 60);
  else (window as any).__RENDER_DONE = idx;
}
shoot();
