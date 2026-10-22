/**
 * cityGeometry.ts — هندسه ساختمان‌های تهران (فاز GRAPHICS_OVERHAUL → 🔑 v0.2.48 FACADE-TEX)
 * ============================================================
 * منبع مشترک برای:
 *  1) tools/glb/generate_city.ts → GLB واقعی ساختمان‌ها
 *  2) fallback مرورگر
 *
 * 🔑 v0.2.48 — معماری نو به‌جای «پازل» باکس‌های پنجره:
 *   - «walls»: یک باکس ساده با UV — هر وجه کامل به تکسچر نما (پنجره + نور داخلی
 *     روشن با emissiveMap + تابلو) نگاشت می‌شود. دیگر هیچ پنجره باکسی نیست!
 *   - «props»: لبهٔ بام + کولر آبی + منبع آب + ظرف ماهواره + آنتن (vertex-color)
 * قرارداد: مرکز ساختمان (0,0,0)، پایه روی y=0، عرض/عمق 640
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type BuildingType = 'apartment' | 'shop' | 'home' | 'garage';

/** ارتفاع هر واریانس — هر واریانس ارتفاع خودش را دارد (آسمان‌خط متنوع، تکسچر بدون کشیدگی) */
export const BUILDING_VARIANTS: Record<BuildingType, number[]> = {
  // ۶ واریانس برای هر نوع — ارتفاع‌های متمایز + پالت/الگوی متمایز در textures3d
  apartment: [520, 610, 460, 680, 560, 720],
  home: [360, 430, 310, 480, 400, 520],
  shop: [280, 320, 250, 350, 300, 380],
  garage: [210, 240, 190, 265, 230, 285],
};

export const BUILDING_VARIANTS_PER_TYPE = 6;

/** 🔑 v0.2.48 — تعداد طبقهٔ هر واریانس (متناسب با ارتفاع) — تکسچر نما با همین تعداد ردیف پنجره کشیده می‌شود */
export const BUILDING_FLOORS: Record<BuildingType, number[]> = {
  apartment: [6, 7, 5, 8, 6, 8],
  home: [3, 4, 3, 4, 4, 5],
  shop: [2, 3, 2, 3, 2, 3],
  garage: [1, 2, 1, 2, 2, 2],
};

const W = 640; // footprint (مطابق World.addBuilding)

interface Part { geo: THREE.BufferGeometry; color: string }

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, ry = 0): Part {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (ry) geo.rotateY(ry);
  geo.translate(x, y, z);
  return { geo, color };
}

function cyl(r: number, h: number, seg: number, color: string, x = 0, y = 0, z = 0): Part {
  const geo = new THREE.CylinderGeometry(r, r, h, seg);
  geo.translate(x, y, z);
  return { geo, color };
}

function rnd(seed: number, n: number): number {
  const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** پشت‌بام ایرانی: کولر آبی + منبع آب + ظرف ماهواره + آنتن + لبه بام (vertex-color) */
function rooftop(h: number, seed: number, parts: Part[]): void {
  // لبه بام — کمی فراتر از دیوار تا روی وجه بالایی walls را بپوشاند
  const lip = 16;
  parts.push(box(W + 14, lip, 18, '#b8ab97', 0, h + lip / 2 - 2, W / 2 + 4));
  parts.push(box(W + 14, lip, 18, '#b8ab97', 0, h + lip / 2 - 2, -W / 2 - 4));
  parts.push(box(18, lip, W + 14, '#b8ab97', W / 2 + 4, h + lip / 2 - 2, 0));
  parts.push(box(18, lip, W + 14, '#b8ab97', -W / 2 - 4, h + lip / 2 - 2, 0));
  // سقف بام — صفحهای که وجه بالای باکس دیوار را کامل می‌پوشاند (تا تکسچر نما روی بام نیفتد)
  parts.push(box(W + 6, 6, W + 6, '#a89c88', 0, h + 3, 0));
  // کولر آبی (باکس سفید با پرده‌های جانبی)
  const acx = -W * 0.22 + rnd(seed, 1) * W * 0.14;
  const acz = -W * 0.18 + rnd(seed, 2) * W * 0.12;
  parts.push(box(86, 74, 86, '#e8e6e0', acx, h + 40, acz));
  for (let i = 0; i < 3; i++) parts.push(box(4, 62, 70, '#c9c6be', acx - 43 + i * 3, h + 40, acz + 10));
  // منبع آب آبی
  const wtx = W * 0.2 + rnd(seed, 3) * W * 0.12;
  parts.push(cyl(30, 58, 10, '#2f6fae', wtx, h + 32, -W * 0.1 + rnd(seed, 4) * W * 0.1));
  parts.push(cyl(12, 34, 8, '#3d88cc', wtx, h + 11, -W * 0.1 + rnd(seed, 4) * W * 0.1));
  // ظرف ماهواره (دیوش)
  const dtx = W * 0.05 + rnd(seed, 5) * W * 0.2;
  const dish = new THREE.SphereGeometry(30, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.3);
  dish.rotateX(-Math.PI / 2.6);
  dish.translate(dtx, h + 47, W * 0.16);
  parts.push({ geo: dish, color: '#d8d5cd' });
  parts.push(box(4, 26, 4, '#8f8c84', dtx, h + 19, W * 0.16));
  // آنتن چتری
  const ax = -W * 0.05 + rnd(seed, 6) * W * 0.3;
  parts.push(cyl(1.8, 90, 6, '#7d7a72', ax, h + 48, W * 0.1));
  parts.push(box(30, 3, 3, '#7d7a72', ax, h + 75, W * 0.1));
  parts.push(box(3, 3, 30, '#7d7a72', ax, h + 69, W * 0.1));
}

function colorize(p: Part): THREE.BufferGeometry {
  const g = p.geo;
  const c = new THREE.Color(p.color);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!g.getAttribute('uv')) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  }
  return g;
}

export interface BuildingGeometryResult {
  /** باکس دیوار با UV — متریال facade (تکسچر نما + emissive نور داخلی) */
  walls: THREE.BufferGeometry;
  /** جزئیات بام — متریال props (vertex-color) */
  props: THREE.BufferGeometry;
}

/**
 * ساخت هندسه کامل یک ساختمان — نسخه v0.2.48:
 * دیوار = باکس UV (نما از تکسچر می‌آید)، بام = قطعات vertex-color.
 */
export function buildBuildingGeometry(type: BuildingType, height: number, seed: number): BuildingGeometryResult {
  const h = height;

  // ---------- walls: باکس UV ساده (هر وجه 0..1 → تکسچر نما) ----------
  const walls = new THREE.BoxGeometry(W, h, W);
  // BoxGeometry هر وجه را 0..1 نگاشت می‌کند — عالی برای نمای کامل
  walls.translate(0, h / 2, 0);

  // ---------- props: لبه بام + پشت‌بام ایرانی ----------
  const parts: Part[] = [];
  rooftop(h, seed, parts);
  const props = mergeGeometries(parts.map(colorize), false);
  if (!props) throw new Error('merge building props failed');
  props.clearGroups();

  return { walls, props };
}
