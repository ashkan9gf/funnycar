/**
 * render_car_zoom_entry.ts — HIGH-RES close-up render of a car GLB for fine-paint inspection.
 * Bundle: bun build scripts/render_car_zoom_entry.ts --outfile scripts/render_car_zoom_bundle.js
 * Page:   scripts/render_car_page.html?zoompage=1&car=pride
 * Renders 6 close-up views (wheel L, wheel R, glass edge F, glass edge R, rear lights, front) at 1000x700.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { assembleCarFromGLB } from '../src/game/render3d/GlbModels';
import { spinWheels } from '../src/game/render3d/CarFactory3D';

const params = new URLSearchParams(location.search);
const car = params.get('car') || 'police';
const bust = params.get('bust') || String(Date.now());
const buf = await fetch(`/assets/models/vehicles/${car}.glb?bust=${bust}`, { cache: 'no-store' }).then((r) => r.arrayBuffer());

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise<any>((res, rej) => loader.parse(buf, '', res, rej));

// 🔍 probe: what does each mesh's material + COLOR_0 look like after game assembly?
const probe: string[] = [];
gltf.scene.updateMatrixWorld(true);
gltf.scene.traverse((o: any) => {
  if (!o.isMesh) return;
  const g2 = o.geometry as THREE.BufferGeometry;
  const c0 = g2.getAttribute('color') as THREE.BufferAttribute | undefined;
  let c0info = 'no-color';
  if (c0) {
    const n = Math.min(6, c0.count);
    const parts: string[] = [];
    for (let i = 0; i < n; i++) parts.push([c0.getX(i), c0.getY(i), c0.getZ(i), c0.getW(i)].map((v) => v.toFixed(2)).join(','));
    c0info = `color[${c0.count}] first={${parts.join(' | ')}}`;
  }
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const mdesc = mats.map((m: any) => `${m.type}(${m.name || '?'})c=${m.color ? [m.color.r, m.color.g, m.color.b].map((v: number) => v.toFixed(2)).join(',') : '-'} vc=${m.vertexColors ? 1 : 0} map=${m.map ? 1 : 0}`).join('; ');
  probe.push(`${o.name || '(noname)'}: ${c0info} mat=${mdesc}`);
});
(window as any).__PROBE = probe.join('\n');
const model = assembleCarFromGLB(car, gltf.scene, { external: true });
const probe2: string[] = [];
model.group.traverse((o: any) => {
  if (!o.isMesh) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const mdesc = mats.map((m: any) => `${m.type}(${m.name || '?'})c=${m.color ? [m.color.r, m.color.g, m.color.b].map((v: number) => v.toFixed(2)).join(',') : '-'} vc=${m.vertexColors ? 1 : 0} map=${m.map ? 1 : 0}`).join('; ');
  probe2.push(`${o.name || '(noname)'}: mat=${mdesc}`);
});
(window as any).__PROBE2 = probe2.join('\n');
model.group.updateMatrixWorld(true);
for (let i = 0; i < 2; i++) spinWheels(model, 0.05);
model.group.updateMatrixWorld(true);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1000, 700);
renderer.setClearColor(0xdfe8ee);
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 1.05));
const dl = new THREE.DirectionalLight(0xffffff, 1.6);
dl.position.set(3, 6, 4);
scene.add(dl);
const dl2 = new THREE.DirectionalLight(0xfff2e0, 0.7);
dl2.position.set(-4, 3, -5);
scene.add(dl2);
scene.add(model.group);

// find wheel centers & car bbox for close-up targets
const bb = new THREE.Box3().setFromObject(model.group);
const c = bb.getCenter(new THREE.Vector3());
const size = bb.getSize(new THREE.Vector3());
const half = size.x * 0.5;
const wheelY = bb.min.y + size.y * 0.16;

// targets: [azimuth, elevation, lookAtOffset(x,y,z), distScale]
const T: Array<[string, number, number, THREE.Vector3, number]> = [
  ['wheelFL', -0.55, 0.05, new THREE.Vector3(-half * 0.72, wheelY, half * 0.72), 0.42],
  ['wheelRR', 2.6, 0.08, new THREE.Vector3(half * 0.72, wheelY, -half * 0.72), 0.42],
  ['glassF', -0.35, 0.42, new THREE.Vector3(0, c.y + size.y * 0.22, half * 0.25), 0.5],
  ['glassR', 2.75, 0.40, new THREE.Vector3(0, c.y + size.y * 0.22, -half * 0.25), 0.5],
  ['rear', 3.05, 0.20, new THREE.Vector3(0, c.y, -half * 0.3), 0.55],
  ['front', 0.12, 0.16, new THREE.Vector3(0, c.y, half * 0.3), 0.55],
];
const out = document.createElement('div');
out.style.cssText = 'font:12px monospace;white-space:pre';
document.body.appendChild(out);

let idx = 0;
function shoot(): void {
  const [name, az, el, at, ds] = T[idx];
  const cam = new THREE.PerspectiveCamera(30, 1000 / 700, 0.05, 4000);
  const dist = Math.max(size.x, size.y, size.z) * 1.35 * ds;
  cam.position.set(
    at.x + dist * Math.cos(el) * Math.sin(az),
    at.y + dist * Math.sin(el),
    at.z + dist * Math.cos(el) * Math.cos(az),
  );
  cam.lookAt(at.x, at.y, at.z);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');
  const img = new Image();
  img.src = url;
  img.style.width = '500px';
  document.body.appendChild(img);
  out.textContent += `${name} `;
  idx++;
  if (idx < T.length) setTimeout(shoot, 60);
  else (window as any).__RENDER_DONE = idx;
}
shoot();
