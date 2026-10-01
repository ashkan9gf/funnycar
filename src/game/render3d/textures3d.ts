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

/** خطوط ترک آسفالت (پلی‌لاین‌های باریک تیره) */
function drawCracks(ctx: CanvasRenderingContext2D, w: number, h: number, count: number): void {
  for (let i = 0; i < count; i++) {
    let x = Math.random() * w;
    let y = Math.random() * h;
    ctx.strokeStyle = 'rgba(20,18,16,0.30)';
    ctx.lineWidth = 1 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 4 + Math.floor(Math.random() * 5);
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * 42;
      y += (Math.random() - 0.5) * 42;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** وصله آسفالت (مستطیل تیره‌تر — تعمیر جاده‌های ایران!) */
function drawPatches(ctx: CanvasRenderingContext2D, w: number, h: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const pw = 26 + Math.random() * 40;
    const ph = 18 + Math.random() * 34;
    const px = Math.random() * (w - pw);
    const py = Math.random() * (h - ph);
    ctx.fillStyle = 'rgba(30,28,26,0.22)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(15,13,11,0.28)';
    ctx.lineWidth = 2;
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
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  // آسفالت پایه
  ctx.fillStyle = '#58585c';
  ctx.fillRect(0, 0, S, S);
  // نویز دو رنگ
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(Math.random() * S, Math.random() * S, 2 + Math.random() * 5, 2 + Math.random() * 4);
  }
  drawCracks(ctx, S, S, 14);
  drawPatches(ctx, S, S, 3);

  // منهول (دایره تیره با حلقه)
  const mx = 100, my = 170;
  ctx.fillStyle = '#3c3a38';
  ctx.beginPath(); ctx.arc(mx, my, 17, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(200,200,190,0.4)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(mx, my, 17, 0, Math.PI * 2); ctx.stroke();

  // خط دوگانه زرد وسط (تفکیک دو جهت — دوطرفه!)
  ctx.fillStyle = 'rgba(226,190,80,0.85)';
  ctx.fillRect(S / 2 - 9, 0, 6, S);
  ctx.fillRect(S / 2 + 3, 0, 6, S);

  // خط‌چین سفید بین لاین داخلی/بیرونی هر جهت (±130px از مرکز → ±119 در بافت)
  ctx.fillStyle = 'rgba(245,245,240,0.8)';
  for (const lx of [137, 375]) {
    for (let y = 20; y < S; y += 120) {
      ctx.fillRect(lx - 4, y, 8, 84);
    }
  }

  // لبه‌های زرد کم‌رنگ و ساییده
  ctx.fillStyle = 'rgba(226,190,80,0.55)';
  ctx.fillRect(10, 0, 7, S);
  ctx.fillRect(S - 17, 0, 7, S);
  // کثیفی لبه جاده
  ctx.fillStyle = 'rgba(40,36,30,0.14)';
  ctx.fillRect(0, 0, 12, S);
  ctx.fillRect(S - 12, 0, 12, S);

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
  const { c, ctx } = makeCanvas(192, 64);
  ctx.fillStyle = '#2a6db5';
  ctx.fillRect(0, 0, 192, 64);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 184, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = FA_FONT(26);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 96, 34);
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
 * خروجی: [side, side, top, bottom, side, side] برای متریال آرایه‌ای BoxGeometry
 */
export function getFacadeTextures(assetId: string, signOverride?: string): THREE.CanvasTexture[] {
  // فاز IR-SIGNS: هر متن تابلو نسخه بافت خودش را دارد (کش بر اساس assetId + متن)
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
  let tiledPlinth = false; // فاز LUX-FACADE: نوار کاشی فیروزه‌ای زیر تابلو

  switch (assetId) {
    case 'env_building_home_01':
      wall = '#e8dcc2'; trim = '#b06a4a'; winBg = '#a8cbe0';
      brick = true; // طبقه همکف آجر
      break;
    case 'env_building_shop_01':
      wall = '#f2c98c'; trim = '#c98d4b'; winBg = '#b8d8e8';
      awning = '#e2574c';
      tiledPlinth = true;
      signText = signOverride ?? 'سوپرمارکت'; // فاز IR-SIGNS: تنوع مغازه‌ها
      break;
    case 'env_building_garage_01':
      wall = '#c4c0b8'; trim = '#8f8f8a'; winBg = '#7f96a8';
      doorColor = '#5f6a75';
      signText = 'تعمیرگاه';
      break;
    case 'env_building_apartment_01':
      // آپارتمان مدرن شمال تهران — شیشه‌ای با نوارهای افقی
      wall = '#dde3e8'; trim = '#9fb2c0'; winBg = '#7fb3d5';
      tiledPlinth = true;
      break;
    default:
      wall = '#e7d9b8'; trim = '#c9b98a'; winBg = '#9fc4d8';
  }

  // ---------- فاز LUX-FACADE: RNG قطعی بر اساس کلید (هیچ Math.random) ----------
  let seed = 0;
  for (let i = 0; i < cacheKey.length; i++) seed = (seed * 31 + cacheKey.charCodeAt(i)) >>> 0;
  const rf = (n: number): number => {
    let x = (seed ^ Math.imul(n + 1, 2654435761)) >>> 0;
    x ^= x >>> 13; x = Math.imul(x, 1274126177) >>> 0; x ^= x >>> 16;
    return x / 4294967296;
  };

  // --- وجه طبقات ۵۱۲px: پنجره متنوع + کولر + لبه + جان‌پناه + کثیفی دیوار ---
  const { c: face, ctx: fx } = makeCanvas(512, 512);
  fx.fillStyle = wall;
  fx.fillRect(0, 0, 512, 512);
  // واترینگ عمودی: بالا روشن، پایین کثیف‌تر
  const wg = fx.createLinearGradient(0, 0, 0, 512);
  wg.addColorStop(0, 'rgba(255,255,255,0.12)');
  wg.addColorStop(0.7, 'rgba(0,0,0,0)');
  wg.addColorStop(1, 'rgba(40,30,20,0.16)');
  fx.fillStyle = wg;
  fx.fillRect(0, 0, 512, 512);
  // نویز دیوار
  for (let i = 0; i < 300; i++) {
    fx.fillStyle = rf(i) > 0.5 ? 'rgba(255,255,255,0.05)' : `rgba(30,22,14,${0.02 + rf(i + 900) * 0.05})`;
    fx.fillRect(Math.floor(rf(i + 100) * 512), Math.floor(rf(i + 200) * 512), 3, 3);
  }
  // جان‌پناه بالا + لبه روشن
  fx.fillStyle = 'rgba(0,0,0,0.13)';
  fx.fillRect(0, 0, 512, 26);
  fx.fillStyle = 'rgba(255,255,255,0.22)';
  fx.fillRect(0, 26, 512, 5);
  // کمربند طبقات (خط افقی بین طبقه‌ها)
  for (let j = 1; j < 4; j++) {
    fx.fillStyle = 'rgba(0,0,0,0.10)';
    fx.fillRect(0, j * 128 - 4, 512, 8);
    fx.fillStyle = 'rgba(255,255,255,0.14)';
    fx.fillRect(0, j * 128 - 4, 512, 2);
  }
  // پنجره‌ها ۴ ستون × ۳ ردیف — تنوع: روشن/پرده/شیشه/تاریک + کولر + لبه
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      const wx = 32 + i * 128;
      const wy = 44 + j * 128;
      const pw = 64;
      const ph = 76;
      const v = rf(i * 17 + j * 7 + 1);
      // سایه کلی پنجره
      fx.fillStyle = 'rgba(0,0,0,0.20)';
      fx.fillRect(wx + 4, wy + 5, pw, ph);
      // شیشه
      if (v < 0.12) {
        // پنجره روشن گرم — زندگی پشت شیشه
        const lg = fx.createLinearGradient(wx, wy, wx, wy + ph);
        lg.addColorStop(0, '#ffefc0');
        lg.addColorStop(1, '#f0c268');
        fx.fillStyle = lg;
        fx.fillRect(wx, wy, pw, ph);
        fx.fillStyle = 'rgba(60,40,20,0.35)'; // سیلوئت پرده
        fx.fillRect(wx + 6, wy + 26, pw - 12, 8);
      } else if (v < 0.3) {
        // پرده‌ای — نیمه روشن
        fx.fillStyle = winBg;
        fx.fillRect(wx, wy, pw, ph);
        fx.fillStyle = 'rgba(255,252,240,0.72)';
        fx.fillRect(wx + 4, wy + 4, pw / 2 - 4, ph - 8);
        fx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let c2 = 0; c2 < 3; c2++) fx.fillRect(wx + 8 + c2 * 14, wy + 6, 6, ph - 12);
      } else if (v < 0.88) {
        // شیشه آسمان — گرادیان + بازتاب مورب
        const sg2 = fx.createLinearGradient(wx, wy, wx, wy + ph);
        sg2.addColorStop(0, '#cfe6f2');
        sg2.addColorStop(0.5, winBg);
        sg2.addColorStop(1, '#7d9db5');
        fx.fillStyle = sg2;
        fx.fillRect(wx, wy, pw, ph);
        fx.fillStyle = 'rgba(255,255,255,0.4)';
        fx.beginPath();
        fx.moveTo(wx + 6, wy + ph - 8);
        fx.lineTo(wx + pw - 22, wy + 6);
        fx.lineTo(wx + pw - 8, wy + 6);
        fx.lineTo(wx + 18, wy + ph - 8);
        fx.closePath();
        fx.fill();
      } else {
        // تاریک
        fx.fillStyle = '#3a4550';
        fx.fillRect(wx, wy, pw, ph);
        fx.fillStyle = 'rgba(255,255,255,0.12)';
        fx.fillRect(wx + 4, wy + 4, pw - 24, 12);
      }
      // قاب + لبه پنجره (sill)
      fx.strokeStyle = trim;
      fx.lineWidth = 6;
      fx.strokeRect(wx, wy, pw, ph);
      fx.fillStyle = 'rgba(255,255,255,0.55)';
      fx.fillRect(wx - 7, wy + ph, pw + 14, 7); // تخته لبه
      fx.fillStyle = 'rgba(0,0,0,0.22)';
      fx.fillRect(wx - 7, wy + ph + 7, pw + 14, 5); // سایه لبه
      // کولر آبی گازی زیر بعضی پنجره‌ها
      if (rf(i * 31 + j * 13 + 2) < 0.22) {
        const ax = wx + pw - 40;
        const ay = wy + ph + 14;
        fx.fillStyle = '#b9bcbe';
        fx.fillRect(ax, ay, 34, 24);
        fx.fillStyle = 'rgba(0,0,0,0.28)';
        for (let l = 0; l < 3; l++) fx.fillRect(ax + 5, ay + 5 + l * 7, 24, 3);
        fx.strokeStyle = 'rgba(0,0,0,0.3)';
        fx.lineWidth = 2;
        fx.strokeRect(ax, ay, 34, 24);
      }
      // نرده بالکن دو ردیف بالا
      if (j < 2) {
        fx.strokeStyle = 'rgba(50,44,40,0.75)';
        fx.lineWidth = 4;
        fx.beginPath();
        fx.moveTo(wx - 10, wy + ph + 30);
        fx.lineTo(wx + pw + 10, wy + ph + 30);
        fx.stroke();
        for (let b = 0; b <= 5; b++) {
          const bx2 = wx - 10 + (b * (pw + 20)) / 5;
          fx.beginPath(); fx.moveTo(bx2, wy + ph + 10); fx.lineTo(bx2, wy + ph + 30); fx.stroke();
        }
      }
    }
  }
  // پایه تیره زیر نمای طبقات
  fx.fillStyle = 'rgba(30,22,16,0.25)';
  fx.fillRect(0, 486, 512, 26);

  // --- وجه همکف ۵۱۲px ---
  const { c: groundF, ctx: gx } = makeCanvas(512, 512);
  gx.fillStyle = wall;
  gx.fillRect(0, 0, 512, 512);
  const gg = gx.createLinearGradient(0, 256, 0, 512);
  gg.addColorStop(0, 'rgba(0,0,0,0)');
  gg.addColorStop(1, 'rgba(30,22,14,0.2)');
  gx.fillStyle = gg;
  gx.fillRect(0, 256, 512, 256);
  if (brick) {
    // آجرچینی ایرانی بهتر: رنگ هر آجر کمی متفاوت + ملات روشن
    gx.fillStyle = '#d9cbb2';
    gx.fillRect(0, 224, 512, 288);
    const bh = 22;
    const bw = 62;
    for (let row = 0; row < 13; row++) {
      const y = 228 + row * (bh + 3);
      const off = row % 2 === 0 ? 0 : bw / 2;
      for (let bx3 = -bw; bx3 < 512 + bw; bx3 += bw + 3) {
        const tint = rf(row * 53 + bx3 + 3);
        const r2 = 158 + Math.floor(tint * 26);
        const g2 = 84 + Math.floor(tint * 18);
        const b2 = 60 + Math.floor(tint * 14);
        gx.fillStyle = `rgb(${r2},${g2},${b2})`;
        gx.fillRect(bx3 + off, y, bw, bh);
        gx.fillStyle = 'rgba(255,255,255,0.10)';
        gx.fillRect(bx3 + off, y, bw, 3);
      }
    }
  }
  if (signText) {
    // تابلوی فارسی بزرگ با قاب دوخطه + خط نور زیر تابلو
    let sh = 0;
    for (let si = 0; si < signText.length; si++) sh = (sh * 31 + signText.charCodeAt(si)) >>> 0;
    const BOARD = ['#3a2e2a', '#22577a', '#7a3b2e', '#3f5e2e', '#5b3a6e', '#8a5a1f'];
    const boardC = BOARD[sh % BOARD.length];
    gx.fillStyle = 'rgba(0,0,0,0.25)';
    gx.fillRect(28, 122, 456, 96);
    gx.fillStyle = boardC;
    gx.fillRect(22, 114, 456, 96);
    gx.strokeStyle = '#F2D48A';
    gx.lineWidth = 5;
    gx.strokeRect(22, 114, 456, 96);
    gx.strokeStyle = 'rgba(255,255,255,0.35)';
    gx.lineWidth = 2;
    gx.strokeRect(32, 124, 436, 76);
    gx.fillStyle = '#FFF9EC';
    gx.font = FA_FONT(signText.length > 10 ? 40 : 48);
    gx.textAlign = 'center';
    gx.textBaseline = 'middle';
    gx.fillText(signText, 250, 164);
    // خط نور گرم زیر تابلو
    gx.fillStyle = 'rgba(255,224,150,0.5)';
    gx.fillRect(30, 214, 440, 6);
  }
  if (awning) {
    // آویز راه‌راه با لبه موجی + ویترین
    gx.fillStyle = awning;
    gx.fillRect(0, 246, 512, 42);
    gx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 8; i++) gx.fillRect(i * 64 + 8, 246, 32, 42);
    gx.fillStyle = awning;
    for (let i = 0; i < 8; i++) {
      gx.beginPath();
      gx.arc(i * 64 + 40, 288, 16, 0, Math.PI);
      gx.fill();
    }
    gx.fillStyle = 'rgba(0,0,0,0.18)';
    gx.fillRect(0, 292, 512, 8);
    // ویترین بزرگ دولبه با بازتاب
    for (const sx of [40, 300]) {
      gx.fillStyle = 'rgba(0,0,0,0.2)';
      gx.fillRect(sx + 6, 316, 172, 130);
      const dg = gx.createLinearGradient(sx, 310, sx, 446);
      dg.addColorStop(0, '#dceef8');
      dg.addColorStop(1, winBg);
      gx.fillStyle = dg;
      gx.fillRect(sx, 310, 172, 130);
      gx.fillStyle = 'rgba(255,255,255,0.45)';
      gx.beginPath();
      gx.moveTo(sx + 14, 434);
      gx.lineTo(sx + 110, 320);
      gx.lineTo(sx + 140, 320);
      gx.lineTo(sx + 44, 434);
      gx.closePath();
      gx.fill();
      gx.strokeStyle = trim;
      gx.lineWidth = 8;
      gx.strokeRect(sx, 310, 172, 130);
    }
    // در وسط با دستگیره
    gx.fillStyle = doorColor;
    gx.fillRect(232, 316, 48, 130);
    gx.strokeStyle = trim;
    gx.lineWidth = 6;
    gx.strokeRect(232, 316, 48, 130);
    gx.fillStyle = '#F2D48A';
    gx.beginPath(); gx.arc(268, 384, 5, 0, Math.PI * 2); gx.fill();
  } else if (assetId === 'env_building_garage_01') {
    // در بزرگ گاراژ
    gx.fillStyle = doorColor;
    gx.fillRect(56, 300, 400, 184);
    gx.strokeStyle = 'rgba(0,0,0,0.28)';
    gx.lineWidth = 5;
    for (let i = 1; i < 5; i++) {
      gx.beginPath(); gx.moveTo(56, 300 + i * 36); gx.lineTo(456, 300 + i * 36); gx.stroke();
    }
    gx.strokeStyle = trim; gx.lineWidth = 8;
    gx.strokeRect(56, 300, 400, 184);
  } else {
    // در خانه + پنجره (روی آجر)
    gx.fillStyle = doorColor;
    gx.fillRect(300, 336, 128, 176);
    gx.strokeStyle = '#e8dcc2'; gx.lineWidth = 8;
    gx.strokeRect(300, 336, 128, 176);
    gx.fillStyle = '#F2D48A';
    gx.beginPath(); gx.arc(340, 424, 6, 0, Math.PI * 2); gx.fill();
    gx.fillStyle = 'rgba(0,0,0,0.2)';
    gx.fillRect(300, 470, 128, 8);
    gx.fillStyle = 'rgba(0,0,0,0.22)';
    gx.fillRect(72, 406, 146, 6);
    const hg = gx.createLinearGradient(72, 344, 72, 470);
    hg.addColorStop(0, '#cfe6f2');
    hg.addColorStop(1, winBg);
    gx.fillStyle = hg;
    gx.fillRect(72, 344, 146, 126);
    gx.fillStyle = 'rgba(255,255,255,0.4)';
    gx.beginPath();
    gx.moveTo(92, 464); gx.lineTo(160, 352); gx.lineTo(184, 352); gx.lineTo(116, 464);
    gx.closePath();
    gx.fill();
    gx.strokeStyle = '#e8dcc2'; gx.lineWidth = 8;
    gx.strokeRect(72, 344, 146, 126);
  }
  if (tiledPlinth && !awning) {
    // نوار کاشی فیروزه‌ای زیر همکف (کاشی‌کاری ایرانی)
    gx.fillStyle = '#2e8b8b';
    gx.fillRect(0, 486, 512, 26);
    gx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 16; i++) gx.fillRect(i * 32 + 4, 490, 24, 18);
  }

  // --- سقف ۱۲۸px: شنی + وصله + جان‌پناه ---
  const { c: roof, ctx: rx } = makeCanvas(128, 128);
  rx.fillStyle = '#b8ac92';
  rx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) {
    rx.fillStyle = rf(i + 400) > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    rx.fillRect(Math.floor(rf(i + 500) * 128), Math.floor(rf(i + 600) * 128), 3, 3);
  }
  rx.fillStyle = 'rgba(30,24,18,0.16)';
  rx.fillRect(18 + Math.floor(rf(1) * 60), 18 + Math.floor(rf(2) * 60), 34, 26);
  rx.fillStyle = 'rgba(0,0,0,0.16)';
  rx.fillRect(0, 0, 128, 10);
  rx.fillRect(0, 0, 10, 128);
  rx.fillRect(118, 0, 10, 128);
  rx.fillRect(0, 118, 128, 10);
  rx.fillStyle = 'rgba(255,255,255,0.18)';
  rx.fillRect(0, 10, 128, 3);

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
