/**
 * cityGeometry.ts — هندسه ساختمان‌های تهران (فاز GRAPHICS_OVERHAUL)
 * ============================================================
 * منبع مشترک برای:
 *  1) tools/glb/generate_city.ts → GLB واقعی ساختمان‌ها
 *  2) fallback مرورگر
 * هر ساختمان = چند باکس merge با Vertex-Color → ۱ مش / ۱ Draw Call
 * قرارداد: مرکز ساختمان (0,0,0)، پایه روی y=0، عرض/عمق 640
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type BuildingType = 'apartment' | 'shop' | 'home' | 'garage';

export interface BuildingStyle {
  wall: string;
  wall2: string;
  window: string;
  accent: string;
  door: string;
  floors: number; // ارتفاع هر طبقه
}

export const BUILDING_STYLES: Record<BuildingType, BuildingStyle> = {
  apartment: { wall: '#c4a98a', wall2: '#a8927a', window: '#22303c', accent: '#7d6a52', door: '#43362b', floors: 92 },
  shop: { wall: '#d9c39c', wall2: '#bfa87f', window: '#26343f', accent: '#b54a3e', door: '#3a2f27', floors: 110 },
  home: { wall: '#c2a27c', wall2: '#a5865f', window: '#2c3a45', accent: '#6f5238', door: '#523f2c', floors: 128 },
  garage: { wall: '#aeaa9e', wall2: '#968f82', window: '#2e3a41', accent: '#5f6c72', door: '#565d61', floors: 235 },
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

/** پنجره‌های یک وجه: شبکه منظم با قاب برجسته */
function windows(
  face: 'front' | 'back' | 'left' | 'right',
  h: number, floors: number, cols: number,
  st: BuildingStyle, parts: Part[],
): void {
  const floorH = h / floors;
  const winW = 66;
  const winH = Math.min(58, floorH * 0.5);
  const zOff = W / 2 + 3;

  for (let f = 0; f < floors; f++) {
    const cy = floorH * f + floorH * 0.58;
    if (cy + winH / 2 > h - 14) break;
    for (let c = 0; c < cols; c++) {
      const span = W / cols;
      const cx = -W / 2 + span * (c + 0.5);
      // یک در میانه طبقه همکف در وجه جلو را پنجره نزن
      if (f === 0 && face === 'front' && c === Math.floor(cols / 2)) continue;

      const put = (px: number, py: number, pz: number, ry: number): void => {
        parts.push(box(winW, winH, 4, st.window, px, py, pz, ry));
        parts.push(box(winW + 10, 6, 6, st.wall2, px, py - winH / 2 - 3, pz + (ry ? 0 : 0.5), ry));
        parts.push(box(winW + 10, 6, 6, st.wall2, px, py + winH / 2 + 3, pz + (ry ? 0 : 0.5), ry));
      };

      if (face === 'front') put(cx, cy, zOff, 0);
      else if (face === 'back') put(cx, cy, -zOff, 0);
      else if (face === 'left') put(-zOff, cy, cx, Math.PI / 2);
      else put(zOff, cy, cx, Math.PI / 2);
    }
  }
}

/** پشت‌بام ایرانی: کولر آبی + منبع آب + ظرف ماهواره + آنتن + لبه بام */
function rooftop(h: number, seed: number, st: BuildingStyle, parts: Part[]): void {
  const s = (n: number): number => {
    const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  // لبه بام
  const lip = 14;
  parts.push(box(W + 8, lip, 16, st.wall2, 0, h + lip / 2, W / 2 + 2));
  parts.push(box(W + 8, lip, 16, st.wall2, 0, h + lip / 2, -W / 2 - 2));
  parts.push(box(16, lip, W + 8, st.wall2, W / 2 + 2, h + lip / 2, 0));
  parts.push(box(16, lip, W + 8, st.wall2, -W / 2 - 2, h + lip / 2, 0));
  // کولر آبی (باکس سفید با پرده‌های جانبی)
  const acx = -W * 0.22 + s(1) * W * 0.14;
  const acz = -W * 0.18 + s(2) * W * 0.12;
  parts.push(box(86, 74, 86, '#e8e6e0', acx, h + 37, acz));
  for (let i = 0; i < 3; i++) parts.push(box(4, 62, 70, '#c9c6be', acx - 43 + i * 3, h + 37, acz + 10));
  // منبع آب آبی
  const wtx = W * 0.2 + s(3) * W * 0.12;
  parts.push(cyl(30, 58, 10, '#2f6fae', wtx, h + 29, -W * 0.1 + s(4) * W * 0.1));
  parts.push(cyl(12, 34, 8, '#3d88cc', wtx, h + 8, -W * 0.1 + s(4) * W * 0.1));
  // ظرف ماهواره (دیوش)
  const dtx = W * 0.05 + s(5) * W * 0.2;
  const dish = new THREE.SphereGeometry(30, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.3);
  dish.rotateX(-Math.PI / 2.6);
  dish.translate(dtx, h + 44, W * 0.16);
  parts.push({ geo: dish, color: '#d8d5cd' });
  parts.push(box(4, 26, 4, '#8f8c84', dtx, h + 16, W * 0.16));
  // آنتن چتری
  const ax = -W * 0.05 + s(6) * W * 0.3;
  parts.push(cyl(1.8, 90, 6, '#7d7a72', ax, h + 45, W * 0.1));
  parts.push(box(30, 3, 3, '#7d7a72', ax, h + 72, W * 0.1));
  parts.push(box(3, 3, 30, '#7d7a72', ax, h + 66, W * 0.1));
}

/** ساخت هندسه کامل یک ساختمان (بر حسب نوع و ارتفاع) */
export function buildBuildingGeometry(type: BuildingType, height: number, seed: number): THREE.BufferGeometry {
  const st = BUILDING_STYLES[type];
  const parts: Part[] = [];
  const h = height;

  // حجم اصلی
  parts.push(box(W, h, W, st.wall, 0, h / 2, 0));
  // نوار افقی بین طبقات (accent)
  const floors = Math.max(1, Math.round(h / st.floors));
  const floorH = h / floors;
  for (let f = 1; f < floors; f++) {
    parts.push(box(W + 4, 7, W + 4, st.wall2, 0, floorH * f, 0));
  }

  // همکف بر حسب نوع
  if (type === 'shop') {
    // ویترین بزرگ مغازه + آویز راه‌راه + در
    parts.push(box(W * 0.62, 96, 6, st.window, -W * 0.14, 62, W / 2 + 4));
    parts.push(box(W * 0.7, 12, 26, st.accent, -W * 0.14, 122, W / 2 + 14));
    parts.push(box(64, 120, 6, st.door, W * 0.26, 60, W / 2 + 4));
    // تابلوی مغازه بالای ویترین
    parts.push(box(W * 0.64, 34, 8, st.accent, -W * 0.12, 152, W / 2 + 6));
  } else {
    // در ورودی + سایبان کوچک
    parts.push(box(70, 128, 6, st.door, 0, 64, W / 2 + 4));
    parts.push(box(110, 10, 40, st.accent, 0, 134, W / 2 + 18));
  }

  // پنجره‌ها روی هر ۴ وجه
  const cols = 4;
  windows('front', h, floors, cols, st, parts);
  windows('back', h, floors, cols, st, parts);
  windows('left', h, floors, cols, st, parts);
  windows('right', h, floors, cols, st, parts);

  // بالکن برای آپارتمان (هر طبقه، وجه جلو)
  if (type === 'apartment') {
    for (let f = 1; f < floors; f++) {
      const cy = floorH * f;
      if (cy > h - floorH) break;
      parts.push(box(150, 8, 34, st.wall2, -W * 0.18, cy - 4, W / 2 + 16));
      parts.push(box(150, 34, 6, st.accent, -W * 0.18, cy + 14, W / 2 + 30));
      parts.push(box(6, 34, 34, st.accent, -W * 0.18 - 72, cy + 14, W / 2 + 16));
      parts.push(box(6, 34, 34, st.accent, -W * 0.18 + 72, cy + 14, W / 2 + 16));
    }
  }

  // پارکینگ/تعمیرگاه: در بزرگ حیاطی
  if (type === 'garage') {
    parts.push(box(W * 0.5, 150, 8, '#6d6a63', 0, 75, -W / 2 - 4));
    for (let i = 0; i < 6; i++) parts.push(box(W * 0.5, 5, 10, '#57544e', 0, 20 + i * 24, -W / 2 - 5));
  }

  // پشت‌بام
  rooftop(h, seed, st, parts);

  // merge — همه صفت‌ها یکسان‌سازی
  const geos = parts.map((p) => {
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
  });
  const merged = mergeGeometries(geos, false);
  if (!merged) throw new Error('merge building failed');
  merged.clearGroups();
  return merged;
}
