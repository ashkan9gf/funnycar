/**
 * CarFactory3D.ts — کارخانه ماشین‌های ایرانی Low-Poly (فاز GTA-IR)
 * ============================================================
 * ماشین رو به -Z ساخته می‌شود (شمال = angle صفر قرارداد Vehicle).
 * چرخش در دنیا: group.rotation.y = -angle
 *
 * خودروهای ایرانی قابل‌تشخیص:
 *  - پراید (سایپا) — جعبه‌ای کوچک، همه‌جای ایران!
 *  - پژو ۴۰۵ — سدان بلند با کاپوت جلوبلند
 *  - سمند — بزرگ‌تر با جلوپنجره پهن
 *  - نیسان آبی (وانت Z24) — آیکون وانت‌های ایران
 *  - تیبا — هاچ‌بک کوچک
 *  - تاکسی زرد (۴۰۵) با علامت «تاکسی» روی سقف
 *  - پلیس — سمند سفید با نوار سبز + چراغ‌گردان
 *
 * جزئیات مشترک: پلاک ایرانی (نوار آبی + سفید)، آینه بغل، اگزوز، سپر.
 */

import * as THREE from 'three';
import { getPlateTexture, getTaxiSignTexture } from './textures3d';

export type CarVariant =
  | 'player' | 'pride' | 'peugeot405' | 'samand'
  | 'nissan' | 'tiba' | 'taxi' | 'police';

export interface CarModel3D {
  group: THREE.Group;
  /** چرخ‌ها برای انیمیشن چرخش (rotation.x با سرعت) */
  wheels: THREE.Mesh[];
  /** رنگ بدنه برای ذرات/جلوه‌ها */
  bodyColor: string;
}

// ---------- متریال‌های مشترک (ساخته یک‌بار) ----------
let glassMat: THREE.MeshLambertMaterial | null = null;
let tireMat: THREE.MeshLambertMaterial | null = null;
let hubMat: THREE.MeshLambertMaterial | null = null;
let darkMat: THREE.MeshLambertMaterial | null = null;
let chromeMat: THREE.MeshLambertMaterial | null = null;
let headMat: THREE.MeshBasicMaterial | null = null;
let tailMat: THREE.MeshBasicMaterial | null = null;
let plateMat: THREE.MeshLambertMaterial | null = null;
let taxiSignMat: THREE.MeshLambertMaterial | null = null;

let wheelGeo: THREE.CylinderGeometry | null = null;
let hubGeo: THREE.CylinderGeometry | null = null;
let plateGeo: THREE.BoxGeometry | null = null;

function ensureShared(): void {
  if (glassMat) return;
  glassMat = new THREE.MeshLambertMaterial({ color: '#25333f' });
  tireMat = new THREE.MeshLambertMaterial({ color: '#23211f' });
  hubMat = new THREE.MeshLambertMaterial({ color: '#c9c4ba' });
  darkMat = new THREE.MeshLambertMaterial({ color: '#3a2e2a' });
  chromeMat = new THREE.MeshLambertMaterial({ color: '#9aa2a8' });
  headMat = new THREE.MeshBasicMaterial({ color: '#fff3c2' });
  tailMat = new THREE.MeshBasicMaterial({ color: '#e2574c' });
  plateMat = new THREE.MeshLambertMaterial({ map: getPlateTexture() });
  taxiSignMat = new THREE.MeshLambertMaterial({ map: getTaxiSignTexture() });
  wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  wheelGeo.rotateZ(Math.PI / 2); // محور چرخش = X
  hubGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  hubGeo.rotateZ(Math.PI / 2);
  plateGeo = new THREE.BoxGeometry(1, 1, 1);
}

// ---------- پالت رنگ خیابان‌های ایران ----------
const COLORS = {
  pride: ['#f4f4f0', '#d9d9d4', '#3f7fd4', '#b03a2e', '#e8d9b0', '#7f8c8d', '#f4f4f0'],
  peugeot405: ['#f7f7f2', '#c8c8c4', '#5d6d7e', '#7b241c', '#34495e', '#f7f7f2'],
  samand: ['#bfc9ca', '#f2f3f4', '#424949', '#5d8aa8', '#f2f3f4'],
  tiba: ['#b03a2e', '#d5dbdb', '#f4f4f0', '#1a5276'],
};
function pickColor(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

// ---------- مشخصات بدنه هر خودرو (واحد: پیکسل منطقی) ----------
interface BodySpec {
  len: number;       // طول کامل
  wid: number;       // عرض
  bodyH: number;     // ارتفاع بدنه پایین
  wheelR: number;    // شعاع چرخ
  /** کابین: سهم کاپوت/کابین/صندوق از طول (جمع = ۱) */
  hoodFrac: number;
  cabFrac: number;
  trunkFrac: number;
  cabH: number;      // ارتفاع گلخانه (کابین شیشه‌ای)
  frontSlope: number; // شیب شیشه جلو (رادیان؛ بزرگ‌تر = خوابیده‌تر)
  rearSlope: number;  // شیب شیشه عقب (۰ = عمودی مثل پراید)
  grille: 'thin' | 'wide';
}

const SPECS: Record<CarVariant, BodySpec> = {
  // پراید: جعبه‌ای کوچک، شیشه عقب عمودی، کاپوت کوتاه
  player:      { len: 172, wid: 100, bodyH: 44, wheelR: 21, hoodFrac: 0.30, cabFrac: 0.42, trunkFrac: 0.28, cabH: 40, frontSlope: 0.42, rearSlope: 0.08, grille: 'thin' },
  pride:       { len: 172, wid: 100, bodyH: 44, wheelR: 21, hoodFrac: 0.30, cabFrac: 0.42, trunkFrac: 0.28, cabH: 40, frontSlope: 0.42, rearSlope: 0.08, grille: 'thin' },
  // پژو ۴۰۵: کاپوت بلند جلوبلند، شیشه‌های خوابیده
  peugeot405:  { len: 196, wid: 106, bodyH: 48, wheelR: 23, hoodFrac: 0.36, cabFrac: 0.38, trunkFrac: 0.26, cabH: 42, frontSlope: 0.50, rearSlope: 0.34, grille: 'thin' },
  // تاکسی = شکل ۴۰۵
  taxi:        { len: 196, wid: 106, bodyH: 48, wheelR: 23, hoodFrac: 0.36, cabFrac: 0.38, trunkFrac: 0.26, cabH: 42, frontSlope: 0.50, rearSlope: 0.34, grille: 'thin' },
  // سمند: پهن و بلند با جلوپنجره بزرگ
  samand:      { len: 206, wid: 112, bodyH: 52, wheelR: 24, hoodFrac: 0.34, cabFrac: 0.38, trunkFrac: 0.28, cabH: 46, frontSlope: 0.46, rearSlope: 0.30, grille: 'wide' },
  police:      { len: 206, wid: 112, bodyH: 52, wheelR: 24, hoodFrac: 0.34, cabFrac: 0.38, trunkFrac: 0.28, cabH: 46, frontSlope: 0.46, rearSlope: 0.30, grille: 'wide' },
  // نیسان آبی: وانت — کابین جلو، بدنه بار باز
  nissan:      { len: 200, wid: 112, bodyH: 56, wheelR: 26, hoodFrac: 0.28, cabFrac: 0.30, trunkFrac: 0.42, cabH: 48, frontSlope: 0.38, rearSlope: 0.10, grille: 'wide' },
  // تیبا: هاچ‌بک کوچک با عقب مایل
  tiba:        { len: 168, wid: 100, bodyH: 46, wheelR: 22, hoodFrac: 0.32, cabFrac: 0.44, trunkFrac: 0.24, cabH: 42, frontSlope: 0.44, rearSlope: 0.46, grille: 'thin' },
};

/**
 * ساخت گلخانه (کابین شیشه‌ای) با شیب جلو/عقب
 * ز = مرکز کابین روی محور طول، topY = سطح بالای بدنه
 */
function buildGreenhouse(
  g: THREE.Group, spec: BodySpec, bodyTopY: number,
  cabLen: number, roofMat: THREE.MeshLambertMaterial,
): number {
  const cabW = spec.wid * 0.78;
  const glass = glassMat as THREE.MeshLambertMaterial;

  // شیشه‌های جلو و عقب (بکس‌های کج)
  const th = 7;
  const front = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.96, spec.cabH, th), glass);
  front.position.set(0, bodyTopY + spec.cabH / 2 - 2, -cabLen / 2);
  front.rotation.x = spec.frontSlope;
  front.castShadow = true;
  const rear = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.96, spec.cabH, th), glass);
  rear.position.set(0, bodyTopY + spec.cabH / 2 - 2, cabLen / 2);
  rear.rotation.x = -spec.rearSlope;
  rear.castShadow = true;

  // شیشه‌های کنار (بکس شیشه‌ای بین دو شیشه)
  const sides = new THREE.Mesh(new THREE.BoxGeometry(cabW, spec.cabH * 0.82, cabLen * 0.9), glass);
  sides.position.set(0, bodyTopY + spec.cabH * 0.5, 0);

  // ستون‌های تیره لبه سقف (حس اسکلتی — سبک GTA کارتونی)
  const pillarMat = roofMat;
  const pillarGeo = new THREE.BoxGeometry(cabW * 1.02, spec.cabH * 0.16, 8);
  for (const zz of [-cabLen / 2 + 2, cabLen / 2 - 2]) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(0, bodyTopY + spec.cabH - 4, zz);
    g.add(p);
  }

  // سقف
  const roofTh = 7;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cabW * 1.04, roofTh, cabLen * 0.92), roofMat);
  roof.position.set(0, bodyTopY + spec.cabH, 0);
  roof.castShadow = true;

  g.add(front, rear, sides, roof);
  return bodyTopY + spec.cabH; // سطح بالای سقف
}

// ---------- ساخت ماشین ----------
export function buildCar3D(variant: CarVariant, _W: number, L: number): CarModel3D {
  ensureShared();
  const spec = SPECS[variant] ?? SPECS.pride;

  // رنگ بدنه بر اساس واریانت
  let body = '#f4f4f0';
  if (variant === 'pride' || variant === 'tiba' || variant === 'peugeot405' || variant === 'samand') {
    body = pickColor(COLORS[variant]);
  } else if (variant === 'taxi') body = '#f2c230';
  else if (variant === 'police') body = '#f7f7f2';
  else if (variant === 'nissan') body = '#2f6fae'; // نیسان آبی معروف!

  const bodyMat = new THREE.MeshLambertMaterial({ color: body });
  const roofMat = new THREE.MeshLambertMaterial({ color: body });
  const accentMat = new THREE.MeshLambertMaterial({ color: '#3a2e2a' });

  const g = new THREE.Group();
  const s = spec;
  const bodyTopY = s.wheelR * 0.75 + s.bodyH;

  // ---------- بدنه پایین ----------
  const lower = new THREE.Mesh(new THREE.BoxGeometry(s.wid, s.bodyH, s.len), bodyMat);
  lower.position.y = s.wheelR * 0.75 + s.bodyH / 2;
  lower.castShadow = true;
  g.add(lower);

  // ---------- گلخانه / بدنه بار ----------
  let topY = bodyTopY;
  if (variant === 'nissan') {
    // وانت نیسان: کابین + دیواره‌های بدنه بار باز
    const cabLen = s.len * s.cabFrac;
    const cabZ = -s.len / 2 + s.len * s.hoodFrac + cabLen / 2;
    const cab = new THREE.Group();
    const gh = new THREE.Group();
    const cabinTop = buildGreenhouseInner(gh, s, bodyTopY, cabLen, roofMat);
    cab.add(gh);
    cab.position.z = cabZ;
    g.add(cab);

    // بدنه بار باز (سه دیواره)
    const bedLen = s.len * s.trunkFrac - 6;
    const bedZ = s.len / 2 - s.len * s.trunkFrac / 2;
    const wallH = s.bodyH * 0.62;
    const wallTh = 7;
    const bedMat = new THREE.MeshLambertMaterial({ color: body });
    const back = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.96, wallH, wallTh), bedMat);
    back.position.set(0, bodyTopY + wallH / 2, bedZ + bedLen / 2);
    back.castShadow = true;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.92, 5, bedLen), darkMat as THREE.MeshLambertMaterial);
    floor.position.set(0, bodyTopY + 3, bedZ);
    for (const sx of [-s.wid * 0.44, s.wid * 0.44]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(wallTh, wallH, bedLen), bedMat);
      side.position.set(sx, bodyTopY + wallH / 2, bedZ);
      side.castShadow = true;
      g.add(side);
    }
    g.add(back, floor);
    topY = cabinTop;
  } else {
    // سدان/هاچ‌بک: کاپوت + کابین + صندوق
    const hoodLen = s.len * s.hoodFrac;
    const cabLen = s.len * s.cabFrac;
    const trunkLen = s.len * s.trunkFrac;

    // کاپوت (پله پایین‌تر از شانه بدنه — پراید جعبه‌ای است، بقیه شیب ملایم)
    const hoodDrop = variant === 'pride' || variant === 'player' ? 0 : s.bodyH * 0.10;
    const hood = new THREE.Mesh(
      new THREE.BoxGeometry(s.wid * 0.94, s.bodyH - hoodDrop, hoodLen),
      bodyMat,
    );
    hood.position.set(0, s.wheelR * 0.75 + (s.bodyH - hoodDrop) / 2, -s.len / 2 + hoodLen / 2);
    hood.castShadow = true;
    g.add(hood);

    const gh = new THREE.Group();
    topY = buildGreenhouse(gh, s, bodyTopY, cabLen, roofMat);
    gh.position.z = -s.len / 2 + hoodLen + cabLen / 2;
    g.add(gh);

    // صندوق (پراید/نیسان هم‌سطح بدنه؛ ۴۰۵/سمند/تیبا یک پله پایین‌تر)
    const trunkDrop = variant === 'tiba' ? s.bodyH * 0.26 : s.bodyH * 0.12;
    const trunk = new THREE.Mesh(
      new THREE.BoxGeometry(s.wid * 0.94, s.bodyH - trunkDrop, trunkLen),
      bodyMat,
    );
    trunk.position.set(0, s.wheelR * 0.75 + (s.bodyH - trunkDrop) / 2, s.len / 2 - trunkLen / 2);
    trunk.castShadow = true;
    g.add(trunk);
  }

  // ---------- سپرها ----------
  const bumperGeo = new THREE.BoxGeometry(s.wid * 0.98, s.bodyH * 0.4, s.len * 0.05);
  for (const zz of [-s.len / 2 - s.len * 0.012, s.len / 2 + s.len * 0.012]) {
    const b = new THREE.Mesh(bumperGeo, darkMat as THREE.MeshLambertMaterial);
    b.position.set(0, s.wheelR * 0.75 + s.bodyH * 0.18, zz);
    b.castShadow = true;
    g.add(b);
  }

  // ---------- جلوپنجره ----------
  const grilleH = s.bodyH * 0.28;
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(s.wid * (s.grille === 'wide' ? 0.62 : 0.44), grilleH, 5),
    darkMat as THREE.MeshLambertMaterial,
  );
  grille.position.set(0, bodyTopY - grilleH * 0.9, -s.len / 2 - 2);
  g.add(grille);

  // ---------- چراغ‌ها ----------
  const lightGeo = new THREE.BoxGeometry(s.wid * 0.20, s.bodyH * 0.22, 4);
  for (const x of [-s.wid * 0.34, s.wid * 0.34]) {
    const h = new THREE.Mesh(lightGeo, headMat as THREE.MeshBasicMaterial);
    h.position.set(x, bodyTopY - s.bodyH * 0.16, -s.len / 2 - 1);
    const t = new THREE.Mesh(lightGeo, tailMat as THREE.MeshBasicMaterial);
    t.position.set(x, bodyTopY - s.bodyH * 0.16, s.len / 2 + 1);
    g.add(h, t);
  }

  // ---------- پلاک ایرانی (جلو و عقب) ----------
  const plateScale = s.wid * 0.34;
  for (const zz of [-s.len / 2 - s.len * 0.03, s.len / 2 + s.len * 0.03]) {
    const p = new THREE.Mesh(plateGeo as THREE.BoxGeometry, plateMat as THREE.MeshLambertMaterial);
    p.scale.set(plateScale, plateScale * 0.32, 2);
    p.position.set(0, s.wheelR * 0.75 + s.bodyH * 0.16, zz);
    g.add(p);
  }

  // ---------- آینه بغل ----------
  const mirrorGeo = new THREE.BoxGeometry(9, 6, 7);
  for (const x of [-s.wid / 2 - 4, s.wid / 2 + 4]) {
    const m = new THREE.Mesh(mirrorGeo, darkMat as THREE.MeshLambertMaterial);
    m.position.set(x, bodyTopY + 2, -s.len * s.hoodFrac + s.len * 0.06);
    g.add(m);
  }

  // ---------- اگزوز ----------
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 12, 8), chromeMat as THREE.MeshLambertMaterial);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(s.wid * 0.28, s.wheelR * 0.55, s.len / 2 + 4);
  g.add(exhaust);

  // ---------- واریانت‌های خاص ----------
  if (variant === 'taxi') {
    // علامت «تاکسی» روی سقف
    const sign = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.34, 16, 26), taxiSignMat as THREE.MeshLambertMaterial);
    sign.position.set(0, topY + 9, 0);
    g.add(sign);
    // آنتن
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 34, 6), darkMat as THREE.MeshLambertMaterial);
    ant.position.set(-s.wid * 0.3, topY + 16, s.len * 0.1);
    g.add(ant);
  } else if (variant === 'police') {
    // نوار سبز پلیس ایران + چراغ‌گردان
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 1.02, s.bodyH * 0.26, s.len * 0.5), accentMat);
    stripe.position.set(0, bodyTopY - s.bodyH * 0.28, 0);
    g.add(stripe);
    const barY = topY + 7;
    const red = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.2, 10, 16), new THREE.MeshBasicMaterial({ color: '#e2574c' }));
    red.position.set(-s.wid * 0.12, barY, 0);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.2, 10, 16), new THREE.MeshBasicMaterial({ color: '#3f7fd4' }));
    blue.position.set(s.wid * 0.12, barY, 0);
    g.add(red, blue);
  } else if (variant === 'player') {
    // نوار قرمز ورزشی + آنتن — پراید سفید قهرمان!
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.16, 4, s.len * 0.92), accentMat);
    stripe.position.set(0, bodyTopY + 2, 0);
    g.add(stripe);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 36, 6), darkMat as THREE.MeshLambertMaterial);
    ant.position.set(s.wid * 0.3, topY + 17, s.len * 0.12);
    g.add(ant);
  } else if (variant === 'pride' && Math.random() < 0.3) {
    // بعضی پرایدها باربند سقف دارند (خیلی ایرانی!)
    const rack = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.7, 5, s.len * 0.34), chromeMat as THREE.MeshLambertMaterial);
    rack.position.set(0, topY + 4, 0);
    g.add(rack);
  }

  // ---------- چرخ‌ها ----------
  const wheels: THREE.Mesh[] = [];
  const tireW = s.wid * 0.15;
  const wr = s.wheelR;
  for (const x of [-s.wid / 2 + tireW * 0.2, s.wid / 2 - tireW * 0.2]) {
    for (const z of [-s.len * 0.31, s.len * 0.31]) {
      const tire = new THREE.Mesh(wheelGeo as THREE.CylinderGeometry, tireMat as THREE.MeshLambertMaterial);
      tire.scale.set(wr, tireW, wr);
      tire.position.set(x, wr, z);
      tire.castShadow = true;
      // کلاهک چرخ — فرزندِ گروه (نه فرزند تایرِ اسکیل‌شده — باگ قبلی!)
      const hub = new THREE.Mesh(hubGeo as THREE.CylinderGeometry, hubMat as THREE.MeshLambertMaterial);
      hub.scale.set(wr * 0.5, tireW * 1.04, wr * 0.5);
      hub.position.set(x + Math.sign(x) * tireW * 0.3, wr, z);
      wheels.push(tire);
      g.add(tire, hub);
    }
  }

  // مقیاس نهایی بر اساس طول منطقی (W از فیزیک می‌آید؛ نسبت‌ها از spec)
  g.scale.setScalar(L / s.len);
  return { group: g, wheels, bodyColor: body };
}

/** گلخانه کوتاه‌شده برای کابین نیسان (بدون صندوق) */
function buildGreenhouseInner(
  g: THREE.Group, spec: BodySpec, bodyTopY: number,
  cabLen: number, roofMat: THREE.MeshLambertMaterial,
): number {
  const cabW = spec.wid * 0.8;
  const glass = glassMat as THREE.MeshLambertMaterial;
  const th = 7;
  const front = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.96, spec.cabH, th), glass);
  front.position.set(0, bodyTopY + spec.cabH / 2 - 2, -cabLen / 2);
  front.rotation.x = spec.frontSlope;
  const rear = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.96, spec.cabH, th), glass);
  rear.position.set(0, bodyTopY + spec.cabH / 2 - 2, cabLen / 2);
  rear.rotation.x = -spec.rearSlope;
  const sides = new THREE.Mesh(new THREE.BoxGeometry(cabW, spec.cabH * 0.82, cabLen * 0.9), glass);
  sides.position.set(0, bodyTopY + spec.cabH * 0.5, 0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cabW * 1.04, 7, cabLen * 0.92), roofMat);
  roof.position.set(0, bodyTopY + spec.cabH, 0);
  roof.castShadow = true;
  g.add(front, rear, sides, roof);
  return bodyTopY + spec.cabH;
}

/** استخراج واریانت از assetId ترافیک — همه‌چیز ایرانی شد! */
export function variantFromAssetId(assetId: string): CarVariant {
  if (assetId.includes('taxi')) return 'taxi';
  if (assetId.includes('police')) return 'police';
  if (assetId.includes('pickup')) return 'nissan';
  if (assetId.includes('pride')) return 'pride';
  if (assetId.includes('tiba')) return 'tiba';
  if (assetId.includes('samand')) return 'samand';
  if (assetId.includes('sedan') || assetId.includes('405')) return 'peugeot405';
  return 'pride'; // پیش‌فرض: پراید — مثل خیابان‌های واقعی!
}
