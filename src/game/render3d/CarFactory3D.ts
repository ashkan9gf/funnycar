/**
 * CarFactory3D.ts — کارخانه ماشین‌های ایرانی v3 (فاز BIG-IR — «شبیه GTA»)
 * ============================================================
 * ارتقای بزرگ نسبت به v2:
 *  - بدنه از «نیم‌رخ واقعی» هر خودرو با ExtrudeGeometry + bevel → بدنه گرد و نرم
 *  - MeshToonMaterial با گرادیان ۳ پله → سایه‌بندی کارتونی (انیمیشنی، نه سینمایی)
 *  - خط دور (Outline) معکوس روی بدنه → حس کمیک/GTA کارتونی
 *  - شیشه باندی، خط در، دستگیره، آینه، جلوپنجره کروم، پلاک ایرانی
 *  - راننده داخل کابین دیده می‌شود (سر + تن)
 *  - سپر جداشدنی (سیستم آسیب) + چراغ‌گردان پلیس با فلش + تیرگی بدنه با آسیب
 * ماشین رو به -Z ساخته می‌شود (شمال = angle صفر قرارداد Vehicle).
 */

import * as THREE from 'three';
import { getPlateTexture, getTaxiSignTexture } from './textures3d';

export type CarVariant =
  | 'player' | 'pride' | 'peugeot405' | 'samand'
  | 'nissan' | 'tiba' | 'taxi' | 'police'
  | 'renault4' | 'vintage';

/** چرخ مدل خارجی: چرخش حول محور واقعی خودش با جهت خودکار */
export interface ExtWheelSpin {
  /** گروه داخل پیوت — مش‌های چرخ به آن attach شده‌اند */
  spinner: THREE.Group;
  /** محور چرخ در فضای محلی spinner (نرمال‌شده + snap به محور اصلی) */
  axis: THREE.Vector3;
  /** +1 یا -1 — طوری که جلو رفتن = چرخش رو به جلو */
  sign: number;
  /** کاترنیون پایه spinner (قبل از هر چرخشی) — برای اسپین مطلق بدون drift */
  base: THREE.Quaternion;
  /** زاویه تجمعی فعلی (رادیان) — به‌جای rotateOnAxis افزایشی که wobble جمع می‌کند */
  angle: number;
}

/** چرخاندن چرخ‌ها — مدل خارجی: محور/جهت واقعی؛ پروسیجرال: rotation.x
 * 🔑 فیکس «لاستیک باگ در حرکت»: rotateOnAxis افزایشی، خطای ممیز شناور و کجی محور را
 * فریم‌به‌فریم جمع می‌کرد → چرخ بعد از چند ثانیه کج/کولاش می‌شد. حالا هر فریم کاترنیون
 * مطلق = base × axisAngle(axis, angle) ست می‌شود — صفر drift، صفر wobble */
const _spinQ = new THREE.Quaternion();
export function spinWheels(model: CarModel3D, amount: number): void {
  if (model.extWheels && model.extWheels.length > 0) {
    for (const ew of model.extWheels) {
      ew.angle += ew.sign * amount;
      ew.spinner.quaternion.copy(ew.base).multiply(_spinQ.setFromAxisAngle(ew.axis, ew.angle));
    }
  } else {
    for (const w of model.wheels) w.rotation.x += amount;
  }
}

/** فرمان چرخ‌های جلو — با محور Y واقعی هر پیوت (مدل‌های با ریشه چرخیده) */
export function steerWheels(model: CarModel3D, angle: number): void {
  for (const pivot of model.steerable ?? []) {
    const ax = pivot.userData.steerAxis as THREE.Vector3 | undefined;
    if (ax) pivot.setRotationFromAxisAngle(ax, angle);
    else pivot.rotation.y = angle;
  }
}

// ---------- v5: مشخصات تنوع مدل‌ها (هماهنگ با vehicleGeometry.ts — منبع GLB) ----------
/** عرض کابین نسبت به بدنه — کابین باریک‌تر = سیلوئت واقعی */
const CABIN_W: Record<CarVariant, number> = {
  player: 0.86, pride: 0.84, peugeot405: 0.80, taxi: 0.80,
  samand: 0.88, police: 0.88, nissan: 0.78, tiba: 0.76,
  renault4: 0.82, vintage: 0.80,
};
/** شکل چراغ جلو/عقب مخصوص هر مدل */
const LIGHT_SPEC: Record<CarVariant, { fW: number; fH: number; rW: number; rH: number }> = {
  player:     { fW: 0.18, fH: 9,  rW: 0.18, rH: 9 },
  pride:      { fW: 0.15, fH: 8,  rW: 0.15, rH: 8 },
  peugeot405: { fW: 0.24, fH: 7,  rW: 0.22, rH: 7 },
  taxi:       { fW: 0.24, fH: 7,  rW: 0.22, rH: 7 },
  samand:     { fW: 0.20, fH: 12, rW: 0.20, rH: 11 },
  police:     { fW: 0.20, fH: 12, rW: 0.20, rH: 11 },
  nissan:     { fW: 0.20, fH: 10, rW: 0.20, rH: 10 },
  tiba:       { fW: 0.17, fH: 9,  rW: 0.17, rH: 9 },
  renault4:   { fW: 0.20, fH: 9,  rW: 0.20, rH: 9 },
  vintage:    { fW: 0.22, fH: 10, rW: 0.22, rH: 10 },
};
/** جلوپنجره مخصوص هر مدل (پراید/تیبا پلاستیکی تیره) */
const GRILLE_SPEC: Record<CarVariant, { w: number; h: number; chrome: boolean }> = {
  player:     { w: 0.40, h: 9,  chrome: true },
  pride:      { w: 0.42, h: 8,  chrome: false },
  peugeot405: { w: 0.30, h: 7,  chrome: true },
  taxi:       { w: 0.30, h: 7,  chrome: true },
  samand:     { w: 0.56, h: 10, chrome: true },
  police:     { w: 0.56, h: 10, chrome: true },
  nissan:     { w: 0.52, h: 11, chrome: true },
  tiba:       { w: 0.34, h: 7,  chrome: false },
  renault4:   { w: 0.42, h: 8,  chrome: false },
  vintage:    { w: 0.50, h: 10, chrome: true },
};

export interface CarModel3D {
  group: THREE.Group;
  /** چرخ‌ها برای انیمیشن چرخش (rotation.x با سرعت) */
  wheels: THREE.Object3D[];
  /** چرخ‌های مدل خارجی: spinner + محور واقعی + جهت درست (فیکس چرخ ۲۰۶/پلیس/پیکان) */
  extWheels?: ExtWheelSpin[];
  /** رنگ بدنه برای ذرات/جلوه‌ها */
  bodyColor: string;
  /** متریال بدنه — برای تیره‌شدن با آسیب */
  bodyMat: THREE.MeshToonMaterial;
  /** سپرهای جداشدنی (سیستم آسیب داینامیک) */
  bumpers: { front: THREE.Mesh | null; rear: THREE.Mesh | null };
  /** چراغ‌گردان پلیس (فلاش قرمز/آبی) */
  lightBar?: { red: THREE.Mesh; blue: THREE.Mesh };
  /** متریال چراغ راهنما — کلون هر خودرو برای پالس مستقل */
  indicatorMat?: THREE.MeshStandardMaterial;
  /** شیشه‌ها — برای خوردگی بصری */
  len: number;
  wid: number;
  // ---------- فاز GRAPHICS_OVERHAUL ----------
  /** چرخ‌های قابل فرمان (pivot جلو) — فقط GLB */
  steerable?: THREE.Group[];
  /** متریال چراغ عقب (کلون هر نمونه) — ترمز روشن */
  tailMat?: THREE.MeshStandardMaterial | null;
  /** کجی انباشته آسیب (بدون دستکاری مستقیم rotation.z) */
  damageTiltZ?: number;
  /** رول دینامیک بدنه (پیچ به دور خود) */
  rollZ?: number;
  /** پیک بدنه (گاز/ترمز) */
  pitchX?: number;
  /** متریال‌های بدنه مدل خارجی — تیره‌شدن با آسیب */
  damageMats?: THREE.MeshStandardMaterial[];
  /** 🔑 v0.2.41: متریال‌های رنگ‌پذیر بدنه + رنگ اصلی GLB — برای رنگ گاراژ روی مدل واقعی
   *  (رنگ نهایی = orig × رنگ انتخابی؛ بدون دست زدن به تکسچر/شیشه/چرخ/چراغ) */
  paintMats?: Array<{ mat: THREE.MeshStandardMaterial; orig: THREE.Color }>;
}

// ---------- متریال مشترک ----------
let glassMat: THREE.MeshPhysicalMaterial | null = null;
let tireMat: THREE.MeshToonMaterial | null = null;
let rimMat: THREE.MeshStandardMaterial | null = null;
let darkMat: THREE.MeshToonMaterial | null = null;
let chromeMat: THREE.MeshPhongMaterial | null = null;
let headMat: THREE.MeshStandardMaterial | null = null;
let indicatorMat: THREE.MeshStandardMaterial | null = null;
let fogLensMat: THREE.MeshStandardMaterial | null = null;
let tailMat: THREE.MeshStandardMaterial | null = null;
let plateMat: THREE.MeshLambertMaterial | null = null;
let taxiSignMat: THREE.MeshLambertMaterial | null = null;
let outlineMat: THREE.MeshBasicMaterial | null = null;
let driverShirtMat: THREE.MeshToonMaterial | null = null;
let skinMat: THREE.MeshToonMaterial | null = null;
let gradientMap: THREE.DataTexture | null = null;

function ensureShared(): void {
  if (gradientMap) return;
  // گرادیان ۳ پله برای سایه‌بندی تون (کارتونی)
  const data = new Uint8Array([
    150, 150, 150, 255,
    210, 210, 210, 255,
    255, 255, 255, 255,
  ]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;

  // PBR glazing: controlled clearcoat highlights give procedural car windows a glass-like response.
  // Keep opacity and tint close to the original stylized look for readability on mobile.
  glassMat = new THREE.MeshPhysicalMaterial({
    color: '#20303c',
    transparent: true,
    opacity: 0.94,
    roughness: 0.2,
    metalness: 0.08,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    envMapIntensity: 0.7,
  });
  tireMat = new THREE.MeshToonMaterial({ color: '#23211f', gradientMap });
  // PBR alloy: metallic response with restrained roughness keeps rims readable without relying on mirror-like reflections.
  rimMat = new THREE.MeshStandardMaterial({ color: '#cfd3d8', metalness: 0.72, roughness: 0.3, envMapIntensity: 0.65 });
  darkMat = new THREE.MeshToonMaterial({ color: '#2e2622', gradientMap });
  chromeMat = new THREE.MeshPhongMaterial({ color: '#c2c8ce', shininess: 110, specular: '#ffffff' });
  headMat = new THREE.MeshStandardMaterial({ color: '#fff1b8', emissive: '#ffd76a', emissiveIntensity: 1.15, roughness: 0.24, metalness: 0.08 });
  indicatorMat = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ff7b18', emissiveIntensity: 0.85, roughness: 0.3, metalness: 0.02 });
  fogLensMat = new THREE.MeshStandardMaterial({ color: '#dce8e8', emissive: '#6b7d82', emissiveIntensity: 0.18, roughness: 0.32, metalness: 0.04 });
  // چراغ عقب: Standard با emissive — کد ترمز در draw3D روی emissive.set کار می‌کند
  tailMat = new THREE.MeshStandardMaterial({ color: '#e2574c', emissive: '#5a0f08', emissiveIntensity: 0.7, roughness: 0.4 });
  plateMat = new THREE.MeshLambertMaterial({ map: getPlateTexture() });
  taxiSignMat = new THREE.MeshLambertMaterial({ map: getTaxiSignTexture() });
  outlineMat = new THREE.MeshBasicMaterial({ color: '#231a14', side: THREE.BackSide });
  driverShirtMat = new THREE.MeshToonMaterial({ color: '#5b6770', gradientMap });
  skinMat = new THREE.MeshToonMaterial({ color: '#e8b98e', gradientMap });
}

/** متریال تون با رنگ دلخواه */
function toon(color: string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradientMap as THREE.DataTexture });
}

// ---------- پالت رنگ خیابان‌های ایران ----------
const COLORS = {
  pride: ['#f4f4f0', '#d9d9d4', '#3f7fd4', '#b03a2e', '#e8d9b0', '#7f8c8d', '#e8a33d'],
  peugeot405: ['#f7f7f2', '#c8c8c4', '#5d6d7e', '#7b241c', '#34495e', '#e8a33d'],
  samand: ['#bfc9ca', '#f2f3f4', '#424949', '#5d8aa8', '#f2f3f4'],
  tiba: ['#b03a2e', '#d5dbdb', '#f4f4f0', '#1a5276'],
};
function pickColor(list: string[]): string {
  return list[Math.floor(Math.random() * list.length)];
}

// ---------- نیم‌رخ هر خودرو v5 — سیلوئت متمایز (z: جلو منفی → عقب مثبت، y: ارتفاع) ----------
type Profile = Array<[number, number]>;

const PROFILES: Record<CarVariant, Profile> = {
  // پراید: جعبه‌ای کوچک با سقف تخت
  player: [[-86, 12], [-87, 38], [-84, 50], [-26, 53], [-19, 88], [28, 88], [37, 55], [76, 53], [82, 36], [86, 13]],
  pride:  [[-86, 12], [-88, 32], [-87, 46], [-84, 52], [-30, 54], [-24, 72], [-20, 86], [26, 87], [36, 56], [74, 54], [82, 44], [85, 26], [86, 13]],
  // پژو ۴۰۵: کشیده و کوتاه — کاپوت خیلی بلند
  peugeot405: [[-100, 12], [-102, 26], [-101, 38], [-97, 44], [-34, 46], [-26, 60], [-20, 79], [26, 80], [38, 58], [50, 52], [88, 51], [96, 42], [100, 24], [100, 13]],
  taxi:       [[-100, 12], [-102, 26], [-101, 38], [-97, 44], [-34, 46], [-26, 60], [-20, 79], [26, 80], [38, 58], [50, 52], [88, 51], [96, 42], [100, 24], [100, 13]],
  // سمند: بلند و پهن — بلندترین سقف
  samand: [[-104, 14], [-106, 34], [-105, 48], [-101, 55], [-36, 58], [-28, 76], [-23, 97], [28, 98], [40, 70], [50, 63], [90, 62], [100, 50], [104, 30], [104, 15]],
  police: [[-104, 14], [-106, 34], [-105, 48], [-101, 55], [-36, 58], [-28, 76], [-23, 97], [28, 98], [40, 70], [50, 63], [90, 62], [100, 50], [104, 30], [104, 15]],
  // نیسان: وانت — دیواره خیلی بلند بار
  nissan: [[-102, 12], [-104, 30], [-103, 46], [-99, 54], [-50, 57], [-42, 74], [-36, 100], [2, 101], [10, 66], [16, 63], [92, 64], [99, 42], [102, 20], [102, 12]],
  // تیبا: کوتاه‌ترین — هاچ‌بک گرد
  tiba: [[-79, 13], [-82, 30], [-80, 44], [-74, 50], [-24, 52], [-15, 68], [-8, 84], [18, 84], [34, 60], [48, 52], [62, 47], [72, 38], [77, 24], [79, 14]],
  // رنو۴: هاچ‌بک جعبه‌ای بلند — کاپوت کوتاه، عقب تقریباً قائم
  renault4: [[-88, 14], [-89, 34], [-87, 48], [-80, 52], [-30, 54], [-24, 74], [-20, 90], [24, 90], [36, 62], [58, 54], [74, 46], [84, 32], [88, 16]],
  // قدیمی کلاسیک: سدان سه‌حجمه با کاپوت بلند و گلگیر گرد
  vintage: [[-98, 14], [-99, 36], [-96, 50], [-88, 55], [-34, 57], [-26, 78], [-20, 94], [26, 95], [40, 66], [52, 58], [84, 56], [94, 42], [98, 26], [98, 15]],
};

/** ناحیه شیشه هر خودرو v5: [ز جلو، ز عقب، ارتفاع پایین شیشه، ارتفاع بالا] */
const GLASS_BAND: Record<CarVariant, [number, number, number, number]> = {
  player: [-18, 36, 54, 82],
  pride: [-19, 36, 53, 80],
  peugeot405: [-24, 34, 47, 74],
  taxi: [-24, 34, 47, 74],
  samand: [-26, 40, 59, 91],
  police: [-26, 40, 59, 91],
  nissan: [-38, 6, 58, 92],
  tiba: [-10, 28, 53, 79],
  renault4: [-24, 30, 55, 84],
  vintage: [-26, 34, 58, 88],
};

/** مشخصات بدنه هر خودرو v5 (واحد: پیکسل منطقی) */
const SPECS: Record<CarVariant, { len: number; wid: number; wheelR: number; hoodFrac: number }> = {
  player:     { len: 172, wid: 100, wheelR: 21, hoodFrac: 0.32 },
  pride:      { len: 172, wid: 100, wheelR: 20, hoodFrac: 0.32 },
  peugeot405: { len: 200, wid: 104, wheelR: 22, hoodFrac: 0.36 },
  taxi:       { len: 200, wid: 104, wheelR: 22, hoodFrac: 0.36 },
  samand:     { len: 208, wid: 112, wheelR: 24, hoodFrac: 0.34 },
  police:     { len: 208, wid: 112, wheelR: 24, hoodFrac: 0.34 },
  nissan:     { len: 204, wid: 112, wheelR: 26, hoodFrac: 0.28 },
  tiba:       { len: 158, wid: 98,  wheelR: 21, hoodFrac: 0.32 },
  renault4:   { len: 176, wid: 77,  wheelR: 16, hoodFrac: 0.26 },
  vintage:    { len: 197, wid: 73,  wheelR: 16, hoodFrac: 0.38 },
};

/** ساخت بدنه اکسترودشده از نیم‌رخ — عرض در محور X، جلو سمت -Z */
function buildExtrudedBody(profile: Profile, wid: number, mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(profile[0][0], profile[0][1]);
  for (let i = 1; i < profile.length; i++) shape.lineTo(profile[i][0], profile[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: wid - 10,
    bevelEnabled: true,
    bevelThickness: 5,
    bevelSize: 5,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geo.rotateY(-Math.PI / 2); // محور طول → Z (جلو -Z)، اکسترود → X
  geo.translate((wid - 10) / 2, 0, 0); // مرکز عرض (x اکسترود = -z اصلی)
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

/** خط دور کارتونی (hull معکوس) روی یک مش */
function addOutline(mesh: THREE.Mesh, scale = 1.045): THREE.Mesh {
  const o = new THREE.Mesh(mesh.geometry, outlineMat as THREE.MeshBasicMaterial);
  o.scale.setScalar(scale);
  mesh.add(o);
  return o;
}

// ---------- ساخت ماشین ----------
export function buildCar3D(
  variant: CarVariant,
  _W: number,
  L: number,
  opts: { lite?: boolean; paint?: string } = {},
): CarModel3D {
  ensureShared();
  const spec = SPECS[variant] ?? SPECS.pride;
  const profile = PROFILES[variant] ?? PROFILES.pride;
  const lite = opts.lite === true;

  // رنگ بدنه؛ رنگ انتخابی گاراژ روی خودروهای قابل‌خرید اعمال می‌شود.
  let body = '#f4f4f0';
  if (variant === 'player') body = '#f4f4f0';
  else if (variant === 'pride' || variant === 'tiba' || variant === 'peugeot405' || variant === 'samand') {
    body = pickColor(COLORS[variant]);
  } else if (variant === 'taxi') body = '#f2c230';
  else if (variant === 'police') body = '#f7f7f2';
  else if (variant === 'nissan') body = '#2f6fae'; // نیسان آبی معروف!
  else if (variant === 'renault4' || variant === 'vintage') body = pickColor(COLORS[variant] ?? ['#d9d9d4']);
  if (typeof opts.paint === 'string' && /^#[0-9a-f]{6}$/i.test(opts.paint)) body = opts.paint;

  const bodyMat = toon(body);
  // Per-car material lets the indicator glow animate without changing every car at once.
  const carIndicatorMat = (indicatorMat as THREE.MeshStandardMaterial).clone();
  const g = new THREE.Group();
  const s = spec;

  // ---------- بدنه اصلی (نیم‌رخ واقعی + bevel گرد) ----------
  const bodyMesh = buildExtrudedBody(profile, s.wid, bodyMat);
  g.add(bodyMesh);
  if (!lite) addOutline(bodyMesh, 1.04);

  // ---------- باند شیشه کنار (v5: کابین باریک‌تر از بدنه) + شیشه جلو/عقب ----------
  const [gz0, gz1, gy0, gy1] = GLASS_BAND[variant] ?? GLASS_BAND.pride;
  const cab = CABIN_W[variant] ?? 0.84;
  const bandH = gy1 - gy0;
  const bandLen = gz1 - gz0;
  const glassBand = new THREE.Mesh(
    boxGeometryShared(s.wid * cab, bandH, bandLen),
    glassMat as THREE.MeshPhysicalMaterial,
  );
  glassBand.position.set(0, (gy0 + gy1) / 2, (gz0 + gz1) / 2);
  g.add(glassBand);
  // خط دور شیشه هم کارتونی‌تر است
  if (!lite) addOutline(glassBand, 1.035);

  // شیشه جلو (کج به جلو)
  const wsZ = (gz0 - 4);
  const ws = new THREE.Mesh(boxGeometryShared(s.wid * cab * 0.95, bandH + 8, 6), glassMat as THREE.MeshPhysicalMaterial);
  ws.position.set(0, (gy0 + gy1) / 2 + 2, wsZ);
  ws.rotation.x = 0.42;
  g.add(ws);
  // شیشه عقب
  const rw = new THREE.Mesh(boxGeometryShared(s.wid * cab * 0.92, bandH + 6, 6), glassMat as THREE.MeshPhysicalMaterial);
  rw.position.set(0, (gy0 + gy1) / 2 + 3, gz1 + 5);
  rw.rotation.x = variant === 'nissan' ? -0.15 : -0.38;
  g.add(rw);

  // ---------- خط در + دستگیره (حس GTA) ----------
  if (!lite) {
    const seamMat = darkMat as THREE.MeshToonMaterial;
    const seamGeo = boxGeometryShared(1.6, (gy0 - 26), bandLen * 0.42);
    for (const zz of [gz0 + bandLen * 0.42, gz1 - bandLen * 0.05]) {
      for (const sx of [-s.wid / 2 - 0.4, s.wid / 2 + 0.4]) {
        const seam = new THREE.Mesh(seamGeo, seamMat);
        seam.position.set(sx, 26 + (gy0 - 26) / 2, zz);
        g.add(seam);
      }
    }
    const handleGeo = boxGeometryShared(2.2, 3.2, 12);
    for (const sx of [-s.wid / 2 - 1.2, s.wid / 2 + 1.2]) {
      for (const zz of [gz0 + bandLen * 0.55, gz1 - bandLen * 0.18]) {
        const h = new THREE.Mesh(handleGeo, chromeMat as THREE.MeshPhongMaterial);
        h.position.set(sx, gy0 - 6, zz);
        g.add(h);
      }
    }

    // Subtle body-panel details: hood/trunk shut-lines and wheel-arch lips.
    // Full-detail only; use one shared material and low-segment tubes to limit cost.
    const panelMat = darkMat as THREE.MeshToonMaterial;
    const hoodSeam = new THREE.Mesh(
      boxGeometryShared(s.wid * 0.76, 1.25, 1.5),
      panelMat,
    );
    hoodSeam.position.set(0, 47, profile[0][0] + s.len * 0.27);
    const trunkSeam = new THREE.Mesh(
      boxGeometryShared(s.wid * 0.72, 1.25, 1.5),
      panelMat,
    );
    trunkSeam.position.set(0, 46, profile[profile.length - 1][0] - s.len * 0.19);
    hoodSeam.castShadow = trunkSeam.castShadow = false;
    g.add(hoodSeam, trunkSeam);

    const archRadius = Math.max(12, s.wheelR - (s.wid * 0.16) * 0.5 + 1.5);
    for (const wheelZ of [-s.len * 0.31, s.len * 0.31]) {
      for (const side of [-1, 1]) {
        const x = side * (s.wid / 2 + 0.15);
        const points: THREE.Vector3[] = [];
        for (let i = 0; i <= 12; i++) {
          const angle = Math.PI - (Math.PI * i) / 12;
          points.push(new THREE.Vector3(
            x,
            s.wheelR + Math.sin(angle) * archRadius + 0.8,
            wheelZ + Math.cos(angle) * archRadius,
          ));
        }
        const archCurve = new THREE.CatmullRomCurve3(points);
        const arch = new THREE.Mesh(
          new THREE.TubeGeometry(archCurve, 12, 1.05, 5, false),
          panelMat,
        );
        arch.castShadow = false;
        arch.receiveShadow = false;
        g.add(arch);
      }
    }
  }

  // ---------- سپرها (جداشدنی — سیستم آسیب) ----------
  const bumperGeo = boxGeometryShared(s.wid + 6, 14, 12);
  const bumpers: CarModel3D['bumpers'] = { front: null, rear: null };
  const fb = new THREE.Mesh(bumperGeo, darkMat as THREE.MeshToonMaterial);
  fb.position.set(0, 24, profile[0][0] - 4);
  fb.castShadow = true;
  const rb = new THREE.Mesh(bumperGeo, darkMat as THREE.MeshToonMaterial);
  rb.position.set(0, 24, profile[profile.length - 1][0] + 4);
  rb.castShadow = true;
  g.add(fb, rb);
  bumpers.front = fb;
  bumpers.rear = rb;

  // Refined bumper inserts: restrained satin trim and dark corner impact pads.
  // These are static shared-material details; no extra textures or frame updates.
  const bumperTrimMat = chromeMat as THREE.MeshPhongMaterial;
  const bumperPadMat = darkMat as THREE.MeshToonMaterial;
  const frontZ = profile[0][0] - 10.4;
  const rearZ = profile[profile.length - 1][0] + 10.4;
  const trimGeo = boxGeometryShared(s.wid * 0.62, 2.1, 1.4);
  const frontTrim = new THREE.Mesh(trimGeo, bumperTrimMat);
  frontTrim.position.set(0, 25.2, frontZ);
  const rearTrim = new THREE.Mesh(trimGeo, bumperTrimMat);
  rearTrim.position.set(0, 25.2, rearZ);
  frontTrim.castShadow = rearTrim.castShadow = false;
  g.add(frontTrim, rearTrim);

  const cornerPadGeo = boxGeometryShared(s.wid * 0.105, 8, 1.8);
  for (const side of [-1, 1]) {
    const frontPad = new THREE.Mesh(cornerPadGeo, bumperPadMat);
    frontPad.position.set(side * s.wid * 0.405, 24.5, frontZ - 0.2);
    const rearPad = new THREE.Mesh(cornerPadGeo, bumperPadMat);
    rearPad.position.set(side * s.wid * 0.405, 24.5, rearZ + 0.2);
    frontPad.castShadow = rearPad.castShadow = false;
    g.add(frontPad, rearPad);
  }

  // Compact fog lamps below the main headlights; kept dark on low-detail traffic.
  if (!lite) {
    const fogHousingMat = darkMat as THREE.MeshToonMaterial;
    const fogHousingGeo = boxGeometryShared(Math.max(7, s.wid * 0.095), 6, 2.6);
    const fogLensGeo = boxGeometryShared(Math.max(4, s.wid * 0.065), 3.5, 1.2);
    for (const side of [-1, 1]) {
      const fogHousing = new THREE.Mesh(fogHousingGeo, fogHousingMat);
      fogHousing.position.set(side * s.wid * 0.31, 29.5, frontZ - 1.2);
      const fogLens = new THREE.Mesh(fogLensGeo, fogLensMat as THREE.MeshStandardMaterial);
      fogLens.position.set(side * s.wid * 0.31, 29.5, frontZ - 2.7);
      fogHousing.castShadow = fogLens.castShadow = false;
      g.add(fogHousing, fogLens);
    }
  }

  // ---------- جلوپنجره (v5: مخصوص هر مدل — پراید/تیبا پلاستیکی تیره) ----------
  const grille = GRILLE_SPEC[variant] ?? GRILLE_SPEC.pride;
  const grilleMesh = new THREE.Mesh(
    boxGeometryShared(s.wid * grille.w, grille.h, 4),
    grille.chrome ? chromeMat as THREE.MeshPhongMaterial : darkMat as THREE.MeshToonMaterial,
  );
  grilleMesh.position.set(0, 44, profile[0][0] - 2.5);
  g.add(grilleMesh);
  if (variant === 'samand' || variant === 'police') {
    // نوار کروم کنار بدنه سمند — امضای مدل
    const stripLen = profile[profile.length - 1][0] - profile[0][0] - 36;
    for (const sx of [-s.wid / 2 - 0.6, s.wid / 2 + 0.6]) {
      const sideStrip = new THREE.Mesh(boxGeometryShared(1.8, 4, stripLen), chromeMat as THREE.MeshPhongMaterial);
      sideStrip.position.set(sx, 34, (profile[0][0] + profile[profile.length - 1][0]) / 2);
      g.add(sideStrip);
    }
  }

  // ---------- چراغ‌ها (v5: شکل مخصوص هر مدل) ----------
  const ls = LIGHT_SPEC[variant] ?? LIGHT_SPEC.pride;
  const lightFGeo = boxGeometryShared(s.wid * ls.fW, ls.fH, 4);
  const lightRGeo = boxGeometryShared(s.wid * ls.rW, ls.rH, 4);
  const headHousingGeo = boxGeometryShared(s.wid * ls.fW * 1.16, ls.fH * 1.28, 3);
  const indicatorGeo = boxGeometryShared(Math.max(4, s.wid * 0.075), Math.max(4, ls.fH * 0.62), 3);
  for (const x of [-s.wid * 0.33, s.wid * 0.33]) {
    // Dark recessed bezel makes the warm, emissive lens read as a separate glass part.
    const housing = new THREE.Mesh(headHousingGeo, darkMat as THREE.MeshToonMaterial);
    housing.position.set(x, 44, profile[0][0] - 1.8);
    const h = new THREE.Mesh(lightFGeo, headMat as THREE.MeshStandardMaterial);
    h.position.set(x, 44, profile[0][0] - 4.2);
    h.castShadow = false;
    h.receiveShadow = false;
    const t = new THREE.Mesh(lightRGeo, tailMat as THREE.MeshStandardMaterial);
    t.position.set(x, 46, profile[profile.length - 1][0] + 3);

    // Separate amber indicator lenses make front and rear corners easier to read.
    const frontIndicator = new THREE.Mesh(indicatorGeo, carIndicatorMat);
    frontIndicator.position.set(Math.sign(x) * s.wid * 0.435, 42, profile[0][0] - 4.0);
    frontIndicator.castShadow = false;
    frontIndicator.receiveShadow = false;
    const rearIndicator = new THREE.Mesh(indicatorGeo, indicatorMat as THREE.MeshStandardMaterial);
    rearIndicator.position.set(Math.sign(x) * s.wid * 0.435, 42, profile[profile.length - 1][0] + 4.5);
    rearIndicator.castShadow = false;
    rearIndicator.receiveShadow = false;
    g.add(housing, h, t, frontIndicator, rearIndicator);
  }

  // ---------- پلاک ایرانی ----------
  const plateScale = s.wid * 0.3;
  const plate = new THREE.Mesh(plateGeoShared(), plateMat as THREE.MeshLambertMaterial);
  plate.scale.set(plateScale, plateScale * 0.32, 2);
  plate.position.set(0, 15, profile[profile.length - 1][0] + 6);
  g.add(plate);

  // ---------- آینه بغل — قاب + شیشهٔ بازتابنده ----------
  if (!lite) {
    const mirrorGeo = boxGeometryShared(10, 7, 8);
    const mirrorFaceGeo = boxGeometryShared(1.2, 4.8, 6.2);
    const mirrorFaceMat = new THREE.MeshPhongMaterial({
      color: '#9bb8c8',
      emissive: '#17242b',
      emissiveIntensity: 0.08,
      specular: '#eaf5ff',
      shininess: 110,
    });
    for (const side of [-1, 1]) {
      const x = side * (s.wid / 2 + 5);
      const housing = new THREE.Mesh(mirrorGeo, darkMat as THREE.MeshToonMaterial);
      housing.position.set(x, gy0 + 4, gz0 + 6);
      housing.castShadow = true;
      const face = new THREE.Mesh(mirrorFaceGeo, mirrorFaceMat);
      face.position.set(x + side * 5.2, gy0 + 4.4, gz0 + 5.4);
      face.rotation.y = side * 0.12;
      g.add(housing, face);
    }

    // داشبورد باریک، صفحه کیلومتر و فرمان؛ جزئیات فقط در کیفیت کامل
    // تا نمونه‌های ترافیک سبک و کم‌هزینه باقی بمانند.
    const dashMat = new THREE.MeshToonMaterial({ color: '#292d31' });
    const dashTopMat = new THREE.MeshToonMaterial({ color: '#45494b' });
    const dashboard = new THREE.Mesh(
      boxGeometryShared(s.wid * cab * 0.88, 8, 13),
      dashMat,
    );
    dashboard.position.set(0, gy0 + 1, gz0 + 10);
    dashboard.castShadow = true;
    const instrument = new THREE.Mesh(
      boxGeometryShared(s.wid * cab * 0.28, 4, 2),
      dashTopMat,
    );
    instrument.position.set(-s.wid * 0.17, gy0 + 6, gz0 + 4);
    const steering = new THREE.Mesh(
      new THREE.TorusGeometry(7, 1.35, 7, 18),
      darkMat as THREE.MeshToonMaterial,
    );
    // Torus پیش‌فرض در صفحه XY قرار دارد؛ همان صفحهٔ عمودی فرمان
    steering.position.set(-s.wid * 0.17, gy0 + 7, gz0 + 15);
    const spoke = new THREE.Mesh(
      boxGeometryShared(1.8, 10, 1.8),
      darkMat as THREE.MeshToonMaterial,
    );
    spoke.position.copy(steering.position);
    g.add(dashboard, instrument, steering, spoke);
  }

  // ---------- اگزوز ----------
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 12, 8), chromeMat as THREE.MeshPhongMaterial);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(s.wid * 0.26, 15, profile[profile.length - 1][0] + 6);
  g.add(exhaust);

  // ---------- راننده داخل کابین (کاراکترها زنده شدند!) ----------
  if (!lite && variant !== 'nissan') {
    const driver = new THREE.Group();
    const torso = new THREE.Mesh(boxGeometryShared(18, 16, 12), driverShirtMat as THREE.MeshToonMaterial);
    torso.position.y = 6;
    const head = new THREE.Mesh(new THREE.SphereGeometry(8.5, 10, 8), skinMat as THREE.MeshToonMaterial);
    head.position.y = 19;
    // موی تیره — نیم‌کره بالای سر
    const hair = new THREE.Mesh(new THREE.SphereGeometry(8.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.2), darkMat as THREE.MeshToonMaterial);
    hair.position.y = 20;
    driver.add(torso, head, hair);
    // ایران: فرمان چپ → راننده سمت چپ (-X)
    driver.position.set(-s.wid * 0.17, gy0 + 2, (gz0 + gz1) / 2 + 4);
    g.add(driver);
  }

  // ---------- واریانت‌های خاص ----------
  const topY = gy1 + 6;
  if (variant === 'taxi') {
    const sign = new THREE.Mesh(boxGeometryShared(s.wid * 0.34, 15, 24), taxiSignMat as THREE.MeshLambertMaterial);
    sign.position.set(0, topY + 6, (gz0 + gz1) / 2);
    g.add(sign);
    // نوار شطرنجی تاکسی روی بدنه
    const strip = new THREE.Mesh(boxGeometryShared(s.wid + 1, 6, bandLen * 0.9), darkMat as THREE.MeshToonMaterial);
    strip.position.set(0, 34, (gz0 + gz1) / 2);
    g.add(strip);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 32, 6), darkMat as THREE.MeshToonMaterial);
    ant.position.set(-s.wid * 0.3, topY + 14, gz1 - 8);
    g.add(ant);
  } else if (variant === 'police') {
    // نوار سبز پلیس ایران
    const stripe = new THREE.Mesh(boxGeometryShared(s.wid + 1, 12, s.len * 0.55), toon('#2e8b57'));
    stripe.position.set(0, 40, (gz0 + gz1) / 2);
    g.add(stripe);
    // چراغ‌گردان (فلاش در رندر)
    const barBase = new THREE.Mesh(boxGeometryShared(s.wid * 0.5, 4, 16), darkMat as THREE.MeshToonMaterial);
    barBase.position.set(0, topY + 2, (gz0 + gz1) / 2);
    const red = new THREE.Mesh(boxGeometryShared(s.wid * 0.2, 9, 14), new THREE.MeshBasicMaterial({ color: '#ff2d2d' }));
    red.position.set(-s.wid * 0.13, topY + 8, (gz0 + gz1) / 2);
    const blue = new THREE.Mesh(boxGeometryShared(s.wid * 0.2, 9, 14), new THREE.MeshBasicMaterial({ color: '#2d6bff' }));
    blue.position.set(s.wid * 0.13, topY + 8, (gz0 + gz1) / 2);
    g.add(barBase, red, blue);
    (g as unknown as { lightBar?: CarModel3D['lightBar'] }).lightBar = { red, blue };
  } else if (variant === 'player') {
    // نوار قرمز ورزشی روی کاپوت/سقف/صندوق
    const stripeMat = toon('#c62828');
    for (const zz of [profile[0][0] + 34, (gz0 + gz1) / 2, profile[profile.length - 1][0] - 24]) {
      const st = new THREE.Mesh(boxGeometryShared(s.wid * 0.15, 2.5, 34), stripeMat);
      st.position.set(0, zz === (gz0 + gz1) / 2 ? topY + 1 : 53, zz);
      g.add(st);
    }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 34, 6), darkMat as THREE.MeshToonMaterial);
    ant.position.set(s.wid * 0.3, topY + 15, gz1 - 10);
    g.add(ant);
  } else if (variant === 'peugeot405') {
    // اسپویلر لب صندوق — امضای ۴۰۵
    const spoiler = new THREE.Mesh(boxGeometryShared(s.wid * 0.78, 4, 10), darkMat as THREE.MeshToonMaterial);
    spoiler.position.set(0, profile[profile.length - 1][1] + 1, profile[profile.length - 1][0] - 2);
    g.add(spoiler);
  } else if (variant === 'pride' && Math.random() < 0.3) {
    // باربند سقف — خیلی ایرانی!
    const rack = new THREE.Mesh(boxGeometryShared(s.wid * cab * 0.8, 5, bandLen * 0.6), chromeMat as THREE.MeshPhongMaterial);
    rack.position.set(0, topY + 3, (gz0 + gz1) / 2);
    g.add(rack);
  }

  // ---------- چرخ‌ها: تایر تور + پره‌های چرخان (فاز APK-FIX) ----------
  // پره‌ها فرزندِ تایر می‌شوند تا با rotation.x همراهش بچرخند و چرخش دیده شود
  // (رینگِ ثابتِ جدا، چرخش را نامرئی می‌کرد)
  const wheels: THREE.Mesh[] = [];
  const tireW = s.wid * 0.16;
  const wr = s.wheelR;
  const wheelGeo = wheelGeometriesShared(wr, tireW);
  for (const x of [-s.wid / 2 + tireW * 0.1, s.wid / 2 - tireW * 0.1]) {
    for (const z of [-s.len * 0.31, s.len * 0.31]) {
      const tire = new THREE.Mesh(wheelGeo.tire, tireMat as THREE.MeshToonMaterial);
      tire.rotation.y = Math.PI / 2; // محور چرخ = X
      tire.position.set(x, wr, z);
      tire.castShadow = true;
      // Geometry cache مشترک؛ فقط آبجکت‌ها/ترنسفورم‌های هر چرخ جدا می‌مانند.
      const sp1 = new THREE.Mesh(wheelGeo.spokeHorizontal, rimMat as THREE.MeshStandardMaterial);
      const sp2 = new THREE.Mesh(wheelGeo.spokeVertical, rimMat as THREE.MeshStandardMaterial);
      const hub = new THREE.Mesh(wheelGeo.hub, rimMat as THREE.MeshStandardMaterial);
      hub.rotation.x = Math.PI / 2; // محور استوانه → Z محلی (= X جهانی بعد از چرخش تایر)
      const rimLip = new THREE.Mesh(wheelGeo.rimLip, rimMat as THREE.MeshStandardMaterial);
      const lugRadius = wr * 0.235;
      const lugGeo = wheelGeo.lug;
      const lugNuts: THREE.Mesh[] = [];
      for (let lug = 0; lug < 4; lug++) {
        const a = (Math.PI * 2 * lug) / 4 + Math.PI / 4;
        const nut = new THREE.Mesh(lugGeo, rimMat as THREE.MeshStandardMaterial);
        nut.rotation.x = Math.PI / 2;
        nut.position.set(Math.cos(a) * lugRadius, Math.sin(a) * lugRadius, tireW * 0.48);
        lugNuts.push(nut);
      }
      tire.add(sp1, sp2, hub, rimLip, ...lugNuts);
      wheels.push(tire);
      g.add(tire);
    }
  }

  // مقیاس نهایی بر اساس طول منطقی
  g.scale.setScalar(L / s.len);
  // متریال چراغ عقب کلون هر نمونه (ترمز روشن — فاز OVERHAUL)
  const tailClone = (tailMat as THREE.MeshStandardMaterial).clone();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material === tailMat) m.material = tailClone;
  });
  return {
    group: g,
    wheels,
    bodyColor: body,
    bodyMat,
    bumpers,
    lightBar: (g as unknown as { lightBar?: CarModel3D['lightBar'] }).lightBar,
    len: s.len,
    wid: s.wid,
    steerable: [],
    tailMat: tailClone,
    indicatorMat: carIndicatorMat,
    damageTiltZ: 0,
    rollZ: 0,
    pitchX: 0,
  };
}

/** کش هندسه‌های ثابت چرخ؛ برای خودروهای هم‌اندازه فقط یک نسخهٔ GPU/CPU از هر هندسه نگه می‌داریم. */
interface SharedWheelGeometries {
  tire: THREE.TorusGeometry;
  spokeHorizontal: THREE.BoxGeometry;
  spokeVertical: THREE.BoxGeometry;
  hub: THREE.CylinderGeometry;
  rimLip: THREE.TorusGeometry;
  lug: THREE.CylinderGeometry;
}
const wheelGeometryCache = new Map<string, SharedWheelGeometries>();

function wheelGeometriesShared(wr: number, tireW: number): SharedWheelGeometries {
  const key = `${wr}:${tireW.toFixed(3)}`;
  const cached = wheelGeometryCache.get(key);
  if (cached) return cached;
  const R = wr - tireW / 2 + 2;
  const spokeLen = R * 1.75;
  const created: SharedWheelGeometries = {
    tire: new THREE.TorusGeometry(R, tireW / 2, 10, 24),
    spokeHorizontal: boxGeometryShared(spokeLen, tireW * 0.34, tireW * 1.15),
    spokeVertical: boxGeometryShared(tireW * 0.34, spokeLen, tireW * 1.15),
    hub: new THREE.CylinderGeometry(wr * 0.3, wr * 0.3, tireW * 1.3, 12),
    rimLip: new THREE.TorusGeometry(R * 0.72, 1.35, 6, 24),
    lug: new THREE.CylinderGeometry(1.45, 1.45, tireW * 0.72, 6),
  };
  wheelGeometryCache.set(key, created);
  return created;
}

/** Cache immutable box geometries used by repeated car trim, panels and accessories.
 * Exact dimension keys avoid silently changing authored proportions through rounding. */
const boxGeometryCache = new Map<string, THREE.BoxGeometry>();
function boxGeometryShared(width: number, height: number, depth: number): THREE.BoxGeometry {
  const key = `${width}|${height}|${depth}`;
  const cached = boxGeometryCache.get(key);
  if (cached) return cached;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  boxGeometryCache.set(key, geometry);
  return geometry;
}

/** هندسه مشترک پلاک (یک‌بار ساخته می‌شود) */
let plateGeo: THREE.BoxGeometry | null = null;
function plateGeoShared(): THREE.BoxGeometry {
  if (!plateGeo) plateGeo = boxGeometryShared(1, 1, 1);
  return plateGeo;
}

/** جدا کردن سپر (سیستم آسیب) — true = سپر جدا شد */
export function detachBumper(model: CarModel3D, front: boolean): boolean {
  const b = front ? model.bumpers.front : model.bumpers.rear;
  if (!b || !b.visible) return false;
  b.visible = false;
  return true;
}

/** تیره‌شدن بدنه با آسیب + کج شدن جزئی (خام‌کاری کارتونی) */
export function applyDamageVisual(model: CarModel3D, amount: number): void {
  const c = model.bodyMat.color;
  c.multiplyScalar(Math.max(0.82, 1 - amount * 0.006));
  // مدل خارجی: متریال PBR بدنه هم تیره می‌شود
  for (const dm of model.damageMats ?? []) {
    if (dm && dm.color) dm.color.multiplyScalar(Math.max(0.9, 1 - amount * 0.0022));
  }
  // کجی انباشته — در draw3D با رول ترکیب و اعمال می‌شود (فاز OVERHAUL)
  model.damageTiltZ = (model.damageTiltZ ?? 0) + (Math.random() - 0.5) * Math.min(0.03, amount * 0.0016);
}

/** استخراج واریانت از assetId ترافیک — همه‌چیز ایرانی است */
export function variantFromAssetId(assetId: string): CarVariant {
  if (assetId.includes('taxi')) return 'taxi';
  if (assetId.includes('police')) return 'police';
  if (assetId.includes('pickup')) return 'nissan';
  if (assetId.includes('renault')) return 'renault4';
  if (assetId.includes('vintage')) return 'vintage';
  if (assetId.includes('pride')) return 'pride';
  if (assetId.includes('tiba')) return 'tiba';
  if (assetId.includes('samand')) return 'samand';
  if (assetId.includes('sedan') || assetId.includes('405')) return 'peugeot405';
  return 'pride'; // پیش‌فرض: پراید — مثل خیابان‌های واقعی!
}
