/**
 * GlbModels.ts — کتابخانه GLB ران‌تایم (فاز GRAPHICS_OVERHAUL)
 * ============================================================
 *  - load(): fetch + GLTFLoader.parse با cache و جلوگیری از duplicate-load
 *  - fallback: هر خطا → null (بازی با مدل procedural ادامه می‌یابد — بدون Regression)
 *  - buildCarFromGLB(): از صحنه GLB یک CarModel3D می‌سازد (چرخ/سپر/چراغ ترمز/چراغ‌گردان)
 * سبک: متریال PBR از GLB + خط دور معکوس کارتونی روی بدنه (ترکیب «Stylized + PBR»)
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CarModel3D, CarVariant } from './CarFactory3D';
import { VEHICLE_SPECS, FIXED_COLORS, VEHICLE_COLORS } from './vehicleGeometry';

/** پالت رنگ تصادفی ترافیک — پراید غالب مثل خیابان واقعی */
export function pickBodyColor(variant: CarVariant): string {
  if (variant === 'player') return FIXED_COLORS.player ?? '#f4f4f0';
  if (variant === 'taxi') return FIXED_COLORS.taxi ?? '#f2c230';
  if (variant === 'police') return FIXED_COLORS.police ?? '#f7f7f2';
  if (variant === 'nissan') return FIXED_COLORS.nissan ?? '#2f6fae';
  const list = VEHICLE_COLORS[variant];
  if (!list || list.length === 0) return '#d9d9d4';
  return list[Math.floor(Math.random() * list.length)];
}

export class GlbLibrary {
  private cache = new Map<string, Promise<THREE.Group | null>>();
  private loader = new GLTFLoader();

  constructor(private baseUrl = '/assets/models') {}

  /** فایل GLB را (یک‌بار) لود می‌کند؛ خطا → null */
  load(relPath: string): Promise<THREE.Group | null> {
    let p = this.cache.get(relPath);
    if (p) return p;
    p = new Promise<THREE.Group | null>((resolve) => {
      fetch(`${this.baseUrl}/${relPath}`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then((buf) => {
          this.loader.parse(buf, '', (gltf) => resolve(gltf.scene as THREE.Group), () => resolve(null));
        })
        .catch(() => resolve(null));
    });
    this.cache.set(relPath, p);
    return p;
  }

  /** خودرو از GLB — بازگشت null اگر هنوز لود نشده/شکست خورده */
  async loadCar(variant: CarVariant, lod1: boolean): Promise<THREE.Group | null> {
    const file = lod1 && variant !== 'player' ? `${variant}_lod1.glb` : `${variant}.glb`;
    const scene = await this.load(`vehicles/${file}`);
    return scene;
  }

  /** ساختمان GLB */
  async loadBuilding(type: string, variance: number): Promise<THREE.Group | null> {
    const v = variance % 3;
    return this.load(`buildings/${type}_${v}.glb`);
  }
}

/** ساخت گروه ماشین از صحنه GLB — با کلون صحنه برای هر نمونه */
export function assembleCarFromGLB(
  variant: CarVariant,
  srcScene: THREE.Group,
  opts: { lite?: boolean; bodyColor?: string } = {},
): CarModel3D {
  const spec = VEHICLE_SPECS[variant];
  const lite = opts.lite === true;
  const bodyColor = opts.bodyColor ?? pickBodyColor(variant);

  const g = srcScene.clone(true);
  const wheels: THREE.Mesh[] = [];
  const steerable: THREE.Group[] = [];
  let bodyMat: THREE.MeshToonMaterial | null = null;
  let bumpers: CarModel3D['bumpers'] = { front: null, rear: null };
  let tailMat: THREE.MeshStandardMaterial | null = null;
  let lightBar: CarModel3D['lightBar'] | undefined;

  // متریال‌های مشترک ران‌تایم
  const outlineMat = new THREE.MeshBasicMaterial({ color: '#231a14', side: THREE.BackSide });

  g.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    const name = mesh.name;

    if (name === 'body') {
      // بدنه: Toon کارتونی با رنگ نمونه + خط دور
      bodyMat = new THREE.MeshToonMaterial({ color: bodyColor, gradientMap: getGradient() });
      mesh.material = bodyMat;
      if (!lite) {
        const outline = new THREE.Mesh(mesh.geometry, outlineMat);
        outline.scale.setScalar(1.04);
        mesh.add(outline);
      }
    } else if (name === 'glass') {
      mesh.material = new THREE.MeshPhongMaterial({ color: '#20303c', shininess: 130, specular: '#9fb6c4', transparent: true, opacity: 0.94 });
    } else if (name.startsWith('wheel_')) {
      mesh.material = new THREE.MeshToonMaterial({ color: '#23211f', gradientMap: getGradient() });
      wheels.push(mesh);
      // چرخ‌های جلو: pivot فرمان
      if (name.endsWith('_fl') || name.endsWith('_fr')) {
        const pivot = new THREE.Group();
        pivot.position.copy(mesh.position);
        mesh.position.set(0, 0, 0);
        mesh.parent?.add(pivot);
        pivot.add(mesh);
        steerable.push(pivot);
      }
    } else if (name === 'lights_rear') {
      tailMat = new THREE.MeshStandardMaterial({ color: '#e2574c', emissive: '#5a0f08', emissiveIntensity: 0.7, roughness: 0.4 });
      mesh.material = tailMat;
    } else if (name === 'lights_front') {
      mesh.material = new THREE.MeshStandardMaterial({ color: '#fff2c4', emissive: '#8a7f52', emissiveIntensity: 0.5, roughness: 0.4 });
    } else if (name === 'lightbar_red') {
      mesh.material = new THREE.MeshBasicMaterial({ color: '#ff2d2d' });
      lightBar = lightBar ?? { red: mesh, blue: mesh };
      // بعداً blue جایگزین می‌شود
      (lightBar as { red: THREE.Mesh }).red = mesh;
    } else if (name === 'lightbar_blue') {
      mesh.material = new THREE.MeshBasicMaterial({ color: '#2d6bff' });
      lightBar = lightBar ?? { red: mesh, blue: mesh };
      (lightBar as { blue: THREE.Mesh }).blue = mesh;
    }
    // trim/bumper/plate: متریال PBR از GLB می‌ماند (vertex color دارد)
  });

  if (!bodyMat) bodyMat = new THREE.MeshToonMaterial({ color: bodyColor, gradientMap: getGradient() });

  return {
    group: g,
    wheels,
    bodyColor,
    bodyMat,
    bumpers,
    lightBar,
    len: spec.len,
    wid: spec.wid,
    // فیلدهای توسعه‌یافته (فاز OVERHAUL)
    ...{ steerable, tailMat, damageTiltZ: 0, rollZ: 0, pitchX: 0 },
  } as CarModel3D;
}

// ---------- گرادیان تون مشترک ----------
let gradient: THREE.DataTexture | null = null;
function getGradient(): THREE.DataTexture {
  if (!gradient) {
    const data = new Uint8Array([150, 150, 150, 255, 210, 210, 210, 255, 255, 255, 255, 255]);
    gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.needsUpdate = true;
  }
  return gradient;
}
