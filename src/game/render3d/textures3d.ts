/**
 * textures3d.ts — بافت‌های رویه‌ای (Procedural) برای حالت سه‌بعدی
 * ============================================================
 * همه بافت‌ها با Canvas2D تولید می‌شوند — بدون Asset خارجی.
 * سبک: Low-Poly کارتونی روشن هم‌خانواده با رندر دوبعدی.
 * (کش یک‌بار در سازه؛ هیچ new در حلقه فریم)
 */

import * as THREE from 'three';

function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported (textures3d)');
  return { c, ctx };
}

function toTex(c: HTMLCanvasElement, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let roadStraightTex: THREE.CanvasTexture | null = null;
let asphaltPlainTex: THREE.CanvasTexture | null = null;
let sidewalkTex: THREE.CanvasTexture | null = null;
let grassTex: THREE.CanvasTexture | null = null;
const facadeTexCache = new Map<string, THREE.CanvasTexture[]>();

/** آسفالت جاده با خط‌کشی وسط (چین‌چین سفید) — V در امتداد جاده */
export function getRoadStraightTexture(): THREE.CanvasTexture {
  if (roadStraightTex) return roadStraightTex;
  const { c, ctx } = makeCanvas(256, 256);
  // آسفالت
  ctx.fillStyle = '#5c5c60';
  ctx.fillRect(0, 0, 256, 256);
  // نویز ملایم
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillRect(x, y, 3 + Math.random() * 5, 2 + Math.random() * 4);
  }
  // خط‌کشی وسط (در جهت V = عمودی کانواس)
  ctx.fillStyle = 'rgba(245,245,240,0.92)';
  ctx.fillRect(124, 18, 8, 92);
  ctx.fillRect(124, 146, 8, 92);
  // لبه‌های زرد کم‌رنگ
  ctx.fillStyle = 'rgba(230,190,70,0.65)';
  ctx.fillRect(10, 0, 6, 256);
  ctx.fillRect(240, 0, 6, 256);
  roadStraightTex = toTex(c);
  return roadStraightTex;
}

/** آسفالت ساده برای تقاطع */
export function getAsphaltPlainTexture(): THREE.CanvasTexture {
  if (asphaltPlainTex) return asphaltPlainTex;
  const { c, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#5c5c60';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 2 + Math.random() * 3);
  }
  asphaltPlainTex = toTex(c, 2, 2);
  return asphaltPlainTex;
}

/** پیاده‌روی سنگ‌فرش روشن */
export function getSidewalkTexture(): THREE.CanvasTexture {
  if (sidewalkTex) return sidewalkTex;
  const { c, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#b9b3a6';
  ctx.fillRect(0, 0, 128, 128);
  // درز سنگ‌ها
  ctx.strokeStyle = 'rgba(70,64,58,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(128, i * 64); ctx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 3);
  }
  sidewalkTex = toTex(c, 6, 6);
  return sidewalkTex;
}

/** چمن پارک */
export function getGrassTexture(): THREE.CanvasTexture {
  if (grassTex) return grassTex;
  const { c, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#7fb95c';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 320; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(30,80,30,0.10)';
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 4 + Math.random() * 5);
  }
  grassTex = toTex(c, 5, 5);
  return grassTex;
}

/**
 * نمایه ساختمان (۶ وجه بکس) — بر اساس نوع
 * خروجی: [side, side, top, bottom, side, side] برای متریال آرایه‌ای BoxGeometry
 */
export function getFacadeTextures(assetId: string): THREE.CanvasTexture[] {
  const cached = facadeTexCache.get(assetId);
  if (cached) return cached;

  let wall = '#e7d9b8';
  let trim = '#c9b98a';
  let winBg = '#9fc4d8';
  let awning: string | null = null;
  let doorColor = '#7a5c3d';

  switch (assetId) {
    case 'env_building_home_01':
      wall = '#efdcc0'; trim = '#d8b98e'; winBg = '#a8cbe0';
      break;
    case 'env_building_shop_01':
      wall = '#f2c98c'; trim = '#c98d4b'; winBg = '#b8d8e8';
      awning = '#e2574c';
      break;
    case 'env_building_garage_01':
      wall = '#b8b8b4'; trim = '#8f8f8a'; winBg = '#7f96a8';
      doorColor = '#5f6a75';
      break;
    default:
      wall = '#e7d9b8'; trim = '#c9b98a'; winBg = '#9fc4d8';
  }

  // --- وجه طبقات با پنجره ---
  const { c: face, ctx: fx } = makeCanvas(256, 256);
  fx.fillStyle = wall;
  fx.fillRect(0, 0, 256, 256);
  const cols = 3;
  const rows = 3;
  const pw = 44;
  const ph = 52;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const wx = 32 + i * 80;
      const wy = 28 + j * 84;
      fx.fillStyle = 'rgba(0,0,0,0.22)';
      fx.fillRect(wx + 4, wy + 5, pw, ph); // سایه
      fx.fillStyle = winBg;
      fx.fillRect(wx, wy, pw, ph);
      fx.fillStyle = 'rgba(255,255,255,0.5)';
      fx.fillRect(wx + 4, wy + 4, pw - 22, 14); // بازتاب
      fx.strokeStyle = trim;
      fx.lineWidth = 5;
      fx.strokeRect(wx, wy, pw, ph);
    }
  }
  // نوار پایین
  fx.fillStyle = trim;
  fx.fillRect(0, 236, 256, 20);

  // --- وجه همکف ---
  const { c: groundF, ctx: gx } = makeCanvas(256, 256);
  gx.fillStyle = wall;
  gx.fillRect(0, 0, 256, 256);
  if (awning) {
    // آویز راه‌راه مغازه
    gx.fillStyle = awning;
    gx.fillRect(0, 148, 256, 26);
    gx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 8; i++) gx.fillRect(i * 32 + 4, 148, 16, 26);
    // شیشه بزرگ
    gx.fillStyle = winBg;
    gx.fillRect(20, 180, 216, 62);
    gx.fillStyle = 'rgba(255,255,255,0.35)';
    gx.fillRect(28, 184, 60, 54);
    gx.strokeStyle = trim;
    gx.lineWidth = 6;
    gx.strokeRect(20, 180, 216, 62);
  } else if (assetId === 'env_building_garage_01') {
    // در بزرگ گاراژ
    gx.fillStyle = doorColor;
    gx.fillRect(28, 130, 200, 112);
    gx.strokeStyle = 'rgba(0,0,0,0.28)';
    gx.lineWidth = 4;
    for (let i = 1; i < 5; i++) {
      gx.beginPath(); gx.moveTo(28, 130 + i * 22); gx.lineTo(228, 130 + i * 22); gx.stroke();
    }
    gx.strokeStyle = trim; gx.lineWidth = 6;
    gx.strokeRect(28, 130, 200, 112);
  } else {
    // در خانه + پنجره
    gx.fillStyle = doorColor;
    gx.fillRect(150, 168, 64, 88);
    gx.strokeStyle = trim; gx.lineWidth = 5;
    gx.strokeRect(150, 168, 64, 88);
    gx.fillStyle = winBg;
    gx.fillRect(40, 172, 72, 70);
    gx.strokeStyle = trim; gx.lineWidth = 5;
    gx.strokeRect(40, 172, 72, 70);
  }

  // --- سقف ---
  const { c: roof, ctx: rx } = makeCanvas(64, 64);
  rx.fillStyle = trim;
  rx.fillRect(0, 0, 64, 64);
  rx.fillStyle = 'rgba(0,0,0,0.08)';
  rx.fillRect(0, 0, 64, 8);
  rx.fillRect(0, 0, 8, 64);

  const faceTex = toTex(face);
  const groundTex = toTex(groundF);
  const roofTex = toTex(roof);
  const arr = [faceTex, faceTex, roofTex, roofTex, groundTex, groundTex];
  facadeTexCache.set(assetId, arr);
  return arr;
}
