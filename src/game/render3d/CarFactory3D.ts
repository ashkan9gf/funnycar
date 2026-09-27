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
  | 'nissan' | 'tiba' | 'taxi' | 'police';

export interface CarModel3D {
  group: THREE.Group;
  /** چرخ‌ها برای انیمیشن چرخش (rotation.x با سرعت) */
  wheels: THREE.Mesh[];
  /** رنگ بدنه برای ذرات/جلوه‌ها */
  bodyColor: string;
  /** متریال بدنه — برای تیره‌شدن با آسیب */
  bodyMat: THREE.MeshToonMaterial;
  /** سپرهای جداشدنی (سیستم آسیب داینامیک) */
  bumpers: { front: THREE.Mesh | null; rear: THREE.Mesh | null };
  /** چراغ‌گردان پلیس (فلاش قرمز/آبی) */
  lightBar?: { red: THREE.Mesh; blue: THREE.Mesh };
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
}

// ---------- متریال مشترک ----------
let glassMat: THREE.MeshPhongMaterial | null = null;
let tireMat: THREE.MeshToonMaterial | null = null;
let rimMat: THREE.MeshPhongMaterial | null = null;
let darkMat: THREE.MeshToonMaterial | null = null;
let chromeMat: THREE.MeshPhongMaterial | null = null;
let headMat: THREE.MeshBasicMaterial | null = null;
let tailMat: THREE.MeshBasicMaterial | null = null;
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

  glassMat = new THREE.MeshPhongMaterial({ color: '#20303c', shininess: 130, specular: '#9fb6c4', transparent: true, opacity: 0.94 });
  tireMat = new THREE.MeshToonMaterial({ color: '#23211f', gradientMap });
  rimMat = new THREE.MeshPhongMaterial({ color: '#cfd3d8', shininess: 90, specular: '#ffffff' });
  darkMat = new THREE.MeshToonMaterial({ color: '#2e2622', gradientMap });
  chromeMat = new THREE.MeshPhongMaterial({ color: '#c2c8ce', shininess: 110, specular: '#ffffff' });
  headMat = new THREE.MeshBasicMaterial({ color: '#fff6cc' });
  tailMat = new THREE.MeshBasicMaterial({ color: '#e2574c' });
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

// ---------- نیم‌رخ هر خودرو (z: جلو منفی → عقب مثبت، y: ارتفاع) ----------
type Profile = Array<[number, number]>;

const PROFILES: Record<CarVariant, Profile> = {
  // پراید: جعبه‌ای، شیشه عقب پرشیب کم
  player: [[-86, 12], [-87, 38], [-84, 50], [-26, 53], [-19, 88], [28, 88], [37, 55], [76, 53], [82, 36], [86, 13]],
  pride:  [[-86, 12], [-87, 38], [-84, 50], [-26, 53], [-19, 88], [28, 88], [37, 55], [76, 53], [82, 36], [86, 13]],
  // پژو ۴۰۵: کاپوت بلند، صندوق بالا
  peugeot405: [[-98, 12], [-99, 36], [-96, 48], [-28, 52], [-20, 87], [26, 87], [35, 60], [90, 58], [96, 36], [98, 13]],
  taxi:       [[-98, 12], [-99, 36], [-96, 48], [-28, 52], [-20, 87], [26, 87], [35, 60], [90, 58], [96, 36], [98, 13]],
  // سمند: پهن و بلند
  samand: [[-103, 13], [-104, 38], [-101, 52], [-32, 55], [-24, 93], [30, 93], [40, 62], [95, 60], [101, 38], [103, 14]],
  police: [[-103, 13], [-104, 38], [-101, 52], [-32, 55], [-24, 93], [30, 93], [40, 62], [95, 60], [101, 38], [103, 14]],
  // نیسان: وانت — کابین جلو، دیواره بلند عقب
  nissan: [[-100, 12], [-101, 36], [-98, 52], [-46, 55], [-38, 97], [0, 97], [9, 62], [13, 64], [95, 64], [98, 34], [100, 12]],
  // تیبا: هاچ‌بک با عقب مایل
  tiba: [[-84, 12], [-85, 36], [-82, 48], [-24, 51], [-16, 86], [22, 85], [46, 58], [72, 50], [80, 34], [84, 12]],
};

/** ناحیه شیشه هر خودرو: [ز جلو، ز عقب، ارتفاع پایین شیشه، ارتفاع بالا] */
const GLASS_BAND: Record<CarVariant, [number, number, number, number]> = {
  player: [-18, 36, 54, 82],
  pride: [-18, 36, 54, 82],
  peugeot405: [-19, 34, 53, 81],
  taxi: [-19, 34, 53, 81],
  samand: [-23, 38, 56, 86],
  police: [-23, 38, 56, 86],
  nissan: [-37, 8, 56, 90],
  tiba: [-15, 30, 52, 79],
};

/** مشخصات بدنه هر خودرو (واحد: پیکسل منطقی) */
const SPECS: Record<CarVariant, { len: number; wid: number; wheelR: number; hoodFrac: number }> = {
  player:     { len: 172, wid: 100, wheelR: 21, hoodFrac: 0.32 },
  pride:      { len: 172, wid: 100, wheelR: 21, hoodFrac: 0.32 },
  peugeot405: { len: 196, wid: 106, wheelR: 23, hoodFrac: 0.36 },
  taxi:       { len: 196, wid: 106, wheelR: 23, hoodFrac: 0.36 },
  samand:     { len: 206, wid: 112, wheelR: 24, hoodFrac: 0.34 },
  police:     { len: 206, wid: 112, wheelR: 24, hoodFrac: 0.34 },
  nissan:     { len: 200, wid: 112, wheelR: 26, hoodFrac: 0.28 },
  tiba:       { len: 168, wid: 100, wheelR: 22, hoodFrac: 0.32 },
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
  opts: { lite?: boolean } = {},
): CarModel3D {
  ensureShared();
  const spec = SPECS[variant] ?? SPECS.pride;
  const profile = PROFILES[variant] ?? PROFILES.pride;
  const lite = opts.lite === true;

  // رنگ بدنه
  let body = '#f4f4f0';
  if (variant === 'pride' || variant === 'tiba' || variant === 'peugeot405' || variant === 'samand') {
    body = pickColor(COLORS[variant]);
  } else if (variant === 'taxi') body = '#f2c230';
  else if (variant === 'police') body = '#f7f7f2';
  else if (variant === 'nissan') body = '#2f6fae'; // نیسان آبی معروف!

  const bodyMat = toon(body);
  const g = new THREE.Group();
  const s = spec;

  // ---------- بدنه اصلی (نیم‌رخ واقعی + bevel گرد) ----------
  const bodyMesh = buildExtrudedBody(profile, s.wid, bodyMat);
  g.add(bodyMesh);
  if (!lite) addOutline(bodyMesh, 1.04);

  // ---------- باند شیشه کنار + شیشه جلو/عقب ----------
  const [gz0, gz1, gy0, gy1] = GLASS_BAND[variant] ?? GLASS_BAND.pride;
  const bandH = gy1 - gy0;
  const bandLen = gz1 - gz0;
  const glassBand = new THREE.Mesh(
    new THREE.BoxGeometry(s.wid + 1.5, bandH, bandLen),
    glassMat as THREE.MeshPhongMaterial,
  );
  glassBand.position.set(0, (gy0 + gy1) / 2, (gz0 + gz1) / 2);
  g.add(glassBand);
  // خط دور شیشه هم کارتونی‌تر است
  if (!lite) addOutline(glassBand, 1.035);

  // شیشه جلو (کج به جلو)
  const wsZ = (gz0 - 4);
  const ws = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.86, bandH + 8, 6), glassMat as THREE.MeshPhongMaterial);
  ws.position.set(0, (gy0 + gy1) / 2 + 2, wsZ);
  ws.rotation.x = 0.42;
  g.add(ws);
  // شیشه عقب
  const rw = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.84, bandH + 6, 6), glassMat as THREE.MeshPhongMaterial);
  rw.position.set(0, (gy0 + gy1) / 2 + 3, gz1 + 5);
  rw.rotation.x = variant === 'nissan' ? -0.15 : -0.38;
  g.add(rw);

  // ---------- خط در + دستگیره (حس GTA) ----------
  if (!lite) {
    const seamMat = darkMat as THREE.MeshToonMaterial;
    const seamGeo = new THREE.BoxGeometry(1.6, (gy0 - 26), bandLen * 0.42);
    for (const zz of [gz0 + bandLen * 0.42, gz1 - bandLen * 0.05]) {
      for (const sx of [-s.wid / 2 - 0.4, s.wid / 2 + 0.4]) {
        const seam = new THREE.Mesh(seamGeo, seamMat);
        seam.position.set(sx, 26 + (gy0 - 26) / 2, zz);
        g.add(seam);
      }
    }
    const handleGeo = new THREE.BoxGeometry(2.2, 3.2, 12);
    for (const sx of [-s.wid / 2 - 1.2, s.wid / 2 + 1.2]) {
      for (const zz of [gz0 + bandLen * 0.55, gz1 - bandLen * 0.18]) {
        const h = new THREE.Mesh(handleGeo, chromeMat as THREE.MeshPhongMaterial);
        h.position.set(sx, gy0 - 6, zz);
        g.add(h);
      }
    }
  }

  // ---------- سپرها (جداشدنی — سیستم آسیب) ----------
  const bumperGeo = new THREE.BoxGeometry(s.wid + 6, 14, 12);
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

  // ---------- جلوپنجره کروم ----------
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(s.wid * (variant === 'samand' || variant === 'police' || variant === 'nissan' ? 0.56 : 0.4), 9, 4),
    chromeMat as THREE.MeshPhongMaterial,
  );
  grille.position.set(0, 44, profile[0][0] - 2.5);
  g.add(grille);

  // ---------- چراغ‌ها ----------
  const lightGeo = new THREE.BoxGeometry(s.wid * 0.2, 9, 4);
  for (const x of [-s.wid * 0.33, s.wid * 0.33]) {
    const h = new THREE.Mesh(lightGeo, headMat as THREE.MeshBasicMaterial);
    h.position.set(x, 44, profile[0][0] - 3);
    const t = new THREE.Mesh(lightGeo, tailMat as THREE.MeshBasicMaterial);
    t.position.set(x, 46, profile[profile.length - 1][0] + 3);
    g.add(h, t);
  }

  // ---------- پلاک ایرانی ----------
  const plateScale = s.wid * 0.3;
  const plate = new THREE.Mesh(plateGeoShared(), plateMat as THREE.MeshLambertMaterial);
  plate.scale.set(plateScale, plateScale * 0.32, 2);
  plate.position.set(0, 15, profile[profile.length - 1][0] + 6);
  g.add(plate);

  // ---------- آینه بغل ----------
  if (!lite) {
    const mirrorGeo = new THREE.BoxGeometry(10, 7, 8);
    for (const x of [-s.wid / 2 - 5, s.wid / 2 + 5]) {
      const m = new THREE.Mesh(mirrorGeo, darkMat as THREE.MeshToonMaterial);
      m.position.set(x, gy0 + 4, gz0 + 6);
      g.add(m);
    }
  }

  // ---------- اگزوز ----------
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 12, 8), chromeMat as THREE.MeshPhongMaterial);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(s.wid * 0.26, 15, profile[profile.length - 1][0] + 6);
  g.add(exhaust);

  // ---------- راننده داخل کابین (کاراکترها زنده شدند!) ----------
  if (!lite && variant !== 'nissan') {
    const driver = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(18, 16, 12), driverShirtMat as THREE.MeshToonMaterial);
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
    const sign = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.34, 15, 24), taxiSignMat as THREE.MeshLambertMaterial);
    sign.position.set(0, topY + 6, (gz0 + gz1) / 2);
    g.add(sign);
    // نوار شطرنجی تاکسی روی بدنه
    const strip = new THREE.Mesh(new THREE.BoxGeometry(s.wid + 1, 6, bandLen * 0.9), darkMat as THREE.MeshToonMaterial);
    strip.position.set(0, 34, (gz0 + gz1) / 2);
    g.add(strip);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 32, 6), darkMat as THREE.MeshToonMaterial);
    ant.position.set(-s.wid * 0.3, topY + 14, gz1 - 8);
    g.add(ant);
  } else if (variant === 'police') {
    // نوار سبز پلیس ایران
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(s.wid + 1, 12, s.len * 0.55), toon('#2e8b57'));
    stripe.position.set(0, 40, (gz0 + gz1) / 2);
    g.add(stripe);
    // چراغ‌گردان (فلاش در رندر)
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.5, 4, 16), darkMat as THREE.MeshToonMaterial);
    barBase.position.set(0, topY + 2, (gz0 + gz1) / 2);
    const red = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.2, 9, 14), new THREE.MeshBasicMaterial({ color: '#ff2d2d' }));
    red.position.set(-s.wid * 0.13, topY + 8, (gz0 + gz1) / 2);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.2, 9, 14), new THREE.MeshBasicMaterial({ color: '#2d6bff' }));
    blue.position.set(s.wid * 0.13, topY + 8, (gz0 + gz1) / 2);
    g.add(barBase, red, blue);
    (g as unknown as { lightBar?: CarModel3D['lightBar'] }).lightBar = { red, blue };
  } else if (variant === 'player') {
    // نوار قرمز ورزشی روی کاپوت/سقف/صندوق
    const stripeMat = toon('#c62828');
    for (const zz of [profile[0][0] + 34, (gz0 + gz1) / 2, profile[profile.length - 1][0] - 24]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.15, 2.5, 34), stripeMat);
      st.position.set(0, zz === (gz0 + gz1) / 2 ? topY + 1 : 53, zz);
      g.add(st);
    }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 34, 6), darkMat as THREE.MeshToonMaterial);
    ant.position.set(s.wid * 0.3, topY + 15, gz1 - 10);
    g.add(ant);
  } else if (variant === 'pride' && Math.random() < 0.3) {
    // باربند سقف — خیلی ایرانی!
    const rack = new THREE.Mesh(new THREE.BoxGeometry(s.wid * 0.7, 5, bandLen * 0.6), chromeMat as THREE.MeshPhongMaterial);
    rack.position.set(0, topY + 3, (gz0 + gz1) / 2);
    g.add(rack);
  }

  // ---------- چرخ‌ها: تایر تور + رینگ + کلاهک ----------
  const wheels: THREE.Mesh[] = [];
  const tireW = s.wid * 0.16;
  const wr = s.wheelR;
  for (const x of [-s.wid / 2 + tireW * 0.1, s.wid / 2 - tireW * 0.1]) {
    for (const z of [-s.len * 0.31, s.len * 0.31]) {
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(wr - tireW / 2 + 2, tireW / 2, 8, 14),
        tireMat as THREE.MeshToonMaterial,
      );
      tire.rotation.y = Math.PI / 2; // محور چرخ = X
      tire.position.set(x, wr, z);
      tire.castShadow = true;
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(wr * 0.52, wr * 0.52, tireW * 0.75, 10),
        rimMat as THREE.MeshPhongMaterial,
      );
      rim.rotation.z = Math.PI / 2;
      rim.position.set(x + Math.sign(x) * tireW * 0.12, wr, z);
      wheels.push(tire);
      g.add(tire, rim);
    }
  }

  // مقیاس نهایی بر اساس طول منطقی
  g.scale.setScalar(L / s.len);
  // متریال چراغ عقب کلون هر نمونه (ترمز روشن — فاز OVERHAUL)
  const tailClone = (tailMat as THREE.MeshBasicMaterial).clone() as unknown as THREE.MeshStandardMaterial;
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
    damageTiltZ: 0,
    rollZ: 0,
    pitchX: 0,
  };
}

/** هندسه مشترک پلاک (یک‌بار ساخته می‌شود) */
let plateGeo: THREE.BoxGeometry | null = null;
function plateGeoShared(): THREE.BoxGeometry {
  if (!plateGeo) plateGeo = new THREE.BoxGeometry(1, 1, 1);
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
  // کجی انباشته — در draw3D با رول ترکیب و اعمال می‌شود (فاز OVERHAUL)
  model.damageTiltZ = (model.damageTiltZ ?? 0) + (Math.random() - 0.5) * Math.min(0.03, amount * 0.0016);
}

/** استخراج واریانت از assetId ترافیک — همه‌چیز ایرانی است */
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
