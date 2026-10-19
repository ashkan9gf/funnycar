/**
 * StreetProps3D.ts — پراپ‌های خیابان ایرانی (فاز GTA-IR)
 * ============================================================
 * سازنده‌های Low-Poly برای بوی «خیابان ایران»:
 *  - پشت‌بام: ظرف ماهواره + منبع آب آبی + آنتن چتری + کولر
 *  - تابلوی خیابان (ولیعصر، انقلاب، آزادی، شریعتی!)
 *  - ایستگاه اتوبوس، دست‌فروش با چتر، موتور پارک‌شده
 *  - پلاستیک‌های زباله کنار جدول، بیلبورد طنز، سرعت‌گیر
 * همه بدون برخورد سخت (به‌جز ایستگاه/دست‌فروش) تا گیم‌پلی روان بماند.
 */

import * as THREE from 'three';
import {
  getBillboardTexture, getBusStopTexture, getSpeedBumpTexture, getStreetSignTexture, getBannerTexture,
} from './textures3d';

// ---------- متریال‌های مشترک ----------
const M = {
  metal: new THREE.MeshLambertMaterial({ color: '#8D99AE' }),
  dark: new THREE.MeshLambertMaterial({ color: '#3a2e2a' }),
  pole: new THREE.MeshLambertMaterial({ color: '#6f7a86' }),
  tankBlue: new THREE.MeshLambertMaterial({ color: '#2e86c1' }),
  dish: new THREE.MeshLambertMaterial({ color: '#e8e4da' }),
  bag: new THREE.MeshLambertMaterial({ color: '#23211f' }),
  cloth: new THREE.MeshLambertMaterial({ color: '#e2574c' }),
  clothStripe: new THREE.MeshLambertMaterial({ color: '#FFF9EC' }),
  wood: new THREE.MeshLambertMaterial({ color: '#a5763f' }),
  crate: new THREE.MeshLambertMaterial({ color: '#c98d4b' }),
  fruit: [
    new THREE.MeshLambertMaterial({ color: '#e2574c' }), // سیب قرمز
    new THREE.MeshLambertMaterial({ color: '#F2B705' }), // پرتقال
    new THREE.MeshLambertMaterial({ color: '#8AC926' }), // سبزه
  ],
};

/** خوشه پشت‌بام روی ساختمان: ماهواره + منبع آب + آنتن + کولر */
export function buildRooftopCluster(w: number, d: number, seed: number): THREE.Group {
  const g = new THREE.Group();
  // شبه‌تصادفی قطعی (بر اساس seed ساختمان)
  let s = seed % 1000;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;

  // ظرف ماهواره (دیسک کج روی پایه)
  const dishR = 14 + rnd() * 6;
  const dish = new THREE.Mesh(new THREE.CircleGeometry(dishR, 12), M.dish);
  dish.rotation.x = -Math.PI / 2.6;
  dish.rotation.y = rnd() * Math.PI * 2;
  const dishArm = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 12, 6), M.metal);
  dishArm.position.y = 6;
  const dishGrp = new THREE.Group();
  dishGrp.add(dishArm, dish);
  dish.position.y = 12;
  dishGrp.position.set(-w * 0.28 + rnd() * w * 0.2, 0, -d * 0.28 + rnd() * d * 0.2);
  g.add(dishGrp);

  // منبع آب پلاستیکی آبی (آیکون پشت‌بام ایران!)
  if (rnd() > 0.25) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(16, 14, 26, 10), M.tankBlue);
    tank.position.set(w * 0.26 - rnd() * w * 0.2, 15, d * 0.26 - rnd() * d * 0.2);
    tank.castShadow = true;
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(12, 14, 6, 10), M.dark);
    stand.position.copy(tank.position);
    stand.position.y = 3;
    g.add(tank, stand);
  }

  // آنتن چتری (میله + بازوهای افقی)
  if (rnd() > 0.3) {
    const ant = new THREE.Group();
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 52, 6), M.metal);
    mast.position.y = 26;
    ant.add(mast);
    for (let i = 0; i < 3; i++) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 26 - i * 5, 5), M.metal);
      bar.rotation.z = Math.PI / 2;
      bar.position.y = 44 - i * 9;
      ant.add(bar);
    }
    ant.position.set(w * 0.1 - rnd() * w * 0.3, 0, d * 0.15 - rnd() * d * 0.3);
    g.add(ant);
  }

  // کولر آبی (جعبه با دریچه‌ها) — نه اسپلیت! کولر آبی اصیل
  if (rnd() > 0.4) {
    const cooler = new THREE.Mesh(new THREE.BoxGeometry(24, 22, 24), M.metal);
    cooler.position.set(-w * 0.1 + rnd() * w * 0.3, 11, d * 0.3 - rnd() * d * 0.2);
    cooler.castShadow = true;
    const vent = new THREE.Mesh(new THREE.BoxGeometry(20, 12, 1), M.dark);
    vent.position.set(cooler.position.x, cooler.position.y, cooler.position.z + 12.5);
    g.add(cooler, vent);
  }

  return g;
}

/** تابلوی نام خیابان روی پایه — قاب فلزی، پشت‌بند و رویهٔ خوانا */
export function buildStreetSign(name: string): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 3.5, 100, 10),
    new THREE.MeshStandardMaterial({ color: '#78858d', metalness: 0.72, roughness: 0.34 }),
  );
  pole.position.y = 50;
  pole.castShadow = true;

  // پشت‌بند تیره کمی بزرگ‌تر از پنل؛ لبهٔ فلزی از زاویهٔ دید هم دیده می‌شود.
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(80, 29, 4.5),
    new THREE.MeshStandardMaterial({ color: '#253d4a', metalness: 0.52, roughness: 0.4 }),
  );
  frame.position.set(0, 94, 0);
  frame.castShadow = true;

  const faceMat = new THREE.MeshStandardMaterial({
    map: getStreetSignTexture(name),
    color: '#ffffff',
    metalness: 0.12,
    roughness: 0.48,
    emissive: '#10212a',
    emissiveIntensity: 0.06,
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(74, 23, 1.2), faceMat);
  board.position.set(0, 94, 2.7);

  // بست‌های کوچک اتصال پنل به پایه.
  const bracketMat = new THREE.MeshStandardMaterial({ color: '#aab4b8', metalness: 0.78, roughness: 0.3 });
  const bracketGeo = new THREE.BoxGeometry(3, 8, 8);
  const leftBracket = new THREE.Mesh(bracketGeo, bracketMat);
  const rightBracket = new THREE.Mesh(bracketGeo, bracketMat);
  leftBracket.position.set(-7, 94, 0);
  rightBracket.position.set(7, 94, 0);
  g.add(pole, frame, board, leftBracket, rightBracket);
  return g;
}

/** ایستگاه اتوبوس — پناهگاه با تابلو و نیمکت */
export function buildBusStop(): THREE.Group {
  const g = new THREE.Group();
  const W = 120;
  // دو ستون + سقف
  const poleGeo = new THREE.CylinderGeometry(3.5, 4, 78, 8);
  for (const x of [-W / 2 + 8, W / 2 - 8]) {
    const p = new THREE.Mesh(poleGeo, M.pole);
    p.position.set(x, 39, 0);
    p.castShadow = true;
    g.add(p);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W, 6, 40), M.dark);
  roof.position.y = 80;
  roof.castShadow = true;
  // پنل عقب شیشه‌ای
  const back = new THREE.Mesh(
    new THREE.BoxGeometry(W - 16, 52, 3),
    new THREE.MeshLambertMaterial({ color: '#9fc4d8', transparent: true, opacity: 0.75 }),
  );
  back.position.set(0, 52, -18);
  // تابلوی ایستگاه
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(64, 22, 3),
    new THREE.MeshLambertMaterial({ map: getBusStopTexture() }),
  );
  sign.position.set(0, 66, -16.5);
  // نیمکت
  const bench = new THREE.Mesh(new THREE.BoxGeometry(W - 30, 6, 14), M.wood);
  bench.position.set(0, 22, -8);
  bench.castShadow = true;
  g.add(roof, back, sign, bench);
  return g;
}

/** گاری دست‌فروش با چتر راه‌راه و جعبه میوه */
export function buildVendorCart(): THREE.Group {
  const g = new THREE.Group();
  // بدنه گاری
  const cart = new THREE.Mesh(new THREE.BoxGeometry(84, 34, 44), M.wood);
  cart.position.y = 44;
  cart.castShadow = true;
  // چرخ‌های بزرگ
  const wheelGeo = new THREE.CylinderGeometry(16, 16, 6, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const x of [-40, 40]) {
    const w = new THREE.Mesh(wheelGeo, M.dark);
    w.position.set(x, 16, 0);
    g.add(w);
  }
  // دسته هل دادن
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 46, 6), M.dark);
  handle.rotation.x = 0.7;
  handle.position.set(46, 52, 14);
  g.add(handle);
  // جعبه‌های میوه
  const crateGeo = new THREE.BoxGeometry(22, 12, 16);
  const fgeo = new THREE.SphereGeometry(5, 8, 6);
  let fi = 0;
  for (let i = 0; i < 3; i++) {
    const crate = new THREE.Mesh(crateGeo, M.crate);
    crate.position.set(-26 + i * 26, 68, 0);
    crate.castShadow = true;
    g.add(crate);
    for (let f = 0; f < 4; f++) {
      const fruit = new THREE.Mesh(fgeo, M.fruit[fi++ % 3]);
      fruit.position.set(-26 + i * 26 + (f % 2) * 10 - 5, 77, (f < 2 ? -4 : 4));
      g.add(fruit);
    }
  }
  // چتر راه‌راه قرمز-سفید
  const umbrella = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 88, 6), M.pole);
  pole.position.y = 44;
  umbrella.add(pole);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(52, 22, 10, 1, true), M.cloth);
  canopy.position.y = 88;
  canopy.castShadow = true;
  umbrella.add(canopy);
  // نوارهای سفید روی چتر
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.ConeGeometry(52, 22, 10, 1, true, (i * 2 * Math.PI) / 10, Math.PI / 10), M.clothStripe);
    seg.position.y = 88;
    umbrella.add(seg);
  }
  umbrella.position.set(0, 52, -8);
  umbrella.rotation.z = 0.12;
  g.add(cart, umbrella);
  return g;
}

/** موتورسیکلت پارک‌شده — Honda CG125 خیابانی */
export function buildMotorcycle(color = '#c0392b'): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  // دو چرخ
  const wGeo = new THREE.CylinderGeometry(11, 11, 5, 12);
  wGeo.rotateZ(Math.PI / 2);
  for (const z of [-24, 24]) {
    const w = new THREE.Mesh(wGeo, M.dark);
    w.position.set(0, 11, z);
    g.add(w);
  }
  // بدنه + باک
  const frame = new THREE.Mesh(new THREE.BoxGeometry(7, 10, 36), M.dark);
  frame.position.y = 17;
  const tank = new THREE.Mesh(new THREE.BoxGeometry(11, 9, 16), bodyMat);
  tank.position.set(0, 24, -6);
  tank.castShadow = true;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(9, 4, 16), M.dark);
  seat.position.set(0, 24, 12);
  // فرمان
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 22, 6), M.metal);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 30, -16);
  // پدال عقب
  const back = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 10), M.metal);
  back.position.set(0, 28, 22);
  g.add(frame, tank, seat, bar, back);
  g.rotation.y = Math.PI / 2; // موتور موازی جدول
  return g;
}

/** توده پلاستیک زباله کنار جدول — سه کیسه سیاه */
export function buildTrashBags(): THREE.Group {
  const g = new THREE.Group();
  const bagGeo = new THREE.SphereGeometry(13, 8, 6);
  const spots: Array<[number, number, number]> = [
    [-12, 10, 0], [10, 12, 4], [2, 9, -10],
  ];
  for (const [x, y, z] of spots) {
    const b = new THREE.Mesh(bagGeo, M.bag);
    b.position.set(x, y, z);
    b.scale.set(1, 0.8, 1);
    b.castShadow = true;
    g.add(b);
  }
  return g;
}

/** بیلبورد بزرگ تبلیغاتی روی دو پایه */
export function buildBillboard(line1: string, line2: string, bg?: string): THREE.Group {
  const g = new THREE.Group();
  const H = 120;
  const poleGeo = new THREE.CylinderGeometry(5, 6, H, 8);
  for (const x of [-56, 56]) {
    const p = new THREE.Mesh(poleGeo, M.pole);
    p.position.set(x, H / 2, 0);
    p.castShadow = true;
    g.add(p);
  }
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(220, 110, 6),
    new THREE.MeshLambertMaterial({ map: getBillboardTexture(line1, line2, bg) }),
  );
  board.position.y = H + 55;
  board.castShadow = true;
  g.add(board);
  return g;
}

/** سرعت‌گیر — باکس راه‌راه زرد/مشکی عرض جاده */
export function buildSpeedBump(length: number): THREE.Group {
  const g = new THREE.Group();
  const tex = getSpeedBumpTexture();
  tex.repeat.set(length / 48, 1);
  const geo = new THREE.BoxGeometry(length, 10, 26);
  // متریال آرایه: بالا بافت‌دار، بقیه زرد
  const mats = [
    new THREE.MeshLambertMaterial({ color: '#e8b83a' }),
    new THREE.MeshLambertMaterial({ color: '#e8b83a' }),
    new THREE.MeshLambertMaterial({ map: tex }), // بالا
    new THREE.MeshLambertMaterial({ color: '#e8b83a' }),
    new THREE.MeshLambertMaterial({ color: '#e8b83a' }),
    new THREE.MeshLambertMaterial({ color: '#e8b83a' }),
  ];
  const bump = new THREE.Mesh(geo, mats);
  bump.position.y = 5;
  bump.receiveShadow = true;
  bump.castShadow = true;
  g.add(bump);
  return g;
}

// ============================================================
// لندمارک‌های تهران (فاز BIG-IR — «نقشه تهران» کارتونی)
// ============================================================

const marbleMat = new THREE.MeshToonMaterial({ color: '#eae4d6' });
const marbleTrim = new THREE.MeshToonMaterial({ color: '#d6cec0' });
const concreteMat = new THREE.MeshToonMaterial({ color: '#ccd3d8' });
const podMat = new THREE.MeshToonMaterial({ color: '#aebfc9' });
const podGlassMat = new THREE.MeshPhongMaterial({ color: '#2c4656', shininess: 120 });

/**
 * برج آزادی — قوس Y معروف با سوراخ طاق (Extrude با hole)
 * در صفحه XZ (پهنا × عمق) — ارتفاع ~360. پایه دو پله دارد.
 */
export function buildAzadiTower(): THREE.Group {
  const g = new THREE.Group();
  // نیم‌رخ بیرونی (ذوزنقه با سر پهن‌تر — امضای برج)
  const shape = new THREE.Shape();
  shape.moveTo(-150, 0);
  shape.lineTo(150, 0);
  shape.lineTo(122, 290);
  shape.lineTo(86, 330);
  shape.lineTo(-86, 330);
  shape.lineTo(-122, 290);
  shape.closePath();
  // طاق داخلی (تیز بالای وسط — مثل { })
  const hole = new THREE.Path();
  hole.moveTo(-58, 0);
  hole.lineTo(-58, 170);
  hole.quadraticCurveTo(-30, 225, 0, 235);
  hole.quadraticCurveTo(30, 225, 58, 170);
  hole.lineTo(58, 0);
  hole.closePath();
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 130,
    bevelEnabled: true,
    bevelThickness: 4,
    bevelSize: 4,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -65); // مرکز عمق
  const body = new THREE.Mesh(geo, marbleMat);
  body.position.y = 0;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // پله‌های پایه (میدان)
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(560, 18, 420), marbleTrim);
  step1.position.y = 9;
  step1.receiveShadow = true;
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(460, 16, 330), marbleTrim);
  step2.position.y = 26;
  step2.receiveShadow = true;
  g.add(step1, step2);
  body.position.y = 42;

  return g;
}

/**
 * برج میلاد — دکل هشت‌ضلعی + سر «نیلوفر» + آنتن بلند
 * بلندترین نقطه نقشه — از همه‌جای تهران بزرگ دیده می‌شود!
 */
export function buildMiladTower(): THREE.Group {
  const g = new THREE.Group();
  const H = 1150;

  // پایه مخروطی (پهن در پایین)
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(30, 62, H, 8), concreteMat);
  shaft.position.y = H / 2;
  shaft.castShadow = true;
  g.add(shaft);

  // سر نیلوفر — کره پخ با نوار شیشه
  const pod = new THREE.Mesh(new THREE.SphereGeometry(95, 14, 10), podMat);
  pod.scale.set(1, 0.66, 1);
  pod.position.y = H + 42;
  pod.castShadow = true;
  g.add(pod);
  const glassBand = new THREE.Mesh(new THREE.CylinderGeometry(88, 88, 52, 14), podGlassMat);
  glassBand.position.y = H + 44;
  g.add(glassBand);
  // سقف سر
  const podTop = new THREE.Mesh(new THREE.CylinderGeometry(52, 78, 34, 12), podMat);
  podTop.position.y = H + 112;
  g.add(podTop);

  // آنتلن بلند
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(5, 11, 300, 8), concreteMat);
  mast.position.y = H + 265;
  g.add(mast);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(8, 8, 6), new THREE.MeshBasicMaterial({ color: '#e2574c' }));
  tip.position.y = H + 420;
  g.add(tip);

  // پایه ساختمان‌های دور سر (هتل/نمایشگاه — دو جعبه)
  const base1 = new THREE.Mesh(new THREE.BoxGeometry(190, 120, 190), concreteMat);
  base1.position.set(150, 60, 150);
  base1.castShadow = true;
  g.add(base1);

  return g;
}

/** جعبه چوبی شکستنی (دور تعمیرگاه‌ها) */
export function buildCrate(): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(56, 50, 56), M.crate);
  box.position.y = 25;
  box.castShadow = true;
  g.add(box);
  // تخته‌های ضربدری
  const plank = new THREE.Mesh(new THREE.BoxGeometry(58, 7, 8), M.wood);
  plank.position.set(0, 25, 29);
  plank.rotation.z = 0.5;
  const plank2 = plank.clone();
  plank2.rotation.z = -0.5;
  g.add(plank, plank2);
  return g;
}

// ============ فاز CITY-BEAUTY — پارک و زندگی رنگی ============

/** حوض/fountain پارک محله — پایه سنگی + آب + ستون وسط */
export function buildFountain(): THREE.Group {
  const g = new THREE.Group();
  const stone = new THREE.MeshLambertMaterial({ color: '#cfc5ae' });
  const water = new THREE.MeshLambertMaterial({ color: '#3fa7c4', transparent: true, opacity: 0.85 });
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(52, 56, 18, 18), stone);
  rim.position.y = 9;
  rim.castShadow = true;
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(46, 46, 4, 18), water);
  pool.position.y = 17;
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(7, 10, 34, 10), stone);
  pillar.position.y = 32;
  pillar.castShadow = true;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(20, 12, 9, 12), stone);
  bowl.position.y = 52;
  bowl.castShadow = true;
  const jet = new THREE.Mesh(new THREE.ConeGeometry(4.5, 22, 8), water);
  jet.position.y = 70;
  g.add(rim, pool, pillar, bowl, jet);
  return g;
}

/** نیمکت پارک — نشیمن چوبی + پایه آهنی */
export function buildBench(): THREE.Group {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(92, 6, 30), M.wood);
  seat.position.y = 22;
  seat.castShadow = true;
  const back = new THREE.Mesh(new THREE.BoxGeometry(92, 22, 5), M.wood);
  back.position.set(0, 36, -14);
  back.rotation.x = 0.14;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(6, 22, 28), M.metal);
  legL.position.set(-38, 11, 0);
  const legR = legL.clone();
  legR.position.x = 38;
  g.add(seat, back, legL, legR);
  return g;
}

/** گلکاری رنگی — خاک + گل‌های کوچک چندرنگ */
export function buildFlowers(seed: number): THREE.Group {
  const g = new THREE.Group();
  const bed = new THREE.Mesh(new THREE.CylinderGeometry(44, 46, 8, 14), new THREE.MeshLambertMaterial({ color: '#5e4327' }));
  bed.position.y = 4;
  g.add(bed);
  const petals = ['#E63946', '#F2B705', '#E2728C', '#ffffff', '#7B5EA7', '#FF8C42'];
  let s = (seed * 7919) % 100000;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9; i++) {
    const c = petals[i % petals.length];
    const fl = new THREE.Mesh(new THREE.SphereGeometry(5.5, 7, 5), new THREE.MeshLambertMaterial({ color: c }));
    const a = rnd() * Math.PI * 2;
    const r = 8 + rnd() * 32;
    fl.position.set(Math.cos(a) * r, 10 + rnd() * 4, Math.sin(a) * r);
    g.add(fl);
  }
  return g;
}

/** بنر خیابانی — دو تیر + پارچه رنگی با متن (بالا جاده — ماشین زیرش رد می‌شود) */
export function buildBanner(text: string, color: string, span: number): THREE.Group {
  const g = new THREE.Group();
  const H = 250;
  const poleGeo = new THREE.CylinderGeometry(5, 6, H, 8);
  const p1 = new THREE.Mesh(poleGeo, M.pole);
  p1.position.set(-span / 2, H / 2, 0);
  p1.castShadow = true;
  const p2 = new THREE.Mesh(poleGeo, M.pole);
  p2.position.set(span / 2, H / 2, 0);
  p2.castShadow = true;
  const clothTex = getBannerTexture(text, color);
  const cloth = new THREE.Mesh(
    new THREE.PlaneGeometry(span * 0.94, 64),
    // Basic — بنر همیشه رنگی و خوانا (سایه ساختمان رویش نمی‌افتد)
    new THREE.MeshBasicMaterial({ map: clothTex, side: THREE.DoubleSide, transparent: true }),
  );
  cloth.position.y = H - 46;
  // پارچه کمی موج — با دو مثلث خمیده ساده می‌ماند
  cloth.rotation.x = 0.06;
  g.add(p1, p2, cloth);
  return g;
}
