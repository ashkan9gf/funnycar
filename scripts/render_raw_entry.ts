/**
 * render_raw_entry.ts — plain GLTF render, NO game assembly. Shows exactly what the file contains.
 * Page: scripts/render_car_page.html?rawpage=1&car=player
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const params = new URLSearchParams(location.search);
const car = params.get('car') || 'player';
const src = params.get('src') || 'final'; // final | raw
const file = src === 'raw'
  ? `../raw_assets/models/vehicles/${car}.glb`
  : `/assets/models/vehicles/${car}.glb`;
const buf = await fetch(file, { cache: 'no-store' }).then((r) => r.arrayBuffer());

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
const gltf = await new Promise<any>((res, rej) => loader.parse(buf, '', res, rej));

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(1000, 700);
renderer.setClearColor(0xdfe8ee);
document.body.style.margin = '0';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 1.3));
const dl = new THREE.DirectionalLight(0xffffff, 1.6);
dl.position.set(3, 6, 4);
scene.add(dl);
scene.add(gltf.scene);

// list mesh names + material info
const info: string[] = [];
gltf.scene.traverse((o: any) => {
  if (o.isMesh) {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const desc = mats.map((m: any) => `${m.name || '?'}${m.map ? '+tex' : ''}${m.vertexColors ? '+vc' : ''}`).join(',');
    info.push(`${o.name || '(noname)'} f=${o.geometry.index ? o.geometry.index.count / 3 : '?'} mat=[${desc}]`);
  }
});
const out = document.createElement('div');
out.style.cssText = 'font:11px monospace;white-space:pre';
out.textContent = info.join('\n');
document.body.appendChild(out);

const bb = new THREE.Box3().setFromObject(gltf.scene);
const c = bb.getCenter(new THREE.Vector3());
const size = bb.getSize(new THREE.Vector3());
const dist = Math.max(size.x, size.y, size.z) * 1.1;

const VIEWS: Array<[string, number, number]> = [
  ['fl3q', -0.7, 0.30],
  ['wheelLow', -0.6, 0.06],
];
let idx = 0;
function shoot(): void {
  const [name, az, el] = VIEWS[idx];
  const cam = new THREE.PerspectiveCamera(38, 1000 / 700, 0.05, 8000);
  cam.position.set(
    c.x + dist * Math.cos(el) * Math.sin(az),
    c.y + dist * Math.sin(el) + size.y * 0.05,
    c.z + dist * Math.cos(el) * Math.cos(az),
  );
  cam.lookAt(c.x, c.y, c.z);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');
  const img = new Image();
  img.src = url;
  img.style.width = '500px';
  document.body.appendChild(img);
  idx++;
  if (idx < VIEWS.length) setTimeout(shoot, 60);
  else (window as any).__RENDER_DONE = idx;
}
shoot();
