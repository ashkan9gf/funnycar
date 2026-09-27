/**
 * vehicleGeometry.ts — هندسه خودروهای ایرانی v4 (فاز GRAPHICS_OVERHAUL)
 * ============================================================
 * منبع «تک‌حقیقت» شکل خودروها:
 *  1) ابزار Node (tools/glb/generate_vehicles.ts با bun) → خروجی GLB واقعی
 *  2) مرورگر → هندسه merge برای دوبله‌پارکی‌های Instanced + fallback procedural
 *
 * قرارداد جهت: جلو = -Z، بالا = +Y (مثل CarFactory3D)
 * همه قطعات Vertex-Color دارند تا با یک متریال مشترک merge شوند (کاهش Draw Call)
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ---------- مشخصات هر واریانت ----------
export type VehicleVariant =
  | 'player' | 'pride' | 'peugeot405' | 'samand'
  | 'nissan' | 'tiba' | 'taxi' | 'police';

export interface VehicleSpec {
  len: number;
  wid: number;
  wheelR: number;
  /** نسبت فاصله چرخ جلو از مرکز */
  axleF: number;
  axleR: number;
}

export const VEHICLE_SPECS: Record<VehicleVariant, VehicleSpec> = {
  player:     { len: 172, wid: 100, wheelR: 21, axleF: 0.335, axleR: 0.31 },
  pride:      { len: 172, wid: 100, wheelR: 21, axleF: 0.335, axleR: 0.31 },
  peugeot405: { len: 196, wid: 106, wheelR: 23, axleF: 0.33,  axleR: 0.30 },
  taxi:       { len: 196, wid: 106, wheelR: 23, axleF: 0.33,  axleR: 0.30 },
  samand:     { len: 206, wid: 112, wheelR: 24, axleF: 0.33,  axleR: 0.30 },
  police:     { len: 206, wid: 112, wheelR: 24, axleF: 0.33,  axleR: 0.30 },
  nissan:     { len: 200, wid: 112, wheelR: 26, axleF: 0.30,  axleR: 0.32 },
  tiba:       { len: 168, wid: 100, wheelR: 22, axleF: 0.32,  axleR: 0.31 },
};

// ---------- نیم‌رخ v4 (نرم‌تر از v3 — نقاط بیشتر برای انحنای کاپوت/سقف) ----------
type Profile = Array<[number, number]>;

export const PROFILES: Record<VehicleVariant, Profile> = {
  // پراید: جعبه‌ای با شیشه عقب پرشیب کم
  player: [[-86, 12], [-88, 30], [-87, 44], [-83, 51], [-30, 53], [-22, 70], [-17, 88], [24, 89], [34, 62], [42, 55], [72, 54], [80, 44], [84, 26], [86, 13]],
  pride:  [[-86, 12], [-88, 30], [-87, 44], [-83, 51], [-30, 53], [-22, 70], [-17, 88], [24, 89], [34, 62], [42, 55], [72, 54], [80, 44], [84, 26], [86, 13]],
  // پژو ۴۰۵: کاپوت بلند و صندوق پهن
  peugeot405: [[-98, 12], [-100, 28], [-99, 42], [-95, 49], [-32, 52], [-24, 68], [-19, 87], [22, 88], [32, 64], [42, 59], [82, 58], [92, 46], [97, 26], [98, 13]],
  taxi:       [[-98, 12], [-100, 28], [-99, 42], [-95, 49], [-32, 52], [-24, 68], [-19, 87], [22, 88], [32, 64], [42, 59], [82, 58], [92, 46], [97, 26], [98, 13]],
  // سمند: پهن و کشیده
  samand: [[-103, 13], [-105, 30], [-104, 44], [-100, 52], [-36, 55], [-27, 71], [-22, 93], [27, 94], [38, 67], [48, 61], [88, 60], [98, 47], [102, 27], [103, 14]],
  police: [[-103, 13], [-105, 30], [-104, 44], [-100, 52], [-36, 55], [-27, 71], [-22, 93], [27, 94], [38, 67], [48, 61], [88, 60], [98, 47], [102, 27], [103, 14]],
  // نیسان: وانت — کابین جلو، دیواره بلند عقب
  nissan: [[-100, 12], [-102, 28], [-101, 42], [-97, 51], [-48, 54], [-40, 70], [-34, 97], [2, 98], [10, 64], [16, 62], [90, 63], [97, 40], [100, 20], [100, 12]],
  // تیبا: هاچ‌بک با عقب مایل
  tiba: [[-84, 12], [-86, 28], [-85, 42], [-81, 49], [-26, 51], [-18, 66], [-13, 86], [20, 86], [32, 62], [44, 55], [64, 51], [74, 40], [80, 22], [84, 12]],
};

/** ناحیه شیشه: [ز جلو، ز عقب، ارتفاع پایین، ارتفاع بالا] */
export const GLASS_BAND: Record<VehicleVariant, [number, number, number, number]> = {
  player: [-18, 36, 54, 82],
  pride:  [-18, 36, 54, 82],
  peugeot405: [-19, 34, 53, 81],
  taxi:       [-19, 34, 53, 81],
  samand: [-23, 38, 56, 86],
  police: [-23, 38, 56, 86],
  nissan: [-37, 8, 56, 90],
  tiba:   [-15, 30, 52, 79],
};

// ---------- رنگ‌های مبنا (hex → خطی هنگام نوشتن) ----------
export const VEHICLE_COLORS: Record<string, string[]> = {
  pride: ['#f4f4f0', '#d9d9d4', '#3f7fd4', '#b03a2e', '#e8d9b0', '#7f8c8d', '#e8a33d'],
  peugeot405: ['#f7f7f2', '#c8c8c4', '#5d6d7e', '#7b241c', '#34495e', '#e8a33d'],
  samand: ['#bfc9ca', '#f2f3f4', '#424949', '#5d8aa8'],
  tiba: ['#b03a2e', '#d5dbdb', '#f4f4f0', '#1a5276'],
};
export const FIXED_COLORS: Partial<Record<VehicleVariant, string>> = {
  player: '#f4f4f0',
  taxi: '#f2c230',
  police: '#f7f7f2',
  nissan: '#2f6fae', // نیسان آبی معروف!
};

// ---------- رنگ قطعات (ثابت) ----------
export const PART_COLORS = {
  glass: '#20303c',
  tire: '#23211f',
  rim: '#3d4248', // رینگ تیره — برای دوبله‌پارکی با tint رنگی خراب نمی‌شود
  rimBright: '#cfd3d8',
  trim: '#2e2622',
  chrome: '#c2c8ce',
  lightF: '#fff2c4',
  lightR: '#e2574c',
  plate: '#e8e8e8',
  plateBlue: '#1c4fa0',
  interior: '#3a342f',
  seat: '#4a443e',
  policeStripe: '#2e8b57',
  playerStripe: '#c62828',
  taxiCheck: '#26221e',
  signBg: '#26221e',
};

/** hex → [r,g,b] خطی (برای COLOR_0 و baseColorFactor GLB) */
export function lin(hex: string): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}
export function linA(hex: string, a = 1): [number, number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b, a];
}

// ---------- سازنده‌های هندسه ----------
interface Part { geo: THREE.BufferGeometry; color: string }

function box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): Part {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx || ry || rz) {
    g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz);
  }
  g.translate(x, y, z);
  return { geo: g, color };
}

function cyl(rTop: number, rBot: number, h: number, seg: number, color: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): Part {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  if (rx || ry || rz) { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); }
  g.translate(x, y, z);
  return { geo: g, color };
}

function mergeParts(parts: Part[]): THREE.BufferGeometry {
  // همه باید یک ست صفت داشته باشند: position/normal/uv/color
  // ⚠️ نرمال‌سازی index: Extrude غیر-indexed است، Box/Cylinder indexed —
  //   merge سه‌جی‌اس فقط با «همه indexed» یا «هیچ‌کدام» کار می‌کند → همه non-indexed
  const withColor = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    if (!g.getAttribute('color')) {
      const c = lin(p.color);
      const n = g.getAttribute('position').count;
      const arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2];
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    // حذف صفت‌های اضافی برای merge یکنواخت
    for (const key of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv', 'color'].includes(key)) g.deleteAttribute(key);
    }
    if (!g.getAttribute('uv')) {
      const n = g.getAttribute('position').count;
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    }
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(withColor, false);
  if (!merged) throw new Error('mergeGeometries failed');
  merged.clearGroups();
  return merged;
}

/** بدنه اکسترودشده از نیم‌رخ (جلو = -Z) */
export function buildBodyGeometry(variant: VehicleVariant, bevelSegments = 3): THREE.BufferGeometry {
  const spec = VEHICLE_SPECS[variant];
  const profile = PROFILES[variant];
  const shape = new THREE.Shape();
  shape.moveTo(profile[0][0], profile[0][1]);
  for (let i = 1; i < profile.length; i++) shape.lineTo(profile[i][0], profile[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: spec.wid - 10,
    bevelEnabled: true,
    bevelThickness: 4,
    bevelSize: 5,
    bevelSegments,
    curveSegments: 4,
  });
  geo.rotateY(-Math.PI / 2);
  geo.translate((spec.wid - 10) / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

export interface VehicleParts {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  trim: THREE.BufferGeometry;
  bumpersF: THREE.BufferGeometry;
  bumpersR: THREE.BufferGeometry;
  wheels: THREE.BufferGeometry[];        // [fl, fr, rl, rr] — هندسه در مبدأ چرخ
  wheelPos: Array<[number, number, number]>; // جای چرخ‌ها در فضای خودرو
  lightsF: THREE.BufferGeometry;
  lightsR: THREE.BufferGeometry;
  plate: THREE.BufferGeometry;
  extras: Map<string, THREE.BufferGeometry>;
}

/**
 * ساخت همه قطعات یک واریانت
 * @param opts.lod1 نسخه ساده‌شده (بدون جزئیات ریز) برای LOD
 */
export function buildVehicleParts(variant: VehicleVariant, opts: { lod1?: boolean } = {}): VehicleParts {
  const spec = VEHICLE_SPECS[variant];
  const s = spec;
  const lod1 = opts.lod1 === true;
  const [gz0, gz1, gy0, gy1] = GLASS_BAND[variant];
  const bandH = gy1 - gy0;
  const bandLen = gz1 - gz0;
  const midZ = (gz0 + gz1) / 2;
  const wid = s.wid;

  // ---------- بدنه ----------
  const body = buildBodyGeometry(variant, lod1 ? 2 : 3);

  // ---------- شیشه (باند کناری + جلو کج + عقب) ----------
  const glassParts: Part[] = [
    box(wid + 1.5, bandH, bandLen, PART_COLORS.glass, 0, (gy0 + gy1) / 2, midZ),
    box(wid * 0.86, bandH + 8, 6, PART_COLORS.glass, 0, (gy0 + gy1) / 2 + 2, gz0 - 4, 0.42),
    box(wid * 0.84, bandH + 6, 6, PART_COLORS.glass, 0, (gy0 + gy1) / 2 + 3, gz1 + 5, variant === 'nissan' ? -0.15 : -0.38),
  ];
  const glass = mergeParts(glassParts);

  // ---------- تریم (جلوپنجره/آینه/دستگیره/اگزوز/خط در/آنتن/باربند/نوارها) ----------
  const trimParts: Part[] = [
    // جلوپنجره کروم
    box(wid * (variant === 'samand' || variant === 'police' || variant === 'nissan' ? 0.56 : 0.4), 9, 4, PART_COLORS.chrome, 0, 44, PROFILES[variant][0][0] - 2.5),
    // اگزوز
    cyl(4, 4, 12, 8, PART_COLORS.chrome, wid * 0.26, 15, PROFILES[variant][PROFILES[variant].length - 1][0] + 6, Math.PI / 2),
  ];
  if (!lod1) {
    // خط در + دستگیره
    const seamLen = bandLen * 0.42;
    for (const zz of [gz0 + bandLen * 0.42, gz1 - bandLen * 0.05]) {
      for (const sx of [-wid / 2 - 0.4, wid / 2 + 0.4]) {
        trimParts.push(box(1.6, gy0 - 26, seamLen, PART_COLORS.trim, sx, 26 + (gy0 - 26) / 2, zz));
      }
    }
    for (const sx of [-wid / 2 - 1.2, wid / 2 + 1.2]) {
      for (const zz of [gz0 + bandLen * 0.55, gz1 - bandLen * 0.18]) {
        trimParts.push(box(2.2, 3.2, 12, PART_COLORS.chrome, sx, gy0 - 6, zz));
      }
    }
    // آینه‌ها
    for (const sx of [-wid / 2 - 5, wid / 2 + 5]) {
      trimParts.push(box(10, 7, 8, PART_COLORS.trim, sx, gy0 + 4, gz0 + 6));
    }
  }

  // ---------- واریانت‌های خاص (نوارها/علامت‌ها) ----------
  const extras = new Map<string, THREE.BufferGeometry>();
  const topY = gy1 + 6;
  if (variant === 'taxi') {
    // علامت تاکسی + نوار شطرنجی + آنتن — همه در trim یا extras
    trimParts.push(box(wid * 0.34, 6, bandLen * 0.9, PART_COLORS.taxiCheck, 0, 34, midZ));
    extras.set('taxi_sign', mergeParts([
      box(wid * 0.34, 15, 24, PART_COLORS.trim, 0, topY + 6, midZ),
      box(wid * 0.30, 10, 20, '#f5e9c8', 0, topY + 8, midZ + 1),
    ]));
    trimParts.push(box(3.2, 32, 3.2, PART_COLORS.trim, -wid * 0.3, topY + 14, gz1 - 8));
  } else if (variant === 'police') {
    trimParts.push(box(wid + 1, 12, s.len * 0.55, PART_COLORS.policeStripe, 0, 40, midZ));
    extras.set('lightbar_base', mergeParts([
      box(wid * 0.5, 4, 16, PART_COLORS.trim, 0, topY + 2, midZ),
    ]));
    extras.set('lightbar_red', mergeParts([
      box(wid * 0.2, 9, 14, '#ff2d2d', -wid * 0.13, topY + 8, midZ),
    ]));
    extras.set('lightbar_blue', mergeParts([
      box(wid * 0.2, 9, 14, '#2d6bff', wid * 0.13, topY + 8, midZ),
    ]));
  } else if (variant === 'player') {
    const stripeMatZ: Array<[number, number]> = [
      [PROFILES[variant][0][0] + 34, 53],
      [midZ, topY + 1],
      [PROFILES[variant][PROFILES[variant].length - 1][0] - 24, 53],
    ];
    for (const [zz, yy] of stripeMatZ) {
      trimParts.push(box(wid * 0.15, 2.5, 34, PART_COLORS.playerStripe, 0, yy, zz));
    }
    trimParts.push(box(3.2, 34, 3.2, PART_COLORS.trim, wid * 0.3, topY + 15, gz1 - 10));
    // داخل کابین (فقط بازیکن — دوربین پشت می‌بیند)
    const interior: Part[] = [
      box(wid * 0.62, 12, 14, PART_COLORS.seat, -wid * 0.16, gy0 + 6, midZ + 14),
      box(wid * 0.62, 12, 14, PART_COLORS.seat, wid * 0.18, gy0 + 6, midZ + 14),
      box(wid * 0.7, 10, 10, PART_COLORS.interior, 0, gy0 + 4, gz0 + 12),
      cyl(11, 11, 4, 12, PART_COLORS.trim, -wid * 0.16, gy0 + 10, gz0 + 18, 1.1),
    ];
    extras.set('interior', mergeParts(interior));
  } else if (variant === 'pride' || variant === 'peugeot405') {
    // باربند برای برخی (به‌صورت extras جدا — ران‌تایم ۳۰٪ اضافه می‌کند)
    extras.set('roofrack', mergeParts([
      box(wid * 0.7, 5, bandLen * 0.6, PART_COLORS.chrome, 0, topY + 3, midZ),
      box(wid * 0.7, 8, 4, PART_COLORS.chrome, 0, topY, gz0 + bandLen * 0.22),
      box(wid * 0.7, 8, 4, PART_COLORS.chrome, 0, topY, gz1 - bandLen * 0.22),
    ]));
  }

  const trim = mergeParts(trimParts);

  // ---------- سپرها (جداشدنی) ----------
  const bumperGeoF = mergeParts([box(wid + 6, 14, 12, PART_COLORS.trim, 0, 24, PROFILES[variant][0][0] - 4)]);
  const bumperGeoR = mergeParts([box(wid + 6, 14, 12, PART_COLORS.trim, 0, 24, PROFILES[variant][PROFILES[variant].length - 1][0] + 4)]);

  // ---------- چرخ‌ها [fl, fr, rl, rr] — هندسه در مبدأ، جای چرخ جدا ----------
  const tireW = wid * 0.16;
  const wr = s.wheelR;
  const makeWheel = (): THREE.BufferGeometry => {
    const tire = new THREE.TorusGeometry(wr - tireW / 2 + 2, tireW / 2, lod1 ? 6 : 9, lod1 ? 10 : 16);
    tire.rotateY(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(wr * 0.52, wr * 0.52, tireW * 0.75, lod1 ? 8 : 12);
    rim.rotateZ(Math.PI / 2);
    rim.translate(Math.sign(1) * tireW * 0.12, 0, 0);
    return mergeParts([
      { geo: tire, color: PART_COLORS.tire },
      { geo: rim, color: PART_COLORS.rim },
    ]);
  };
  const axleFz = -s.len * s.axleF;
  const axleRz = s.len * s.axleR;
  const wheelGeo = makeWheel();
  const wheels = [wheelGeo, wheelGeo.clone(), wheelGeo.clone(), wheelGeo.clone()];
  const wheelPos: Array<[number, number, number]> = [
    [-wid / 2 + tireW * 0.1, wr, axleFz],
    [wid / 2 - tireW * 0.1, wr, axleFz],
    [-wid / 2 + tireW * 0.1, wr, axleRz],
    [wid / 2 - tireW * 0.1, wr, axleRz],
  ];

  // ---------- چراغ‌ها ----------
  const lightGeoF = mergeParts([
    box(wid * 0.2, 9, 4, PART_COLORS.lightF, -wid * 0.33, 44, PROFILES[variant][0][0] - 3),
    box(wid * 0.2, 9, 4, PART_COLORS.lightF, wid * 0.33, 44, PROFILES[variant][0][0] - 3),
  ]);
  const lightGeoR = mergeParts([
    box(wid * 0.2, 9, 4, PART_COLORS.lightR, -wid * 0.33, 46, PROFILES[variant][PROFILES[variant].length - 1][0] + 3),
    box(wid * 0.2, 9, 4, PART_COLORS.lightR, wid * 0.33, 46, PROFILES[variant][PROFILES[variant].length - 1][0] + 3),
  ]);

  // ---------- پلاک ----------
  const plate = mergeParts([
    box(wid * 0.3, 9.5, 2, PART_COLORS.plate, 0, 15, PROFILES[variant][PROFILES[variant].length - 1][0] + 6),
    box(wid * 0.3, 3, 2.2, PART_COLORS.plateBlue, 0, 18.2, PROFILES[variant][PROFILES[variant].length - 1][0] + 6.05),
  ]);

  return { body, glass, trim, bumpersF: bumperGeoF, bumpersR: bumperGeoR, wheels, wheelPos, lightsF: lightGeoF, lightsR: lightGeoR, plate, extras };
}

/**
 * merge کامل خودرو برای دوبله‌پارکی (یک مش — InstancedMesh با instanceColor)
 * رنگ بدنه سفید می‌ماند تا instanceColor آن را رنگ کند؛ بقیه قطعات رنگ ثابت دارند.
 */
export function buildParkedGeometry(variant: VehicleVariant, opts: { roofRack?: boolean; lod1?: boolean } = {}): THREE.BufferGeometry {
  const p = buildVehicleParts(variant, opts);
  const parts: Array<{ geo: THREE.BufferGeometry; color: string }> = [
    { geo: p.body, color: '#ffffff' },
    { geo: p.glass, color: PART_COLORS.glass },
    { geo: p.trim, color: PART_COLORS.trim },
    { geo: p.bumpersF, color: PART_COLORS.trim },
    { geo: p.bumpersR, color: PART_COLORS.trim },
  ];
  // چرخ‌ها با جای خودشان merge می‌شوند (خودرو ایستاده است — چرخش ندارد)
  const wheelParts: Part[] = p.wheels.map((geo, i) => {
    const g = geo.clone();
    const [wx, wy, wz] = p.wheelPos[i];
    g.translate(wx, wy, wz);
    return { geo: g, color: PART_COLORS.tire };
  });
  parts.push(...wheelParts);
  parts.push(
    { geo: p.lightsF, color: PART_COLORS.lightF },
    { geo: p.lightsR, color: PART_COLORS.lightR },
    { geo: p.plate, color: PART_COLORS.plate },
  );
  if (opts.roofRack && p.extras.has('roofrack')) {
    parts.push({ geo: p.extras.get('roofrack')!, color: PART_COLORS.chrome });
  }
  if (variant === 'taxi') {
    parts.push({ geo: p.extras.get('taxi_sign')!, color: PART_COLORS.trim });
    parts.push({ geo: new THREE.BoxGeometry(0.01, 0.01, 0.01), color: PART_COLORS.trim }); // نگه‌داشتن فرمت
  }
  return mergeParts(parts);
}
