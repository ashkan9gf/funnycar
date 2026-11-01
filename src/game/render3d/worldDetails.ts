/**
 * worldDetails.ts — کمک‌تابع‌های مستقل رندر جهان (v0.2.64)
 *
 * 🔑 بازآرایی: این توابع قبلاً بالای WorldRenderer3D.ts (۴٫۴ هزار خطی) بودند؛
 * چون هیچ وابستگی به کلاس رندرر ندارند، به ماژول مستقل منتقل شدند تا فایل اصلی
 * سبک‌تر و قابل‌نگهداری‌تر شود. رفتار عیناً همان است (جابه‌جایی مکانیکی).
 *
 * محتوا:
 *  - parseColor: 'rgba(...)'/hex → THREE.Color + آلفا
 *  - addIranianRooftopDetails: مخزن آب + کندانسور کولر روی بام
 *  - addIranianRooftopExtras: جان‌پناه + دیش ماهواره + آنتن (v0.2.64)
 *  - createSkidMarkTexture: تکسچر آلفای رد لاستیک
 *  - getShadowQualityProfile: بودجهٔ سایه بر اساس توان دستگاه
 */

import * as THREE from 'three';

/** 'rgba(...)' یا '#hex' → رنگ + آلفا */
export function parseColor(c: string): { color: THREE.Color; alpha: number } {
  const m = /rgba?\(([^)]+)\)/.exec(c);
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s.trim()));
    return { color: new THREE.Color(p[0] / 255, p[1] / 255, p[2] / 255), alpha: p[3] ?? 1 };
  }
  return { color: new THREE.Color(c), alpha: 1 };
}

// Shared low-cost rooftop props: Iranian water tanks and condenser units.
// Shared geometry/materials avoid per-building GPU-resource churn in the endless city.
const ROOFTOP_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
const ROOFTOP_TANK_GEO = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
/** 🔑 v0.2.64 — کاسهٔ دیش ماهواره: نیم‌کرهٔ کم‌عمق */
const ROOFTOP_DISH_GEO = new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.52);
const ROOFTOP_BASE_MAT = new THREE.MeshStandardMaterial({ color: '#777b7c', metalness: 0.58, roughness: 0.62 });
const ROOFTOP_TANK_MAT = new THREE.MeshStandardMaterial({ color: '#356d79', metalness: 0.12, roughness: 0.48 });
const ROOFTOP_AC_MAT = new THREE.MeshStandardMaterial({ color: '#e7e0d1', metalness: 0.08, roughness: 0.72 });
const ROOFTOP_DARK_MAT = new THREE.MeshStandardMaterial({ color: '#343a3c', metalness: 0.35, roughness: 0.66 });
/** 🔑 v0.2.64 — جان‌پناه بتنی و بدنهٔ پلاستیکی دیش */
const ROOFTOP_PARAPET_MAT = new THREE.MeshStandardMaterial({ color: '#cfc8ba', metalness: 0.02, roughness: 0.88 });
const ROOFTOP_DISH_MAT = new THREE.MeshStandardMaterial({ color: '#e9e6df', metalness: 0.05, roughness: 0.5 });

export function addIranianRooftopDetails(g: THREE.Group, bounds: THREE.Box3, variance: number): void {
  // Not every building receives every prop: preserve a varied skyline and mobile budget.
  const size = bounds.getSize(new THREE.Vector3());
  const width = Math.max(1, size.x);
  const depth = Math.max(1, size.z);
  const height = Math.max(1, size.y);
  const roofY = bounds.max.y;
  const detailGroup = new THREE.Group();
  // Typical rooftop water tank on a short metal stand.
  if (variance % 2 === 0) {
    const stand = new THREE.Mesh(ROOFTOP_BOX_GEO, ROOFTOP_BASE_MAT);
    stand.scale.set(width * 0.105, height * 0.025, depth * 0.105);
    stand.position.set(bounds.min.x + width * 0.23, roofY + height * 0.012, bounds.min.z + depth * 0.2);
    const tank = new THREE.Mesh(ROOFTOP_TANK_GEO, ROOFTOP_TANK_MAT);
    tank.scale.set(width * 0.12, height * 0.17, depth * 0.12);
    tank.position.set(bounds.min.x + width * 0.23, roofY + height * 0.105, bounds.min.z + depth * 0.2);
    tank.castShadow = true;
    detailGroup.add(stand, tank);
  }
  // Split AC condensers, a familiar detail on Iranian apartment facades/roofs.
  if (variance % 3 !== 1) {
    for (const side of [-1, 1]) {
      const ac = new THREE.Mesh(ROOFTOP_BOX_GEO, ROOFTOP_AC_MAT);
      ac.scale.set(width * 0.095, height * 0.055, depth * 0.09);
      ac.position.set(bounds.min.x + width * (0.12 + (side > 0 ? 0.52 : 0)), roofY + height * 0.027, bounds.min.z + depth * 0.72);
      ac.castShadow = true;
      const vent = new THREE.Mesh(ROOFTOP_BOX_GEO, ROOFTOP_DARK_MAT);
      vent.scale.set(width * 0.052, height * 0.032, depth * 0.008);
      vent.position.set(ac.position.x, ac.position.y, ac.position.z + depth * 0.046);
      detailGroup.add(ac, vent);
    }
  }
  if (detailGroup.children.length) g.add(detailGroup);
}

/** 🔑 v0.2.64 — لایهٔ دوم پشت‌بام ایرانی: جان‌پناه دور سقف + دیش ماهواره + آنتن.
 * جدا از addIranianRooftopDetails تا بودجهٔ هر ساختمان مستقل کنترل شود؛
 * همهٔ قطعات از هندسه/متریال مشترک استفاده می‌کنند (صفر churn GPU). */
export function addIranianRooftopExtras(g: THREE.Group, bounds: THREE.Box3, variance: number): void {
  const size = bounds.getSize(new THREE.Vector3());
  const width = Math.max(1, size.x);
  const depth = Math.max(1, size.z);
  const height = Math.max(1, size.y);
  const roofY = bounds.max.y;
  const extras = new THREE.Group();

  // جان‌پناه: چهار دیوارک باریک دور لبهٔ سقف — سیلوئت طبقات را از خیابان واقعی‌تر می‌کند
  const ph = Math.max(0.9, height * 0.028); // ارتفاع جان‌پناه
  const t = Math.max(0.6, Math.min(width, depth) * 0.012); // ضخامت
  const cx = (bounds.min.x + bounds.max.x) / 2;
  const cz = (bounds.min.z + bounds.max.z) / 2;
  const alongX1 = new THREE.Mesh(ROOFTOP_BOX_GEO, ROOFTOP_PARAPET_MAT);
  alongX1.scale.set(width, ph, t);
  alongX1.position.set(cx, roofY + ph / 2, bounds.min.z + t / 2);
  const alongX2 = alongX1.clone();
  alongX2.position.z = bounds.max.z - t / 2;
  const alongZ1 = new THREE.Mesh(ROOFTOP_BOX_GEO, ROOFTOP_PARAPET_MAT);
  alongZ1.scale.set(t, ph, depth - t * 2);
  alongZ1.position.set(bounds.min.x + t / 2, roofY + ph / 2, cz);
  const alongZ2 = alongZ1.clone();
  alongZ2.position.x = bounds.max.x - t / 2;
  extras.add(alongX1, alongX2, alongZ1, alongZ2);

  // دیش ماهواره — از هر ۳ ساختمان یکی؛ آزیموت از variance تا تکراری دیده نشود
  if (variance % 3 === 2) {
    const dish = new THREE.Mesh(ROOFTOP_DISH_GEO, ROOFTOP_DISH_MAT);
    const dr = Math.min(width, depth) * 0.075;
    dish.scale.set(dr, dr * 0.82, dr);
    const dx = bounds.min.x + width * (0.16 + (variance % 2) * 0.62);
    const dz = bounds.max.z - depth * 0.14;
    dish.position.set(dx, roofY + dr * 0.5, dz);
    dish.rotation.set(Math.PI * 0.82, (variance % 7) * 0.9, 0); // کاسه رو به آسمان
    dish.castShadow = true;
    const arm = new THREE.Mesh(ROOFTOP_BOX_GEO, ROOFTOP_DARK_MAT);
    arm.scale.set(dr * 0.1, dr * 0.1, dr * 0.5);
    arm.position.set(dx, roofY + dr * 0.95, dz + dr * 0.3);
    extras.add(dish, arm);
  }

  // آنتن میله‌ای — از هر ۴ ساختمان یکی
  if (variance % 4 === 0) {
    const mast = new THREE.Mesh(ROOFTOP_TANK_GEO, ROOFTOP_BASE_MAT);
    const mh = height * 0.11;
    mast.scale.set(Math.min(width, depth) * 0.012, mh, Math.min(width, depth) * 0.012);
    mast.position.set(bounds.max.x - width * 0.2, roofY + mh / 2, bounds.min.z + depth * 0.24);
    const tip = new THREE.Mesh(ROOFTOP_BOX_GEO, ROOFTOP_DARK_MAT);
    tip.scale.set(Math.min(width, depth) * 0.05, Math.min(width, depth) * 0.014, Math.min(width, depth) * 0.014);
    tip.position.set(mast.position.x, roofY + mh, mast.position.z);
    extras.add(mast, tip);
  }

  if (extras.children.length) g.add(extras);
}

/** One small procedural alpha texture gives tire marks feathered edges without external assets. */
export function createSkidMarkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const edge = ctx.createLinearGradient(0, 0, canvas.width, 0);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(0.18, 'rgba(0,0,0,0.45)');
  edge.addColorStop(0.5, 'rgba(0,0,0,0.72)');
  edge.addColorStop(0.82, 'rgba(0,0,0,0.45)');
  edge.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Fade both ends so marks blend into the road instead of ending as hard rectangles.
  ctx.globalCompositeOperation = 'destination-in';
  const ends = ctx.createLinearGradient(0, 0, 0, canvas.height);
  ends.addColorStop(0, 'rgba(0,0,0,0)');
  ends.addColorStop(0.12, 'rgba(0,0,0,0.75)');
  ends.addColorStop(0.5, 'rgba(0,0,0,1)');
  ends.addColorStop(0.88, 'rgba(0,0,0,0.75)');
  ends.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ends;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  // Fine, broken rubber streaks add subtle surface variation.
  for (let i = 0; i < 9; i++) {
    const x = 22 + ((i * 17) % 21);
    const y = 5 + ((i * 29) % 116);
    ctx.fillStyle = `rgba(0,0,0,${0.05 + (i % 3) * 0.025})`;
    ctx.fillRect(x, y, 1 + (i % 2), 5 + (i % 4) * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/** Device-aware shadow budget: preserve crisp shadows on capable GPUs without forcing
 * a 2048² depth map on low-memory/low-core phones. No GPU renderer-string probing. */
export interface ShadowQualityProfile {
  mapSize: number;
  refreshEvery: number;
  normalBias: number;
  radius: number;
}

export function getShadowQualityProfile(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
): ShadowQualityProfile {
  const maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 2048;
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const cores = nav?.hardwareConcurrency || 4;
  const reportedMemory = nav && 'deviceMemory' in nav
    ? Number((nav as Navigator & { deviceMemory?: number }).deviceMemory)
    : Number.NaN;
  const memory = Number.isFinite(reportedMemory) && reportedMemory > 0 ? reportedMemory : null;
  const lowEnd = cores <= 4 || (memory !== null && memory <= 4) || maxTextureSize < 4096;
  const highEnd = cores >= 8 && memory !== null && memory >= 8 && maxTextureSize >= 8192;

  if (lowEnd) {
    // 🔑 v0.2.62 — با کادر ±۲۱۵ حتی نقشهٔ ۱۰۲۴ هم ۰٫۴۲ واحد/تکسل می‌شود؛ ۱۵۳۶ + شعاع کمتر
    // = سایهٔ خوانا روی گوشی‌های ضعیف، بدون پرش محسوس هزینه (refreshEvery ۴ حفظ شد)
    return { mapSize: 1536, refreshEvery: 4, normalBias: 0.016, radius: 1.0 };
  }
  if (highEnd) {
    return { mapSize: 2048, refreshEvery: 2, normalBias: 0.010, radius: 1.2 };
  }
  return { mapSize: 2048, refreshEvery: 3, normalBias: 0.012, radius: 1.1 };
}
