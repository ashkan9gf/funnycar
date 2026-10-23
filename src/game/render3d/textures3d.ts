/**
 * textures3d.ts — بافت‌های رویه‌ای (Procedural) برای حالت سه‌بعدی
 * ============================================================
 * همه بافت‌ها با Canvas2D تولید می‌شوند — بدون Asset خارجی.
 * فاز GTA-IR: آسفالت ترک‌خورده با وصله، خط عابر پیاده، تابلوهای فارسی،
 * پلاک ایرانی، علامت تاکسی، بیلبورد طنز، آسمان گرادیانی تهران!
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

/** فونت مشترک متن فارسی روی بافت‌ها */
const FA_FONT = (size: number, weight = 900) => `${weight} ${size}px Vazirmatn, Tahoma, sans-serif`;

/** Fit Persian signage to its plaque while keeping the intended font weight. */
function fitPersianText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  preferredSize: number,
  minSize = 14,
  weight = 900,
): number {
  let size = preferredSize;
  while (size > minSize) {
    ctx.font = FA_FONT(size, weight);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 1;
  }
  ctx.font = FA_FONT(size, weight);
  return size;
}

let roadStraightTex: THREE.CanvasTexture | null = null;
let crossroadTex: THREE.CanvasTexture | null = null;
let asphaltPlainTex: THREE.CanvasTexture | null = null;
let sidewalkTex: THREE.CanvasTexture | null = null;
let grassTex: THREE.CanvasTexture | null = null;
let skyTex: THREE.CanvasTexture | null = null;
let plateTex: THREE.CanvasTexture | null = null;
let taxiSignTex: THREE.CanvasTexture | null = null;
let speedBumpTex: THREE.CanvasTexture | null = null;
const facadeTexCache = new Map<string, THREE.CanvasTexture[]>();
const labelTexCache = new Map<string, THREE.CanvasTexture>();

// Cached, tileable asphalt micro-detail maps. Generated once (never per frame).
let terrainTex: THREE.CanvasTexture | null = null;

/**
 * Tileable Iranian roadside terrain: warm compacted soil, fine gravel and sparse
 * dry grass. Generated once and repeated on the large ground plane to avoid a
 * flat, featureless horizon without adding geometry or per-frame work.
 */
export function getTerrainTexture(): THREE.CanvasTexture {
  if (terrainTex) return terrainTex;
  const size = 512;
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#b9a77c';
  ctx.fillRect(0, 0, size, size);

  // Fine mineral grain with low contrast so it reads as material, not visual noise.
  for (let i = 0; i < 5200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 0.35 + Math.random() * 1.25;
    const light = Math.random() > 0.48;
    ctx.fillStyle = light ? 'rgba(244,229,190,0.24)' : 'rgba(78,66,43,0.17)';
    ctx.beginPath();
    ctx.ellipse(x, y, r * (1.1 + Math.random()), r, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sparse dry grass / scrub marks; duplicate near-edge strokes to keep the tile seamless.
  for (let i = 0; i < 95; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 3 + Math.random() * 8;
    const angle = (Math.random() - 0.5) * 1.2;
    ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(83,100,48,0.30)' : 'rgba(141,126,75,0.28)';
    ctx.lineWidth = 0.7 + Math.random() * 0.7;
    const draw = (ox: number, oy: number) => {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + oy);
      ctx.lineTo(x + ox + Math.sin(angle) * len, y + oy - Math.cos(angle) * len);
      ctx.stroke();
    };
    draw(0, 0);
    if (x < 12) draw(size, 0);
    if (x > size - 12) draw(-size, 0);
    if (y < 12) draw(0, size);
    if (y > size - 12) draw(0, -size);
  }

  terrainTex = toTex(c, 36, 36);
  terrainTex.generateMipmaps = true;
  terrainTex.minFilter = THREE.LinearMipmapLinearFilter;
  terrainTex.magFilter = THREE.LinearFilter;
  return terrainTex;
}

let roadNormalTex: THREE.CanvasTexture | null = null;
let roadRoughnessTex: THREE.CanvasTexture | null = null;

function buildRoadMicroMaps(): void {
  if (roadNormalTex && roadRoughnessTex) return;
  // Higher-frequency, tileable micro detail for close-up road highlights; two 384² maps remain inexpensive on mobile.
  const size = 384;
  const { c: normalCanvas, ctx: normalCtx } = makeCanvas(size, size);
  const normalImage = normalCtx.createImageData(size, size);
  const { c: roughCanvas, ctx: roughCtx } = makeCanvas(size, size);
  const roughImage = roughCtx.createImageData(size, size);
  const heightAt = (x: number, y: number): number => {
    const a = (Math.PI * 2 * x) / 8;
    const b = (Math.PI * 2 * y) / 16;
    const d = (Math.PI * 2 * (x + y)) / 32;
    return Math.sin(a) * Math.sin(b) * 0.42
      + Math.sin((Math.PI * 2 * x) / 4) * Math.sin((Math.PI * 2 * y) / 8) * 0.12
      + Math.sin(d) * 0.18
      + Math.sin((Math.PI * 2 * (x - y)) / 16) * 0.10;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = heightAt((x + 1) % size, y) - heightAt((x + size - 1) % size, y);
      const dy = heightAt(x, (y + 1) % size) - heightAt(x, (y + size - 1) % size);
      const nx = -dx * 3.2;
      const ny = -dy * 3.2;
      const nz = 1;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      normalImage.data[i] = Math.round((nx * invLen * 0.5 + 0.5) * 255);
      normalImage.data[i + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
      normalImage.data[i + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      normalImage.data[i + 3] = 255;
      const grain = Math.sin((Math.PI * 2 * x) / 8) * Math.sin((Math.PI * 2 * y) / 16);
      const fine = Math.sin((Math.PI * 2 * (x + y)) / 32);
      const rough = Math.max(0, Math.min(255, Math.round(231 + grain * 8 + fine * 5)));
      roughImage.data[i] = rough;
      roughImage.data[i + 1] = rough;
      roughImage.data[i + 2] = rough;
      roughImage.data[i + 3] = 255;
    }
  }
  normalCtx.putImageData(normalImage, 0, 0);
  roughCtx.putImageData(roughImage, 0, 0);
  roadNormalTex = new THREE.CanvasTexture(normalCanvas);
  roadNormalTex.wrapS = roadNormalTex.wrapT = THREE.RepeatWrapping;
  roadNormalTex.colorSpace = THREE.NoColorSpace;
  roadNormalTex.generateMipmaps = true;
  roadNormalTex.minFilter = THREE.LinearMipmapLinearFilter;
  roadNormalTex.magFilter = THREE.LinearFilter;
  roadRoughnessTex = new THREE.CanvasTexture(roughCanvas);
  roadRoughnessTex.wrapS = roadRoughnessTex.wrapT = THREE.RepeatWrapping;
  roadRoughnessTex.colorSpace = THREE.NoColorSpace;
  roadRoughnessTex.generateMipmaps = true;
  roadRoughnessTex.minFilter = THREE.LinearMipmapLinearFilter;
  roadRoughnessTex.magFilter = THREE.LinearFilter;
}

/** Tileable micro-normal + roughness maps for asphalt PBR. */
export function getRoadMicroMaps(): { normalMap: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  buildRoadMicroMaps();
  if (!roadNormalTex || !roadRoughnessTex) throw new Error('Road micro maps were not initialized');
  return { normalMap: roadNormalTex, roughnessMap: roadRoughnessTex };
}


/** خطوط ترک آسفالت (پلی‌لاین‌های باریک تیره) */
function drawCracks(ctx: CanvasRenderingContext2D, w: number, h: number, count: number): void {
  const scale = w / 512;
  for (let i = 0; i < count; i++) {
    let x = Math.random() * w;
    let y = Math.random() * h;
    ctx.strokeStyle = 'rgba(20,18,16,0.30)';
    ctx.lineWidth = (1 + Math.random() * 1.6) * scale;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 4 + Math.floor(Math.random() * 5);
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * 42 * scale;
      y += (Math.random() - 0.5) * 42 * scale;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** وصله آسفالت (مستطیل تیره‌تر — تعمیر جاده‌های ایران!) */
function drawPatches(ctx: CanvasRenderingContext2D, w: number, h: number, count: number): void {
  const scale = w / 512;
  for (let i = 0; i < count; i++) {
    const pw = (26 + Math.random() * 40) * scale;
    const ph = (18 + Math.random() * 34) * scale;
    const px = Math.random() * (w - pw);
    const py = Math.random() * (h - ph);
    ctx.fillStyle = 'rgba(30,28,26,0.22)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(15,13,11,0.28)';
    ctx.lineWidth = 2 * scale;
    ctx.strokeRect(px, py, pw, ph);
  }
}

/**
 * آسفالت جاده دوطرفه ۴ لاین (فاز BIG-IR — عرض 560px):
 *  - خط دوگانه زرد وسط (تفکیک دو جهت)
 *  - خط‌چین سفید بین لاین داخلی/بیرونی هر جهت
 *  - ترک + وصله + منهول — حس خیابان واقعی تهران
 * U در امتداد عرض جاده، V در امتداد طول.
 */
export function getRoadStraightTexture(): THREE.CanvasTexture {
  if (roadStraightTex) return roadStraightTex;
  // 2× resolution over the old 512 atlas; all markings preserve their world-space scale.
  const S = 1024;
  const scale = S / 512;
  const { c, ctx } = makeCanvas(S, S);
  // Multi-scale asphalt grain: subtle albedo variation rather than large, obvious speckles.
  ctx.fillStyle = '#58585c';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2800; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.055)';
    const grain = (1.2 + Math.random() * 2.8) * scale;
    ctx.fillRect(Math.random() * S, Math.random() * S, grain, grain * (0.7 + Math.random() * 0.8));
  }
  // Broad, fine, and repaired areas remain legible at high camera angles.
  drawCracks(ctx, S, S, 28);
  drawPatches(ctx, S, S, 7);

  // Manhole
  const mx = 100 * scale, my = 170 * scale;
  ctx.fillStyle = '#3c3a38';
  ctx.beginPath(); ctx.arc(mx, my, 17 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(200,200,190,0.4)'; ctx.lineWidth = 3 * scale;
  ctx.beginPath(); ctx.arc(mx, my, 17 * scale, 0, Math.PI * 2); ctx.stroke();

  // Double yellow center line
  ctx.fillStyle = 'rgba(226,190,80,0.85)';
  ctx.fillRect(S / 2 - 9 * scale, 0, 6 * scale, S);
  ctx.fillRect(S / 2 + 3 * scale, 0, 6 * scale, S);

  // Dashed white lane separators
  ctx.fillStyle = 'rgba(245,245,240,0.8)';
  for (const lx of [137 * scale, 375 * scale]) {
    for (let y = 20 * scale; y < S; y += 120 * scale) {
      ctx.fillRect(lx - 4 * scale, y, 8 * scale, 84 * scale);
    }
  }

  // Worn yellow edge markings and grime
  ctx.fillStyle = 'rgba(226,190,80,0.55)';
  ctx.fillRect(10 * scale, 0, 7 * scale, S);
  ctx.fillRect(S - 17 * scale, 0, 7 * scale, S);
  ctx.fillStyle = 'rgba(40,36,30,0.14)';
  ctx.fillRect(0, 0, 12 * scale, S);
  ctx.fillRect(S - 12 * scale, 0, 12 * scale, S);

  roadStraightTex = toTex(c);
  return roadStraightTex;
}

/**
 * بافت تقاطع با خط عابر پیاده (زیبرا) در چهار طرف
 * — امضای خیابان‌های ایران و حس GTA شهری.
 */
export function getCrossroadTexture(): THREE.CanvasTexture {
  if (crossroadTex) return crossroadTex;
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#58585c';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 560; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(Math.random() * S, Math.random() * S, 3, 3);
  }
  drawCracks(ctx, S, S, 10);
  drawPatches(ctx, S, S, 2);

  // زیبرا: نوارهای سفید در ۴ طرف (باند عرضی نزدیک لبه)
  const bandDepth = 64;
  const stripeW = 22;
  const gap = 16;
  const innerPad = 86; // فاصله از گوشه تا شروع زیبرا
  ctx.fillStyle = 'rgba(242,242,238,0.88)';
  // بالا و پایین (نوارها در جهت V)
  for (let x = innerPad; x < S - innerPad - stripeW; x += stripeW + gap) {
    ctx.fillRect(x, 14, stripeW, bandDepth);
    ctx.fillRect(x, S - 14 - bandDepth, stripeW, bandDepth);
  }
  // چپ و راست (نوارها افقی)
  for (let y = innerPad; y < S - innerPad - stripeW; y += stripeW + gap) {
    ctx.fillRect(14, y, bandDepth, stripeW);
    ctx.fillRect(S - 14 - bandDepth, y, bandDepth, stripeW);
  }
  // خط توقف قبل از زیبرا (نیمه عرض — سمت راست‌رانندگان)
  ctx.fillStyle = 'rgba(242,242,238,0.7)';
  ctx.fillRect(S - 14 - bandDepth - 26, innerPad, 12, S - innerPad * 2);

  crossroadTex = toTex(c);
  return crossroadTex;
}

/** آسفالت ساده برای کاشی‌های جنبی */
export function getAsphaltPlainTexture(): THREE.CanvasTexture {
  if (asphaltPlainTex) return asphaltPlainTex;
  const { c, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#58585c';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.055)';
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 2 + Math.random() * 3);
  }
  asphaltPlainTex = toTex(c, 2, 2);
  return asphaltPlainTex;
}

/** پیاده‌روی سنگ‌فرش با کاشی‌های قرمز تزئینی (خیابان‌های ایران) */
export function getSidewalkTexture(): THREE.CanvasTexture {
  if (sidewalkTex) return sidewalkTex;
  const S = 128;
  const { c, ctx } = makeCanvas(S, S);
  ctx.fillStyle = '#b5afa2';
  ctx.fillRect(0, 0, S, S);
  // درز سنگ‌ها
  ctx.strokeStyle = 'rgba(70,64,58,0.35)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(S, i * 64); ctx.stroke();
  }
  // چند کاشی قرمز (الگوی معروف پیاده‌روی ایرانی)
  const reds: Array<[number, number]> = [[0, 0], [64, 64]];
  for (const [rx, ry] of reds) {
    ctx.fillStyle = '#b85c4a';
    ctx.fillRect(rx + 3, ry + 3, 58, 58);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(rx + 3, ry + 3, 58, 8);
    ctx.strokeStyle = 'rgba(70,64,58,0.35)';
    ctx.strokeRect(rx + 3, ry + 3, 58, 58);
  }
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.035)';
    ctx.fillRect(Math.random() * S, Math.random() * S, 3, 3);
  }
  sidewalkTex = toTex(c, 22, 22); // کاشی ریزتر — الگوی قرمز ظریف (فیکس غلبه قرمز-سفید)
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

/** آسمان گرادیانی با غبار گرم افق (تهران!) — scene.background */
export function getSkyTexture(): THREE.CanvasTexture {
  if (skyTex) return skyTex;
  const { c, ctx } = makeCanvas(64, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#6db8e0');
  grad.addColorStop(0.55, '#a3d2e6');
  grad.addColorStop(0.85, '#d8e3d8');
  grad.addColorStop(1, '#ece0c4'); // غبار افق
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  skyTex = t;
  return t;
}

/** پلاک ایرانی — سفید با نوار آبی چپ و خانه‌های عدد */
export function getPlateTexture(): THREE.CanvasTexture {
  if (plateTex) return plateTex;
  const { c, ctx } = makeCanvas(96, 32);
  ctx.fillStyle = '#f5f5f0';
  ctx.fillRect(0, 0, 96, 32);
  ctx.fillStyle = '#1a5276';
  ctx.fillRect(0, 0, 12, 32);
  ctx.strokeStyle = '#22201e';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 94, 30);
  // خانه‌های عدد (شش بلوک تیره)
  ctx.fillStyle = '#22201e';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(20 + i * 12, 8, 7, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  plateTex = t;
  return t;
}

/** علامت تاکسی روی سقف — «تاکسی» مشکی روی سفید */
export function getTaxiSignTexture(): THREE.CanvasTexture {
  if (taxiSignTex) return taxiSignTex;
  const { c, ctx } = makeCanvas(96, 40);
  ctx.fillStyle = '#fff9ec';
  ctx.fillRect(0, 0, 96, 40);
  ctx.strokeStyle = '#3a2e2a';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 92, 36);
  ctx.fillStyle = '#3a2e2a';
  ctx.font = FA_FONT(22);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('تاکسی', 48, 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  taxiSignTex = t;
  return t;
}

/** بافت سرعت‌گیر — راه‌راه زرد/مشکی */
export function getSpeedBumpTexture(): THREE.CanvasTexture {
  if (speedBumpTex) return speedBumpTex;
  const { c, ctx } = makeCanvas(64, 32);
  ctx.fillStyle = '#e8b83a';
  ctx.fillRect(0, 0, 64, 32);
  ctx.fillStyle = '#2e2824';
  for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 8, 32);
  speedBumpTex = toTex(c);
  return speedBumpTex;
}

/**
 * تابلو برجسته (بیلبورد) با متن فارسی — دو خط
 */
export function getBillboardTexture(line1: string, line2: string, bg = '#F2B705'): THREE.CanvasTexture {
  const key = `bb_${line1}_${line2}_${bg}`;
  const cached = labelTexCache.get(key);
  if (cached) return cached;
  const { c, ctx } = makeCanvas(256, 128);
  ctx.fillStyle = '#8f8f8a';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = bg;
  ctx.fillRect(8, 8, 240, 112);
  ctx.strokeStyle = '#3a2e2a';
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 240, 112);
  ctx.fillStyle = '#3a2e2a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FA_FONT(30);
  ctx.fillText(line1, 128, 50);
  ctx.font = FA_FONT(24, 700);
  ctx.fillText(line2, 128, 88);
  const t = toTex(c);
  labelTexCache.set(key, t);
  return t;
}

/** تابلوی خیابان آبی — نام خیابان‌های معروف */
export function getStreetSignTexture(name: string): THREE.CanvasTexture {
  const key = `st_${name}`;
  const cached = labelTexCache.get(key);
  if (cached) return cached;
  // Match the real plaque's wide aspect ratio; use a reflective blue gradient,
  // layered borders, and fitted Persian text so long street names stay legible.
  const { c, ctx } = makeCanvas(256, 80);
  const gradient = ctx.createLinearGradient(0, 0, 0, 80);
  gradient.addColorStop(0, '#438bd0');
  gradient.addColorStop(0.48, '#2464a5');
  gradient.addColorStop(1, '#174979');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 80);
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.fillRect(9, 8, 238, 18);
  ctx.strokeStyle = '#d9efff';
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, 250, 74);
  ctx.strokeStyle = 'rgba(255,255,255,0.48)';
  ctx.lineWidth = 1;
  ctx.strokeRect(8, 8, 240, 64);
  // Small reflective end markers make the sign readable at a glance.
  ctx.fillStyle = '#f7d66a';
  ctx.fillRect(13, 32, 5, 16);
  ctx.fillRect(238, 32, 5, 16);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 2;
  fitPersianText(ctx, name, 210, 29, 16, 900);
  ctx.fillText(name, 128, 43, 210);
  ctx.shadowBlur = 0;
  const t = toTex(c);
  labelTexCache.set(key, t);
  return t;
}

/** تابلوی ایستگاه اتوبوس */
export function getBusStopTexture(): THREE.CanvasTexture {
  const key = 'busstop';
  const cached = labelTexCache.get(key);
  if (cached) return cached;
  const { c, ctx } = makeCanvas(160, 56);
  ctx.fillStyle = '#FFF9EC';
  ctx.fillRect(0, 0, 160, 56);
  ctx.fillStyle = '#2A9D8F';
  ctx.fillRect(0, 0, 160, 18);
  ctx.fillStyle = '#3a2e2a';
  ctx.font = FA_FONT(22);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ایستگاه اتوبوس', 80, 38);
  const t = toTex(c);
  labelTexCache.set(key, t);
  return t;
}

/**
 * نمایه ساختمان (۶ وجه بکس) — بر اساس نوع
 * فاز GTA-IR: خانه آجری با بالکن، مغازه با تابلو فارسی، تعمیرگاه
 * فاز IR-SIGNS (پورت سبک از backup-v0.2.22): هر متنِ تابلو نسخه بافت خودش را دارد —
 * کش بر اساس (assetId + متن)؛ همه چیز همان ۲۵۶×۲۵۶ روانِ v13 می‌ماند
 * خروجی: [side, side, top, bottom, side, side] برای متریال آرایه‌ای BoxGeometry
 */
export function getFacadeTextures(assetId: string, signOverride?: string): THREE.CanvasTexture[] {
  const cacheKey = `${assetId}|${signOverride ?? ''}`;
  const cached = facadeTexCache.get(cacheKey);
  if (cached) return cached;

  let wall = '#e7d9b8';
  let trim = '#c9b98a';
  let winBg = '#9fc4d8';
  let awning: string | null = null;
  let doorColor = '#7a5c3d';
  let signText: string | null = null;
  let brick = false;

  switch (assetId) {
    case 'env_building_home_01':
      wall = '#e8dcc2'; trim = '#b06a4a'; winBg = '#a8cbe0';
      brick = true; // طبقه همکف آجر
      break;
    case 'env_building_shop_01':
      wall = '#f2c98c'; trim = '#c98d4b'; winBg = '#b8d8e8';
      awning = '#e2574c';
      signText = signOverride ?? 'سوپرمارکت'; // فاز IR-SIGNS: تنوع مغازه‌ها
      break;
    case 'env_building_garage_01':
      wall = '#c4c0b8'; trim = '#8f8f8a'; winBg = '#7f96a8';
      doorColor = '#5f6a75';
      signText = signOverride ?? 'تعمیرگاه';
      break;
    case 'env_building_apartment_01':
      // آپارتمان مدرن شمال تهران — شیشه‌ای با نوارهای افقی
      wall = '#dde3e8'; trim = '#9fb2c0'; winBg = '#7fb3d5';
      break;
    default:
      wall = '#e7d9b8'; trim = '#c9b98a'; winBg = '#9fc4d8';
  }

  // --- وجه طبقات با پنجره + بالکن ---
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
      // نرده بالکن (دو طبقه بالا)
      if (j < rows - 1) {
        fx.strokeStyle = 'rgba(50,44,40,0.75)';
        fx.lineWidth = 3;
        fx.beginPath();
        fx.moveTo(wx - 6, wy + ph + 12);
        fx.lineTo(wx + pw + 6, wy + ph + 12);
        fx.stroke();
        for (let b = 0; b <= 4; b++) {
          const bx = wx - 6 + (b * (pw + 12)) / 4;
          fx.beginPath(); fx.moveTo(bx, wy + ph + 2); fx.lineTo(bx, wy + ph + 12); fx.stroke();
        }
      }
    }
  }
  fx.fillStyle = trim;
  fx.fillRect(0, 236, 256, 20);

  // --- وجه همکف ---
  const { c: groundF, ctx: gx } = makeCanvas(256, 256);
  gx.fillStyle = wall;
  gx.fillRect(0, 0, 256, 256);
  if (brick) {
    // نیمه پایین: آجرچینی ایرانی
    gx.fillStyle = '#a25a42';
    gx.fillRect(0, 128, 256, 128);
    gx.strokeStyle = 'rgba(240,230,215,0.35)';
    gx.lineWidth = 2;
    for (let row = 0; row < 8; row++) {
      const y = 132 + row * 16;
      gx.beginPath(); gx.moveTo(0, y); gx.lineTo(256, y); gx.stroke();
      const offset = row % 2 === 0 ? 0 : 16;
      for (let bx = offset; bx < 256; bx += 32) {
        gx.beginPath(); gx.moveTo(bx, y); gx.lineTo(bx, y + 16); gx.stroke();
      }
    }
  }
  if (signText) {
    // تابلوی فارسی بالای ورودی
    const signGradient = gx.createLinearGradient(28, 96, 228, 138);
    signGradient.addColorStop(0, '#292d32');
    signGradient.addColorStop(1, '#4a3428');
    gx.fillStyle = signGradient;
    gx.fillRect(28, 96, 200, 42);
    gx.strokeStyle = '#d9b56d';
    gx.lineWidth = 3;
    gx.strokeRect(28, 96, 200, 42);
    gx.strokeStyle = 'rgba(255,249,236,0.55)';
    gx.lineWidth = 1;
    gx.strokeRect(33, 101, 190, 32);
    gx.fillStyle = '#FFF9EC';
    gx.textAlign = 'center';
    gx.textBaseline = 'middle';
    gx.shadowColor = 'rgba(0,0,0,0.65)';
    gx.shadowBlur = 2;
    fitPersianText(gx, signText, 180, 26, 15, 900);
    gx.fillText(signText, 128, 118, 180);
    gx.shadowBlur = 0;
  }
  if (awning) {
    // آویز راه‌راه مغازه
    gx.fillStyle = awning;
    gx.fillRect(0, 148, 256, 26);
    gx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 8; i++) gx.fillRect(i * 32 + 4, 148, 16, 26);
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
    gx.fillRect(28, 150, 200, 92);
    gx.strokeStyle = 'rgba(0,0,0,0.28)';
    gx.lineWidth = 4;
    for (let i = 1; i < 5; i++) {
      gx.beginPath(); gx.moveTo(28, 150 + i * 18); gx.lineTo(228, 150 + i * 18); gx.stroke();
    }
    gx.strokeStyle = trim; gx.lineWidth = 6;
    gx.strokeRect(28, 150, 200, 92);
  } else {
    // در خانه + پنجره (روی آجر)
    gx.fillStyle = doorColor;
    gx.fillRect(150, 168, 64, 88);
    gx.strokeStyle = '#e8dcc2'; gx.lineWidth = 5;
    gx.strokeRect(150, 168, 64, 88);
    gx.fillStyle = winBg;
    gx.fillRect(40, 172, 72, 70);
    gx.strokeStyle = '#e8dcc2'; gx.lineWidth = 5;
    gx.strokeRect(40, 172, 72, 70);
  }

  // --- سقف ---
  const { c: roof, ctx: rx } = makeCanvas(64, 64);
  rx.fillStyle = '#b8ac92';
  rx.fillRect(0, 0, 64, 64);
  rx.fillStyle = 'rgba(0,0,0,0.10)';
  rx.fillRect(0, 0, 64, 8);
  rx.fillRect(0, 0, 8, 64);
  for (let i = 0; i < 30; i++) {
    rx.fillStyle = 'rgba(0,0,0,0.06)';
    rx.fillRect(Math.random() * 64, Math.random() * 64, 4, 4);
  }

  const faceTex = toTex(face);
  const groundTex = toTex(groundF);
  const roofTex = toTex(roof);
  const arr = [faceTex, faceTex, roofTex, roofTex, groundTex, groundTex];
  facadeTexCache.set(cacheKey, arr);
  return arr;
}

// ============ فاز CINEMATIC — آسمان گنبدی، ابر، بنر، آفتابی ============

let skyDomeTex: THREE.CanvasTexture | null = null;

/**
 * آسمان سینمایی گنبدی — گرادیان غنی + هاله خورشید + غبار طلایی افق تهران
 * روی نیم‌کره BackSide مپ می‌شود (u = زاویه افق، v = ارتفاع)
 */
export function getSkyDomeTexture(): THREE.CanvasTexture {
  if (skyDomeTex) return skyDomeTex;
  const { c, ctx } = makeCanvas(512, 256);
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#2f6fae'); // آبی عمیق بالا
  grad.addColorStop(0.35, '#5da4d6');
  grad.addColorStop(0.62, '#a8d3e8');
  grad.addColorStop(0.82, '#e8ddb5'); // غبار گرم افق
  grad.addColorStop(1.0, '#f2d9a8'); // طلایی نزدیک زمین
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);
  // هاله خورشید (بالا-راست نیم‌کره)
  const sg = ctx.createRadialGradient(360, 70, 8, 360, 70, 90);
  sg.addColorStop(0, 'rgba(255,244,214,0.95)');
  sg.addColorStop(0.25, 'rgba(255,224,160,0.55)');
  sg.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(240, 0, 240, 170);
  // چند ابر نرم دوردست
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const [cx, cy, rw] of [[90, 62, 60], [150, 78, 44], [430, 110, 52], [250, 95, 40]] as const) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rw, rw * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  skyDomeTex = t;
  return t;
}

let cloudTex: THREE.CanvasTexture | null = null;

/** ابر نرم بیلبوردی — لکه‌های محو سفید */
export function getCloudTexture(): THREE.CanvasTexture {
  if (cloudTex) return cloudTex;
  const { c, ctx } = makeCanvas(256, 128);
  ctx.clearRect(0, 0, 256, 128);
  const blob = (x: number, y: number, r: number, a: number): void => {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.6, `rgba(252,250,246,${a * 0.5})`);
    g.addColorStop(1, 'rgba(250,248,244,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(128, 72, 62, 0.9);
  blob(88, 80, 42, 0.8);
  blob(172, 78, 46, 0.8);
  blob(108, 58, 36, 0.7);
  blob(150, 60, 34, 0.7);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cloudTex = t;
  return t;
}

/** پارچه بنر خیابانی — پس‌زمینه رنگی + متن سفید + دندانه پایین */
export function getBannerTexture(text: string, color: string): THREE.CanvasTexture {
  const key = `bn_${text}_${color}`;
  const cached = labelTexCache.get(key);
  if (cached) return cached;
  const { c, ctx } = makeCanvas(1024, 128);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1024, 128);
  // دندانه پرچم پایین پارچه
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 128);
  for (let x = 0; x < 1024; x += 64) {
    ctx.lineTo(x + 32, 112);
    ctx.lineTo(x + 64, 128);
  }
  ctx.lineTo(1024, 128);
  ctx.closePath();
  ctx.fill();
  // نوارهای سفید بالا/پایین
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, 8, 1024, 5);
  ctx.fillRect(0, 92, 1024, 4);
  ctx.fillStyle = '#ffffff';
  ctx.font = FA_FONT(58);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, 512, 62, 960);
  ctx.shadowBlur = 0;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  labelTexCache.set(key, t);
  return t;
}

/** سایه‌بان مغازه — راه‌راه دو رنگ (خیلی ایرانی!) */
export function getAwningTexture(color: string): THREE.CanvasTexture {
  const key = `aw_${color}`;
  const cached = labelTexCache.get(key);
  if (cached) return cached;
  const { c, ctx } = makeCanvas(256, 64);
  ctx.fillStyle = '#fff6e8';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = color;
  for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 32, 64);
  // سایه ملایم پایین
  const g = ctx.createLinearGradient(0, 40, 0, 64);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 40, 256, 24);
  const t = toTex(c);
  labelTexCache.set(key, t);
  return t;
}

// ==================== 🔑 v0.2.48 — نمای ساختمان‌های باکیفیت (پنجره + نور داخلی) ====================
// درخواست کاربر: «الگوی ساختمان‌های باکیفیت که پنجره و نور داخلی دارن روی همهٔ ساختمان‌ها،
// ولی مقداری متفاوت باشن، همه شبیه هم نباشن»
// هر (نوع، واریانس) یک نمای متمایز: پالت + تعداد ستون پنجره + الگوی بالکن + کولر + روشنایی اتاق‌ها
// روشنایی داخلی = emissiveMap جدا (پنجره‌های روشن واقعاً می‌درخشند).

interface BuildingFacadePair {
  color: THREE.CanvasTexture;
  emissive: THREE.CanvasTexture;
  material: THREE.MeshStandardMaterial;
}

const buildingFacadeCache = new Map<string, BuildingFacadePair>();

/** مولد عدد شبه‌تصادفی قطعی از seed (برای تکرارپذیری هر واریانس) */
function facadeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** پالت‌های نمای ایرانی — هر واریانس یکی */
const FACADE_PALETTES: Array<{ wall: string; wall2: string; trim: string; glass: string; accent: string }> = [
  { wall: '#e8dcc2', wall2: '#d9caa8', trim: '#b06a4a', glass: '#4d6a7d', accent: '#9a4a3a' }, // کرم + آجری
  { wall: '#d97f5e', wall2: '#c46e4e', trim: '#8f4a34', glass: '#3d5666', accent: '#6e3a2a' }, // آجری تهران
  { wall: '#e3e6e2', wall2: '#cfd4cf', trim: '#8f9a94', glass: '#42586b', accent: '#5d6d7e' }, // بتنی روشن
  { wall: '#f0d9a8', wall2: '#e0c48e', trim: '#b98a3e', glass: '#4a6273', accent: '#c9762e' }, // اُخرایی
  { wall: '#bcd3cf', wall2: '#a8c0bb', trim: '#6f8f8a', glass: '#3c5666', accent: '#4a7d76' }, // فیروزه‌ای ملایم
  { wall: '#e8c9c0', wall2: '#d9b3a8', trim: '#a86a5e', glass: '#4d5f6e', accent: '#b05a4a' }, // گلبهی
  { wall: '#c9d4e0', wall2: '#b3c1d0', trim: '#7d8fa5', glass: '#3a4f63', accent: '#4a6d8f' }, // آبی خاکستری
  { wall: '#ded6c2', wall2: '#c9bfa8', trim: '#94876a', glass: '#45585f', accent: '#7d6f4e' }, // شنی
];

/** نام‌های تابلو برای طبقهٔ همکف مغازه‌ها */
const FACADE_SHOP_SIGNS = ['سوپرمارکت', 'قهوه‌خانه', 'خیاطی', 'میوه‌فروشی', 'آهنگری', 'قنادی', 'لوازم یدکی', 'نانایی'];

/**
 * نمای کامل یک ساختمان — canvas 512×704:
 * از پایین: همکف (در/ویترین/کرکره) → طبقات با پنجره (روشن/خاموش) → نوار بام.
 * خروجی: تکسچر رنگ + تکسچر emissive (نور داخلی) + متریال آماده.
 */
export function getBuildingFacade(type: 'apartment' | 'shop' | 'home' | 'garage', variance: number, floors: number): BuildingFacadePair {
  const v = ((variance % 6) + 6) % 6;
  const key = `${type}_${v}_${floors}`;
  const cached = buildingFacadeCache.get(key);
  if (cached) return cached;

  const rng = facadeRng((type.charCodeAt(0) * 97 + v * 131 + floors * 7) | 0);
  const pal = FACADE_PALETTES[(v + type.charCodeAt(0)) % FACADE_PALETTES.length];
  const CW = 512;
  const CH = 704;
  const { c, ctx } = makeCanvas(CW, CH);
  const { c: ec, ctx: ectx } = makeCanvas(CW, CH);

  // ---------- پس‌زمینه دیوار + لکه‌های عمر ----------
  ctx.fillStyle = pal.wall;
  ctx.fillRect(0, 0, CW, CH);
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, CW, CH);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(${rng() > 0.5 ? '255,255,255' : '60,50,40'},${0.02 + rng() * 0.045})`;
    const sw = 14 + rng() * 70;
    ctx.fillRect(rng() * CW, rng() * CH, sw, 8 + rng() * 30);
  }
  // خطوط افقی بین طبقات
  const groundH = type === 'garage' ? CH * 0.52 : CH * 0.24;
  const upperH = CH - groundH - 26;
  const floorH = upperH / Math.max(1, floors);
  ctx.fillStyle = pal.wall2;
  for (let f = 0; f <= floors; f++) ctx.fillRect(0, CH - 26 - floorH * f - 5, CW, 6);

  // ---------- پنجره‌ها ----------
  const cols = 4 + (v % 3); // ۴..۶ ستون — هر واریانس متفاوت
  const winW = CW / cols;
  const margin = winW * 0.24;
  const ww = winW - margin * 2;
  const wh = Math.min(floorH * 0.5, 64);
  const litChance = 0.22 + rng() * 0.2; // نسبت اتاق‌های روشن هر ساختمان متفاوت
  const hasBalcony = type === 'apartment' && v % 3 !== 2;
  const hasAC = type !== 'garage';

  const drawWindow = (x: number, y: number, w: number, h: number, lit: number, withBalcony: boolean, withAC: boolean): void => {
    // قاب
    ctx.fillStyle = pal.trim;
    ctx.fillRect(x - 5, y - 5, w + 10, h + 10);
    // شیشه
    if (lit > 0) {
      // نور داخلی — روی رنگ + روی emissive
      const warm = lit > 0.66 ? '#ffd98a' : lit > 0.33 ? '#ffbe63' : '#d8e9ff';
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, warm);
      g.addColorStop(1, lit > 0.5 ? '#e8a84e' : '#a8c4e0');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // هاله روی emissive
      ectx.save();
      ectx.shadowColor = warm;
      ectx.shadowBlur = 18;
      ectx.fillStyle = warm;
      ectx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ectx.restore();
      // سیاهی ساکنین (سایه پشت پرده)
      ctx.fillStyle = 'rgba(90,50,20,0.25)';
      ctx.fillRect(x, y + h * 0.55, w * (0.3 + rng() * 0.5), h * 0.45);
    } else {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, pal.glass);
      g.addColorStop(0.5, '#6d8598');
      g.addColorStop(1, pal.glass);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // بازتاب آسمان
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.beginPath();
      ctx.moveTo(x + 3, y + h - 6);
      ctx.lineTo(x + w * 0.45, y + 3);
      ctx.lineTo(x + w * 0.62, y + 3);
      ctx.lineTo(x + w * 0.2, y + h - 6);
      ctx.closePath();
      ctx.fill();
    }
    // چارچوب داخلی
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + w / 2 - 1.5, y, 3, h);
    ctx.strokeRect(x, y + h / 2 - 1.5, w, 3);
    // دست‌انداز زیر پنجره
    ctx.fillStyle = pal.wall2;
    ctx.fillRect(x - 8, y + h + 5, w + 16, 7);
    // نرده بالکن
    if (withBalcony && rng() > 0.4) {
      ctx.fillStyle = 'rgba(45,38,32,0.85)';
      ctx.fillRect(x - w * 0.22, y + h + 12, w * 1.44, 5);
      for (let b = 0; b <= 6; b++) ctx.fillRect(x - w * 0.22 + (b * w * 1.44) / 6, y + h + 12, 3, 16);
      ctx.fillStyle = 'rgba(45,38,32,0.5)';
      ctx.fillRect(x - w * 0.22, y + h + 28, w * 1.44, 4);
    }
    // کولر روی دیوار
    if (withAC && rng() > 0.72) {
      const ax = x + w + margin * 0.15;
      const ay = y + h - 26;
      ctx.fillStyle = '#d8d5cc';
      ctx.fillRect(ax, ay, 22, 26);
      ctx.fillStyle = '#9a978e';
      for (let l = 0; l < 4; l++) ctx.fillRect(ax + 3, ay + 4 + l * 6, 16, 3);
    }
  };

  for (let f = 0; f < floors; f++) {
    const fy = CH - 26 - floorH * (f + 1) + (floorH - wh) * 0.34;
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const x = cIdx * winW + margin;
      const r = rng();
      const lit = r < litChance ? (rng() > 0.4 ? 1 : 0.5) : 0;
      drawWindow(x, fy, ww, wh, lit, hasBalcony && f % 2 === 1, hasAC);
    }
  }

  // ---------- همکف بر اساس نوع ----------
  const gy = CH - groundH;
  if (type === 'shop') {
    // ویترین بزرگ + در + نوار تابلو رنگی
    const signH = 34;
    ctx.fillStyle = pal.accent;
    ctx.fillRect(0, gy - signH, CW, signH);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(6, gy - signH + 5, CW - 12, signH - 10);
    ctx.fillStyle = pal.accent;
    ctx.font = 'bold 24px Vazirmatn, Tahoma, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(FACADE_SHOP_SIGNS[v % FACADE_SHOP_SIGNS.length], CW / 2, gy - 8, CW - 30);
    // ویترین شیشه‌ای
    const dispW = CW * 0.46;
    ctx.fillStyle = pal.trim;
    ctx.fillRect(CW * 0.06 - 6, gy + 12, dispW + 12, groundH - 30);
    const dg = ctx.createLinearGradient(CW * 0.06, gy, CW * 0.06 + dispW, gy + groundH);
    dg.addColorStop(0, '#9fc4d8');
    dg.addColorStop(1, '#6d93a8');
    ctx.fillStyle = dg;
    ctx.fillRect(CW * 0.06, gy + 18, dispW, groundH - 42);
    // اجناس داخل ویترین (طنز بصری)
    ctx.fillStyle = 'rgba(50,40,30,0.35)';
    for (let s = 0; s < 5; s++) ctx.fillRect(CW * 0.06 + 12 + s * dispW / 5.4, gy + groundH - 46, 20, 26);
    // در
    ctx.fillStyle = pal.accent;
    ctx.fillRect(CW * 0.66, gy + 12, CW * 0.16, groundH - 24);
    ctx.fillStyle = '#e8d9b8';
    ctx.fillRect(CW * 0.66 + 8, gy + 22, CW * 0.16 - 16, groundH - 48);
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(CW * 0.66 + 14, gy + groundH / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'garage') {
    // کرکره بزرگ با شیارهای افقی
    ctx.fillStyle = '#7d8489';
    ctx.fillRect(CW * 0.1, gy + 10, CW * 0.8, groundH - 22);
    ctx.fillStyle = '#666c70';
    for (let s = 0; s < Math.floor((groundH - 22) / 18); s++) {
      ctx.fillRect(CW * 0.1, gy + 10 + s * 18, CW * 0.8, 5);
    }
    ctx.fillStyle = '#4e5457';
    ctx.fillRect(CW * 0.1, gy + 10, CW * 0.8, 6);
  } else {
    // خانه/آپارتمان: در چوبی + سایبان + دو پنجره همکف
    ctx.fillStyle = pal.trim;
    ctx.fillRect(CW * 0.42 - 34, gy + 14, 68, groundH - 30);
    ctx.fillStyle = '#5d4a38';
    ctx.fillRect(CW * 0.42 - 27, gy + 21, 54, groundH - 44);
    ctx.fillStyle = '#c9b98a';
    ctx.beginPath();
    ctx.arc(CW * 0.42 + 17, gy + groundH / 2 + 4, 4, 0, Math.PI * 2);
    ctx.fill();
    // سایبان ورودی
    ctx.fillStyle = pal.accent;
    ctx.fillRect(CW * 0.42 - 48, gy + 4, 96, 10);
    drawWindow(CW * 0.08, gy + 24, CW * 0.18, wh, rng() < litChance ? 1 : 0, false, false);
    drawWindow(CW * 0.74, gy + 24, CW * 0.18, wh, rng() < litChance ? 1 : 0, false, false);
  }

  // ---------- نوار بام ----------
  ctx.fillStyle = pal.wall2;
  ctx.fillRect(0, 0, CW, 26);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 22, CW, 4);

  const colorTex = toTex(c);
  const emissiveTex = toTex(ec);
  const material = new THREE.MeshStandardMaterial({
    map: colorTex,
    emissiveMap: emissiveTex,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.85,
    roughness: 0.86,
    metalness: 0.04,
  });
  const pair: BuildingFacadePair = { color: colorTex, emissive: emissiveTex, material };
  buildingFacadeCache.set(key, pair);
  return pair;
}
