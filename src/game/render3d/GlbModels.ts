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
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarModel3D, CarVariant, ExtWheelSpin } from './CarFactory3D';
import { VEHICLE_SPECS, FIXED_COLORS, VEHICLE_COLORS } from './vehicleGeometry';

/**
 * دی‌کوانتیزه کردن اتریبیوت‌ها به Float32 — mergeGeometries نوع یکسان می‌خواهد
 * (اینترلیو + normalized + index قاطی را خودش حل می‌کند؛ هندسهٔ منبع دست‌نخورده)
 */
export function dequantizeGeoNew(src: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const pos = src.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos || pos.count === 0) return null;
  const count = pos.count;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(src.attributes)) {
    const attr = src.getAttribute(name) as THREE.BufferAttribute;
    if (!attr || attr.count !== count) return null; // اتریبیوت ناهم‌راستا — مش معیوب
    const isz = attr.itemSize;
    const f = new Float32Array(count * isz);
    for (let i = 0; i < count; i++) {
      for (let c = 0; c < isz; c++) {
        const v = attr.getComponent(i, c); // اینترلیو + normalized را خودش حل می‌کند
        if (!Number.isFinite(v)) return null; // هندسه معیوب مدل — رد
        f[i * isz + c] = v;
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(f, isz));
  }
  const idx = src.getIndex();
  if (idx) {
    const i32 = new Uint32Array(idx.count);
    const srcIdx = idx.array as ArrayLike<number>;
    for (let i = 0; i < idx.count; i++) i32[i] = srcIdx[i];
    out.setIndex(new THREE.BufferAttribute(i32, 1));
  }
  return out;
}

/** 🔑 PERF-4: merge قطعات «ایستای» بدنه در قالب خودرو — یک‌بار per variant
 *  قبل از هر clone. همهٔ نمونه‌های بعدی (ترافیک/نگهبان/بازیکن) هندسهٔ
 *  merge‌شده را «اشتراکی» استفاده می‌کنند → هر ماشین به‌جای ۱۲-۵۲ مش، ~۴-۸ مش.
 *  چرخ‌ها و چراغ‌گردان دست‌نخورده می‌مانند (چرخش/فرمان/فلاش پلیس سالم).
 *  ⚠️ هندسهٔ اصلی dispose نمی‌شود (کلون‌های پارکی ممکن است به آن اشاره کنند). */
export function mergeTemplateStatics(scene: THREE.Group): void {
  scene.updateMatrixWorld(true);
  const gInv = new THREE.Matrix4().copy(scene.matrixWorld).invert();
  const isWheelName = (n: string): boolean => {
    const l = n.toLowerCase();
    return l.includes('wheel') || l.includes('tire') || l.includes('tyre');
  };
  interface Bucket { mat: THREE.Material; geos: THREE.BufferGeometry[]; }
  const buckets = new Map<string, Bucket>();
  const doomed: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.name === 'lightbar_red' || m.name === 'lightbar_blue') return;
    if (isWheelName(m.name)) return;
    doomed.push(m);
  });
  if (doomed.length < 2) return; // چیزی برای merge نیست (مثل vintage تک‌مش)
  const bake = (srcGeo: THREE.BufferGeometry, rel: THREE.Matrix4, mat: THREE.Material): void => {
    const dq = dequantizeGeoNew(srcGeo) ?? srcGeo.clone();
    dq.applyMatrix4(rel);
    const key = mat.uuid;
    const b = buckets.get(key);
    if (b) b.geos.push(dq);
    else buckets.set(key, { mat, geos: [dq] });
  };
  for (const m of doomed) {
    const rel = new THREE.Matrix4().multiplyMatrices(gInv, m.matrixWorld);
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const multi = Array.isArray(m.material) && m.geometry.groups && m.geometry.groups.length > 1;
    if (!multi) {
      bake(m.geometry, rel, mats[0]);
    } else {
      for (const gr of m.geometry.groups) {
        const mi = gr.materialIndex ?? 0;
        const mat = (mi >= 0 ? mats[mi] : undefined) ?? mats[0];
        // برش بازهٔ گروه → هندسهٔ مستقل
        let part: THREE.BufferGeometry;
        const src = m.geometry;
        if (src.index) {
          const idx = src.index;
          const sub = new Uint32Array(gr.count);
          const arr = idx.array as ArrayLike<number>;
          for (let i = 0; i < gr.count; i++) sub[i] = arr[gr.start + i];
          part = src.clone();
          part.setIndex(new THREE.BufferAttribute(sub, 1));
        } else {
          part = src.clone();
        }
        part.clearGroups();
        bake(part, rel, mat);
      }
    }
  }
  if (buckets.size === 0) return;
  // یکدست‌سازی اتریبیوت‌ها در هر باکت (شرط mergeGeometries)
  for (const b of buckets.values()) {
    let common: string[] | null = null;
    for (const g of b.geos) {
      const names = Object.keys(g.attributes);
      if (!common) common = names;
      else common = common.filter((n) => names.includes(n));
    }
    common = common ?? ['position'];
    const needUv = !common.includes('uv');
    const needNormal = !common.includes('normal');
    for (const g of b.geos) {
      for (const name of Object.keys(g.attributes)) {
        if (!common.includes(name)) g.deleteAttribute(name);
      }
      if (needUv) {
        const n = g.getAttribute('position').count;
        g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      }
      if (needNormal) g.computeVertexNormals();
    }
  }
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose(); // کپی‌های bake — بعد از merge آزاد
    if (!merged) continue;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.name = '__static';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  for (const m of doomed) m.parent?.remove(m);
}

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
  /** 🔑 GLB-ONLY: صحنه‌های رسیده — دسترسی هم‌گام برای ساخت ساختمان بدون placeholder */
  private ready = new Map<string, THREE.Group>();
  private loader = new GLTFLoader();

  constructor(private baseUrl = '/assets/models') {
    // مدل‌های بهینه‌شده با EXT_meshopt_compression — بدون دیکودر، parse بی‌صدا null برمی‌گرداند
    this.loader.setMeshoptDecoder(MeshoptDecoder);
  }

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
          this.loader.parse(buf, '', (gltf) => {
            const scene = gltf.scene as THREE.Group;
            // 🔑 v0.2.41 فیکس «ماشین چپ‌شده»: vintage.glb وارونه مودل‌سازی شده (چرخ‌ها سقف!)
            // چرخش ۱۸۰° حول محور طول (Z) → لاستیک‌ها پایین؛ سپس پایه روی زمین (minY=0)
            if (relPath.includes('vintage')) {
              scene.rotation.z = Math.PI;
              scene.updateMatrixWorld(true);
              const vb = new THREE.Box3().setFromObject(scene);
              scene.position.y = -vb.min.y;
            }
            // فیلتر ناهمسانگرد (ادغام از شاخهٔ کاربر): بافت‌های اریب (آسفالت/شیشه/نما)
            // از زاویهٔ دوربین واضح‌تر می‌مانند — بدون افزایش حجم مدل
            const textureSlots = [
              'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap',
              'emissiveMap', 'alphaMap', 'lightMap', 'bumpMap', 'displacementMap',
            ];
            scene.traverse((obj) => {
              const mesh = obj as THREE.Mesh;
              if (!mesh.isMesh) return;
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              for (const material of mats) {
                const slots = material as unknown as Record<string, unknown>;
                for (const slot of textureSlots) {
                  const texture = slots[slot] as THREE.Texture | null | undefined;
                  if (texture?.isTexture && texture.anisotropy < 4) {
                    texture.anisotropy = 4;
                    texture.needsUpdate = true;
                  }
                }
              }
            });
            this.ready.set(relPath, scene); // 🔑 GLB-ONLY: برای getLoadedSync
            resolve(scene);
          }, () => resolve(null));
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

  /** 🔑 GLB-ONLY: مسیر فایل ساختمان — جفت با getLoadedSync */
  buildingFile(type: string, variance: number): string {
    return `buildings/${type}_${variance % 3}.glb`;
  }

  /** 🔑 GLB-ONLY: اگر GLB از قبل رسیده باشد صحنهٔ منبع را هم‌گام می‌دهد (بدون await)
   *  — ساختِ هم‌گام ساختمان = نسخهٔ رنگیِ پازلی هرگز به صحنه نمی‌رسد */
  getLoadedSync(relPath: string): THREE.Group | null {
    return this.ready.get(relPath) ?? null;
  }

  /** 🔑 GLB-ONLY: پیش‌بارگذاری هر ۱۲ ساختمان (۴ نوع × ۳ واریانت ~۲MB) حین صفحهٔ لودینگ
   *  — تا بازیکن وارد شهر شود همه در کش‌اند؛ شهر از اولین فریم «سینمایی» دیده می‌شود */
  preloadBuildings(): Promise<THREE.Group | null>[] {
    const out: Promise<THREE.Group | null>[] = [];
    for (const t of ['apartment', 'home', 'shop', 'garage']) {
      for (let v = 0; v < 3; v++) out.push(this.load(`buildings/${t}_${v}.glb`));
    }
    return out;
  }
}

/** ساخت گروه ماشین از صحنه GLB — با کلون صحنه برای هر نمونه
 *  opts.external: مدل خارجی کاربر — متریال اصلی PBR حفظ می‌شود،
 *  چرخ‌ها با پیوت هندسی (مرکز هندسه) سوار می‌شوند تا درست بچرخند.
 */
export function assembleCarFromGLB(
  variant: CarVariant,
  srcScene: THREE.Group,
  opts: { lite?: boolean; bodyColor?: string; external?: boolean } = {},
): CarModel3D {
  const spec = VEHICLE_SPECS[variant];
  const lite = opts.lite === true;
  const external = opts.external === true;
  const bodyColor = opts.bodyColor ?? pickBodyColor(variant);

  const g = srcScene.clone(true);
  const wheels: THREE.Object3D[] = [];
  const steerable: THREE.Group[] = [];
  let bodyMat: THREE.MeshToonMaterial | null = null;
  let bumpers: CarModel3D['bumpers'] = { front: null, rear: null };
  let tailMat: THREE.MeshStandardMaterial | null = null;
  let lightBar: CarModel3D['lightBar'] | undefined;

  // ---------- مدل خارجی کاربر (۴ مدل ۱۴۰۴) ----------
  if (external) {
    g.updateMatrixWorld(true);
    // 🔑 فیکس «لاستیک باگ رنو۴»: تکه ۵۲×۴۲ کاپوت/جلوکاپی که نام wheel_fr دارد (x≈۰ = وسط بدنه!)
    // به‌عنوان چرخ خوشه می‌شد و کل جلوی ماشین در حرکت می‌چرخید!
    // فیلترها: چرخ واقعی همیشه نزدیک گلگیرها است (|x-cx| ≥ ۰٫۱۵×عرض) و کوچک (≤ ۰٫۲۸×طول)
    const wheelMatsFixed = new Set<THREE.Material>();
    const darkWheelMat = (): THREE.MeshToonMaterial => {
      let m = wheelMatsFixed.values().next().value as THREE.MeshToonMaterial | undefined;
      if (!m) { m = new THREE.MeshToonMaterial({ color: '#26241f', gradientMap: getGradient() }); wheelMatsFixed.add(m); }
      return m;
    };
    const isUntexturedLight = (mat: THREE.Material | THREE.Material[]): boolean => {
      const m = Array.isArray(mat) ? mat[0] : mat;
      if (!m || !(m instanceof THREE.MeshStandardMaterial)) return false;
      if (m.map) return false;
      const c = m.color;
      return c.r > 0.55 && c.g > 0.55 && c.b > 0.55 && Math.abs(c.r - c.g) < 0.12 && Math.abs(c.g - c.b) < 0.12;
    };
    // چرخ: هر ماشی که نامش wheel/tire/tyre دارد (شامل rim جزئیات پلیس wstatic_*_wheel_*)
    // فیلتر موقعیت: چرخ واقعی نزدیک محور طولی ماشین است (|z| ≤ 0.38×طول) —
    // مه‌شکن‌های پلیس که نام wheel دارند (z=−93!) از خوشه چرخ حذف می‌شوند (فیکس پلیس)
    const wheelMeshes: THREE.Mesh[] = [];
    const lights: { red: THREE.Mesh | null; blue: THREE.Mesh | null } = { red: null, blue: null };
    // 🔑 v0.2.41: متریال‌های «بدنه» برای رنگ گاراژ روی مدل واقعی — درخواست کاربر:
    // «ماشین‌هایی که مدل دارن با بدنه رنگی متفاوت» — هر مش غیر شیشه/چرخ/چراغ/کروم/تریم
    const paintMats: Array<{ mat: THREE.MeshStandardMaterial; orig: THREE.Color }> = [];
    const paintSeen = new Set<string>();
    const isPaintTarget = (meshName: string, tri: number): boolean => {
      if (/glass|window|windshield|windscreen|wheel|tire|tyre|light|lamp|indicator|chrome|plate|grille|mirror|interior|seat|wstatic|siren|fog/i.test(meshName)) return false;
      return tri > 0;
    };
    g.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // حفظ ظاهر PBR مدل‌های واقعی (ادغام از شاخهٔ کاربر):
      // بدنه کمی براق‌تر بدون متریال آینه‌ای پرهزینه
      const srcMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      // Clone per-instance materials before tuning: damage/paint on one car must
      // never mutate another traffic car that shares the source GLB material.
      const tunedMaterials = srcMaterials.map((source) => {
        if (!(source instanceof THREE.MeshStandardMaterial) || source.transparent) return source;
        const materialName = source.name.toLowerCase();
        let material: THREE.MeshStandardMaterial = source.clone();
        if (/glass|window|windshield|windscreen/.test(materialName)) {
          // Vehicle glazing: tighter highlights and a subtle clearcoat without
          // forcing transparency on assets whose GLB author intentionally omitted it.
          const glazing = new THREE.MeshPhysicalMaterial();
          Object.assign(glazing, material);
          glazing.roughness = Math.max(0.12, Math.min(0.3, material.roughness));
          glazing.metalness = Math.min(0.06, material.metalness);
          glazing.clearcoat = 0.42;
          glazing.clearcoatRoughness = 0.16;
          glazing.envMapIntensity = 1.25;
          material.dispose();
          return glazing;
        }
        if (/tire|tyre|rubber|plastic/.test(materialName)) {
          // Rubber and unpainted plastic stay matte and non-metallic.
          material.roughness = Math.max(0.76, material.roughness);
          material.metalness = Math.min(0.04, material.metalness);
          material.envMapIntensity = 0.38;
        } else if (/chrome|rim|metal/.test(materialName)) {
          // Metal trim gets controlled reflections, not mirror-like highlights.
          material.roughness = Math.max(0.28, Math.min(0.48, material.roughness));
          material.metalness = Math.max(0.18, Math.min(0.55, material.metalness));
          material.envMapIntensity = 1.25;
        } else {
          // Automotive paint: physical clearcoat adds a restrained lacquer highlight.
          // Preserve all imported maps, vertex colors and base material parameters.
          const paint = new THREE.MeshPhysicalMaterial();
          // Copy only properties present on the imported Standard material;
          // Object.assign leaves Physical-only defaults intact when absent.
          Object.assign(paint, material);
          paint.clearcoat = /paint|body|car|exterior|кузов/i.test(materialName) ? 0.32 : 0.12;
          paint.clearcoatRoughness = 0.28;
          paint.roughness = Math.max(0.3, Math.min(0.68, material.roughness));
          paint.metalness = Math.max(0, Math.min(0.28, material.metalness));
          paint.envMapIntensity = 1.15;
          material.dispose();
          return paint;
        }
        return material;
      });
      mesh.material = Array.isArray(mesh.material) ? tunedMaterials : tunedMaterials[0];
      const name = (mesh.name || '').toLowerCase();
      // 🔑 v0.2.41: ثبت متریال‌های بدنه برای رنگ‌پذیری — مش‌های بزرگ (بدنه واقعی،
      // نه لوازم کوچک) تا رنگ گاراژ کل ظاهر را خراب نکند
      {
        const gForPaint = mesh.geometry;
        const idxForPaint = gForPaint.getIndex();
        const triForPaint = (idxForPaint ? idxForPaint.count : gForPaint.getAttribute('position')?.count ?? 0) / 3;
        if (isPaintTarget(name, triForPaint)) {
          for (const mm of tunedMaterials) {
            const std = mm as THREE.MeshStandardMaterial;
            if (!std.isMeshStandardMaterial || std.transparent || paintSeen.has(std.uuid)) continue;
            if (std.emissive && std.emissive.r + std.emissive.g + std.emissive.b > 1e-4) continue;
            paintSeen.add(std.uuid);
            paintMats.push({ mat: std, orig: std.color.clone() });
          }
        }
      }

      // Improve named automotive light lenses while preserving their GLB maps.
      // Keep emission restrained: the renderer has no guaranteed bloom pass.
      const lightKind = /headlight|head_light|lights_front|front_light/.test(name)
        ? 'front'
        : /taillight|tail_light|lights_rear|rear_light|brake_light/.test(name)
          ? 'rear'
          : /indicator|turn_signal|turnsignal|blinker/.test(name)
            ? 'indicator'
            : null;
      if (lightKind) {
        const lightMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const lightMaterial of lightMaterials) {
          if (!(lightMaterial instanceof THREE.MeshStandardMaterial)) continue;
          if (lightKind === 'front') {
            lightMaterial.emissive.set('#ffe2a3');
            lightMaterial.emissiveIntensity = Math.max(lightMaterial.emissiveIntensity, 0.28);
          } else if (lightKind === 'rear') {
            lightMaterial.emissive.set('#d71920');
            lightMaterial.emissiveIntensity = Math.max(lightMaterial.emissiveIntensity, 0.42);
          } else {
            lightMaterial.emissive.set('#ff9d24');
            lightMaterial.emissiveIntensity = Math.max(lightMaterial.emissiveIntensity, 0.32);
          }
          lightMaterial.needsUpdate = true;
        }
      }
      if (name.includes('wheel') || name.includes('tire') || name.includes('tyre')) {
        if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
        const bb = mesh.geometry.boundingBox;
        if (bb) {
          const wb = bb.clone().applyMatrix4(mesh.matrixWorld);
          const cz = (wb.min.z + wb.max.z) / 2;
          if (Math.abs(cz) <= spec.len * 0.38) {
            wheelMeshes.push(mesh);
          } else if (isUntexturedLight(mesh.material)) {
            // 🔑 قطعه wheel-named خارج از قطر محور (مه‌شکن پلیس z=−۹۳) — سفیدِ خام نباشد
            mesh.material = darkWheelMat();
          }
        }
      } else if (name === 'lightbar_red') lights.red = mesh;
      else if (name === 'lightbar_blue') lights.blue = mesh;
    });

    // خوشه‌بندی چرخ‌ها بر اساس مرکز جهانی — پیوت = مرکز هندسی خوشه
    const clusterR = spec.len * 0.2;
    const gbbox = new THREE.Box3().setFromObject(g);
    const bodyCenterZ = (gbbox.min.z + gbbox.max.z) / 2;
    const bodyCenterX = (gbbox.min.x + gbbox.max.x) / 2;
    // چرخ واقعی در نیمه پایین بدنه است — فرمان داخل کابین/اسپیر بالا حذف می‌شود
    const wheelTopY = gbbox.min.y + (gbbox.max.y - gbbox.min.y) * 0.5;

    interface WheelCluster { pivot: THREE.Group; meshes: THREE.Mesh[]; }
    const clusters: WheelCluster[] = [];
    for (const mesh of wheelMeshes) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const worldCenter = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      let cl = clusters.find((c) => c.pivot.getWorldPosition(new THREE.Vector3()).distanceTo(worldCenter) < clusterR);
      if (!cl && worldCenter.y > wheelTopY) continue; // چرخِ کابین (فرمان) — نه
      if (!cl) {
        // 🔑 فیلتر مرکز بدنه: مش wheel-named که روی خط وسط طولی است (|x| < ۱۵٪ عرض)
        // چرخ نیست — تکه بدنه است (رنو۴: جلوکاپی wheel_fr با span ۵۲!). بدنه‌ای بزرگ →
        // دست‌نخورده؛ قطعه کوچک (مه‌شکن پلیس) → تیره می‌شود
        const wb2 = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
        const mDim = Math.max(wb2.max.x - wb2.min.x, wb2.max.y - wb2.min.y, wb2.max.z - wb2.min.z);
        if (Math.abs(worldCenter.x - bodyCenterX) < spec.wid * 0.15) {
          // 🔑 هر قطعه wheel-named بی‌تکسچرِ روشن که چرخ نیست (شاسی داخلی رنو۴ / مه‌شکن پلیس) → تیره
          if (isUntexturedLight(mesh.material)) mesh.material = darkWheelMat();
          continue;
        }
        // 🔑 فیلتر اندازه: هیچ چرخ واقعی بیش از ۲۸٪ طول ماشین نیست (رنو۴: ۵۲/۱۷۶=۳۰٪)
        if (mDim > spec.len * 0.28) continue;
        // 🔑 فیکس «چرخ سفید خام»: رینگ/لاستیک بی‌تکسچر روشن (رنو۴/پلیس/۴۰۵/سمند) → لاستیک تیره
        if (isUntexturedLight(mesh.material)) mesh.material = darkWheelMat();
        const pivot = new THREE.Group();
        const parent = mesh.parent ?? g;
        pivot.position.copy(parent.worldToLocal(worldCenter.clone()));
        parent.add(pivot);
        pivot.updateMatrixWorld(true);
        clusters.push({ pivot, meshes: [] });
        cl = clusters[clusters.length - 1];
        // جلو = z منفی (قرارداد بازی) → پیوت‌های جلو فرمان‌پذیر
        if (pivot.getWorldPosition(new THREE.Vector3()).z < bodyCenterZ) steerable.push(pivot);
      } else if (isUntexturedLight(mesh.material)) {
        mesh.material = darkWheelMat();
      }
      cl.meshes.push(mesh);
    }

    // ---------- هم‌اندازه‌سازی چرخ‌ها (فیکس لاستیک پلیس) ----------
    // مدل پلیس در گوشه جلو-راست فقط یک لاستیک کوچک ۸٫۷ دارد (بقیه ۲۷٫۳!)
    // هر خوشه که قطرش < ۶۲٪ بزرگ‌ترین خوشه است: مش‌هایش حذف و کلونِ
    // بزرگ‌ترین چرخ به‌جایش در همان گوشه می‌نشیند (جهت/محور خودکار حفظ می‌شود)
    let refDia = 0;
    const clDia: number[] = [];
    const triOf = (m: THREE.Mesh): number => {
      const idx = m.geometry.getIndex();
      return (idx ? idx.count : m.geometry.getAttribute('position')?.count ?? 0) / 3;
    };
    for (const cl of clusters) {
      const wb = new THREE.Box3();
      for (const m of cl.meshes) wb.expandByObject(m);
      const sz = wb.getSize(new THREE.Vector3());
      const dia = Math.max(sz.x, sz.y, sz.z);
      clDia.push(dia);
      if (dia > refDia) refDia = dia;
    }
    if (clusters.length > 0 && refDia > 0) {
      const refIdx = clDia.indexOf(refDia);
      const refCl = clusters[refIdx];
      const refMesh = refCl.meshes.reduce((a, b) => (triOf(b) > triOf(a) ? b : a));
      const tmpBox = new THREE.Box3();
      for (let ci = 0; ci < clusters.length; ci++) {
        if (ci === refIdx || clDia[ci] >= refDia * 0.62) continue;
        const cl = clusters[ci];
        // مرکز جهانی خوشه کم‌بهره (پیوت همان‌جا ساخته شده)
        const target = cl.pivot.getWorldPosition(new THREE.Vector3());
        // حذف مش‌های کوچک از صحنه و از خوشه
        for (const m of cl.meshes) m.parent?.remove(m);
        cl.meshes.length = 0;
        // کلون مرجع — همان والد و ترنسفورم مرجع، سپس شیفت جهانی به گوشه مقصد
        const parent = refMesh.parent ?? g;
        const clone = refMesh.clone(true);
        clone.name = `${refMesh.name}_fix${ci}`;
        parent.add(clone);
        clone.updateMatrixWorld(true);
        tmpBox.setFromObject(clone);
        const cur = tmpBox.getCenter(new THREE.Vector3());
        const delta = target.clone().sub(cur);
        clone.position.add(parent.worldToLocal(delta.clone()));
        clone.updateMatrixWorld(true);
        cl.meshes.push(clone);
      }
    }

    // ---------- spinner + محور واقعی + جهت خودکار (فیکس چرخ ۲۰۶/پلیس/پیکان) ----------
    const extWheels: ExtWheelSpin[] = [];
    const tmpQ = new THREE.Quaternion();
    for (const cl of clusters) {
      const spinner = new THREE.Group();
      cl.pivot.add(spinner);
      for (const mesh of cl.meshes) spinner.attach(mesh);
      g.updateMatrixWorld(true);

      // بزرگ‌ترین مش خوشه = مرجع محور
      let main = cl.meshes[0];
      let mainTri = 0;
      for (const m of cl.meshes) {
        const idx = m.geometry.getIndex();
        const tri = (idx ? idx.count : m.geometry.getAttribute('position')?.count ?? 0) / 3;
        if (tri > mainTri) { mainTri = tri; main = m; }
      }
      // محور چرخ = باریک‌ترین بعد bbox هندسه (محور استوانه تایر)
      if (!main.geometry.boundingBox) main.geometry.computeBoundingBox();
      const sz = main.geometry.boundingBox!.getSize(new THREE.Vector3());
      const localAxis = sz.x <= sz.y && sz.x <= sz.z ? new THREE.Vector3(1, 0, 0)
        : sz.y <= sz.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
      main.getWorldQuaternion(tmpQ);
      const axisWorld = localAxis.applyQuaternion(tmpQ);
      // محور چرخ باید افقی باشد؛ اگر عمودی درآمد (اکسپورت معیوب) → فرض X
      if (Math.abs(axisWorld.y) > 0.7) axisWorld.set(1, 0, 0);
      axisWorld.y = 0;
      if (axisWorld.lengthSq() < 1e-6) axisWorld.set(1, 0, 0);
      axisWorld.normalize();
      // جهت: جلو = -Z جهانی؛ نقطه بالای چرخ باید به -Z حرکت کند → ωx منفی
      const sign = axisWorld.x > 0 ? -1 : 1;
      // محور به فضای محلی spinner + 🔑 SNAP به محور اصلی — چرخ هیچ‌وقت کج نچرخد
      spinner.getWorldQuaternion(tmpQ).invert();
      const axisLocal = axisWorld.clone().applyQuaternion(tmpQ).normalize();
      if (Math.abs(axisLocal.x) >= Math.abs(axisLocal.z)) axisLocal.set(Math.sign(axisLocal.x) || 1, 0, 0);
      else axisLocal.set(0, 0, Math.sign(axisLocal.z));
      // 🔑 base مطلق + angle تجمعی — spinWheels هر فریم quaternion مطلق می‌سازد (صفر drift)
      extWheels.push({ spinner, axis: axisLocal, sign, base: spinner.quaternion.clone(), angle: 0 });

      // محور فرمان (Y جهانی) در فضای محلی پیوت
      cl.pivot.getWorldQuaternion(tmpQ).invert();
      cl.pivot.userData.steerAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(tmpQ).normalize();
      // 🔑 حذف «پره‌های سفید چرخش»: باکس‌های سفید متقاطع روی چرخ‌های تک‌مش — کاربر آن‌ها را
      // باگ لاستیک می‌دید («فقط تاکسی سالمه» چون خوشه دومی داشت). چرخ واقعی خودش زیباست.
    }

    // چراغ‌گردان: از خود مدل؛ پلیس با یک لامپ → لامپ دوم آینه‌ای ساخته می‌شود
    // (فیکس فلاش تک‌رنگ پلیس: مدل فقط lightbar_blue داشت و red=blue می‌شد)
    if (lights.red && lights.blue) {
      lightBar = { red: lights.red, blue: lights.blue };
    } else if (variant === 'police' && (lights.red || lights.blue)) {
      const have = (lights.red ?? lights.blue) as THREE.Mesh;
      have.updateWorldMatrix(true, false);
      const wp = new THREE.Vector3().setFromMatrixPosition(have.matrixWorld);
      const cxBody = (gbbox.min.x + gbbox.max.x) / 2;
      const parent = have.parent ?? g;
      const lp = parent.worldToLocal(new THREE.Vector3(2 * cxBody - wp.x, wp.y, wp.z));
      const missingRed = !lights.red;
      const m2 = new THREE.Mesh(
        have.geometry,
        new THREE.MeshBasicMaterial({ color: missingRed ? '#ff2d2d' : '#2d6bff' }),
      );
      m2.position.copy(lp);
      m2.quaternion.copy(have.quaternion);
      m2.scale.copy(have.scale);
      parent.add(m2);
      lightBar = missingRed ? { red: m2, blue: have } : { red: have, blue: m2 };
    } else if (variant === 'police') {
      const topY = gbbox.max.y;
      const wid = (gbbox.max.x - gbbox.min.x) * 0.55;
      const barBase = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.55, 5, 22), new THREE.MeshToonMaterial({ color: '#2e2622' }));
      barBase.position.y = topY + 2;
      const red = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.24, 11, 18), new THREE.MeshBasicMaterial({ color: '#ff2d2d' }));
      red.position.set(-wid * 0.14, topY + 9, 0);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.24, 11, 18), new THREE.MeshBasicMaterial({ color: '#2d6bff' }));
      blue.position.set(wid * 0.14, topY + 9, 0);
      g.add(barBase, red, blue);
      lightBar = { red, blue };
    }

    if (!bodyMat) bodyMat = new THREE.MeshToonMaterial({ color: bodyColor, gradientMap: getGradient() });

    // 🔑 v0.2.41: رنگ بدنه مدل واقعی — درخواست کاربر «ماشین‌هایی که مدل دارن با بدنه رنگی متفاوت»
    // متریال‌های بدنه رنگ می‌شوند: بی‌تکسچر = رنگ کامل، تکسچردار = تینت orig×رنگ
    // سفیدِ پیش‌فرض (±۸٪) = بدون تینت تا ظاهر اصلی مدل حفظ شود
    const paintColor = new THREE.Color(bodyColor);
    const nearWhite =
      Math.abs(paintColor.r - 1) < 0.08 &&
      Math.abs(paintColor.g - 1) < 0.08 &&
      Math.abs(paintColor.b - 1) < 0.08;
    if (!nearWhite) {
      for (const pm of paintMats) pm.mat.color.copy(pm.orig).multiply(paintColor);
    }

    // متریال آسیب: متریال بدنه اصلی برای تیره‌شدن با ضربه
    const damageMats: THREE.MeshStandardMaterial[] = [];
    const best = { mesh: null as THREE.Mesh | null, tri: 0 };
    g.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      const idx = mesh.geometry.getIndex();
      const tri = (idx ? idx.count : mesh.geometry.getAttribute('position')?.count ?? 0) / 3;
      if (tri > best.tri) { best.tri = tri; best.mesh = mesh; }
    });
    if (best.mesh) {
      const seen = new Set<THREE.Material>();
      best.mesh.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (!m) return;
        const list = Array.isArray(m) ? m : [m];
        for (const mm of list) {
          if (seen.has(mm)) continue;
          seen.add(mm);
          damageMats.push(mm as unknown as THREE.MeshStandardMaterial);
        }
      });
    }

    return {
      group: g,
      wheels,
      extWheels,
      bodyColor,
      bodyMat,
      bumpers,
      lightBar,
      len: spec.len,
      wid: spec.wid,
      paintMats,
      ...{ steerable, tailMat: null, damageTiltZ: 0, rollZ: 0, pitchX: 0, damageMats },
    } as CarModel3D;
  }

  // ---------- مدل‌های تولیدی پروژه (پراید/پژو/...) — مسیر قبلی ----------
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
    } else if (name === 'trim' || name.startsWith('bumper_') || name === 'plate' || name === 'roofrack') {
      // 🔑 فیکس «تریم سفیدِ خام»: GLBهای پراید/تیبا/نیسان بدون تکسچر و بدون vertex-color هستند
      // (baseColorFactor=[1,1,1,1]) — تریم/سپر/پلاک به‌جای سفید وسواس‌بار، تیره کارتونی می‌شود
      // (bumpers در این مسیر null است — detachBumper تاثیری نمی‌پذیرد)
      mesh.material = new THREE.MeshToonMaterial({ color: '#2e2b28', gradientMap: getGradient() });
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

// ---------- پره چرخ برای مدل‌های procedural (چرخش دیده شود) ----------
let spinMat: THREE.MeshToonMaterial | null = null;
function getSpinMat(): THREE.MeshToonMaterial {
  if (!spinMat) spinMat = new THREE.MeshToonMaterial({ color: '#c9ccd1', gradientMap: getGradient() });
  return spinMat;
}
export function decorateWheelSpin(wheel: THREE.Mesh): void {
  if (!wheel.geometry.boundingBox) wheel.geometry.computeBoundingBox();
  const size = new THREE.Vector3();
  if (wheel.geometry.boundingBox) wheel.geometry.boundingBox.getSize(size);
  // محور چرخ = X (پهنای ماشین)؛ صفحه چرخ = YZ
  const dia = Math.max(size.y, size.z, 0.001);
  const w = size.x > 0.001 ? size.x : dia * 0.3;
  if (!spinMat) spinMat = new THREE.MeshToonMaterial({ color: '#c9ccd1', gradientMap: getGradient() });
  const spoke1 = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, dia * 0.82, dia * 0.14), spinMat);
  const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(w * 1.12, dia * 0.14, dia * 0.82), spinMat);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(dia * 0.17, dia * 0.17, w * 1.25, 10), spinMat);
  hub.rotation.z = Math.PI / 2; // محور استوانه → X
  wheel.add(spoke1, spoke2, hub);
}
