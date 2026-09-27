/**
 * CarFactory3D.ts — ساخت ماشین Low-Poly رویه‌ای (فاز 3D)
 * ============================================================
 * ماشین رو به -Z ساخته می‌شود (شمال = angle صفر قرارداد Vehicle).
 * چرخش در دنیا: group.rotation.y = -angle
 * واریانت‌ها هم‌رنگ Assetهای دوبعدی: بازیکن سفید، تاکسی زرد، سدان آبی،
 * وانت خاکستری، پلیس سفید با چراغ‌گردان.
 */

import * as THREE from 'three';

export type CarVariant = 'player' | 'taxi' | 'sedan' | 'pickup' | 'police';

export interface CarModel3D {
  group: THREE.Group;
  /** چرخ‌ها برای انیمیشن چرخش (rotation.x با سرعت) */
  wheels: THREE.Mesh[];
  /** رنگ بدنه برای ذرات/جلوه‌ها */
  bodyColor: string;
}

/** متریال‌های مشترک (ساخته یک‌بار) */
let glassMat: THREE.MeshLambertMaterial | null = null;
let tireMat: THREE.MeshLambertMaterial | null = null;
let hubMat: THREE.MeshLambertMaterial | null = null;
let darkMat: THREE.MeshLambertMaterial | null = null;
let headMat: THREE.MeshBasicMaterial | null = null;
let tailMat: THREE.MeshBasicMaterial | null = null;

let wheelGeo: THREE.CylinderGeometry | null = null;
let hubGeo: THREE.CylinderGeometry | null = null;

function ensureShared(): void {
  if (glassMat) return;
  glassMat = new THREE.MeshLambertMaterial({ color: '#2e3d4d' });
  tireMat = new THREE.MeshLambertMaterial({ color: '#23211f' });
  hubMat = new THREE.MeshLambertMaterial({ color: '#c9c4ba' });
  darkMat = new THREE.MeshLambertMaterial({ color: '#3a2e2a' });
  headMat = new THREE.MeshBasicMaterial({ color: '#fff3c2' });
  tailMat = new THREE.MeshBasicMaterial({ color: '#e2574c' });
  wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  wheelGeo.rotateZ(Math.PI / 2); // محور چرخش = X
  hubGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  hubGeo.rotateZ(Math.PI / 2);
}

const VARIANTS: Record<CarVariant, { body: string; roof: string; accent?: string }> = {
  player: { body: '#f4f4f0', roof: '#f4f4f0', accent: '#e2574c' },
  taxi: { body: '#f2c230', roof: '#f2c230', accent: '#3a2e2a' },
  sedan: { body: '#4a90d9', roof: '#4a90d9' },
  pickup: { body: '#97a2b3', roof: '#97a2b3', accent: '#5f6a75' },
  police: { body: '#f7f7f2', roof: '#f7f7f2', accent: '#2e3d4d' },
};

/** ساخت ماشین Low-Poly — W عرض، L طول (از drawW/drawH دوبعدی) */
export function buildCar3D(variant: CarVariant, W: number, L: number): CarModel3D {
  ensureShared();
  const spec = VARIANTS[variant];
  const bodyMat = new THREE.MeshLambertMaterial({ color: spec.body });
  const roofMat = new THREE.MeshLambertMaterial({ color: spec.roof });
  const accentMat = new THREE.MeshLambertMaterial({ color: spec.accent ?? '#3a2e2a' });

  const g = new THREE.Group();
  const wheelR = L * 0.135;

  // ---------- بدنه ----------
  const bodyH = L * 0.30;
  const bodyY = wheelR * 0.9 + bodyH / 2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(W, bodyH, L), bodyMat);
  body.position.y = bodyY;
  body.castShadow = true;
  g.add(body);

  // سپرها (جلو -Z / عقب +Z)
  const bumperGeo = new THREE.BoxGeometry(W * 0.96, bodyH * 0.42, L * 0.055);
  for (const z of [-L / 2 - L * 0.02, L / 2 + L * 0.02]) {
    const b = new THREE.Mesh(bumperGeo, darkMat as THREE.MeshLambertMaterial);
    b.position.set(0, bodyY - bodyH * 0.22, z);
    b.castShadow = true;
    g.add(b);
  }

  // ---------- کابین ----------
  const cabW = W * 0.8;
  const cabH = bodyH * 0.72;
  const cabL = L * 0.42;
  const isPickup = variant === 'pickup';
  // وانت کابین جلوتر؛ بقیه وسط-عقب
  const cabZ = isPickup ? L * 0.12 : -L * 0.02;
  const glass = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabL), glassMat as THREE.MeshLambertMaterial);
  glass.position.set(0, bodyY + bodyH / 2 + cabH / 2, cabZ);
  glass.castShadow = true;
  g.add(glass);
  // سقف
  const roofTh = cabH * 0.42;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cabW * 1.02, roofTh, cabL * 0.94), roofMat);
  roof.position.set(0, glass.position.y + cabH / 2 - roofTh / 2 + roofTh / 2, cabZ);
  roof.position.y = glass.position.y + cabH / 2 - roofTh / 2;
  roof.castShadow = true;
  g.add(roof);

  // ---------- واریانت‌ها ----------
  if (variant === 'taxi') {
    // علامت تاکسی روی سقف
    const sign = new THREE.Mesh(new THREE.BoxGeometry(W * 0.34, bodyH * 0.2, L * 0.09), new THREE.MeshLambertMaterial({ color: '#fff9ec' }));
    sign.position.set(0, roof.position.y + roofTh / 2 + bodyH * 0.12, cabZ);
    g.add(sign);
  } else if (variant === 'police') {
    // چراغ‌گردان قرمز/آبی
    const barY = roof.position.y + roofTh / 2 + bodyH * 0.1;
    const red = new THREE.Mesh(new THREE.BoxGeometry(W * 0.2, bodyH * 0.16, L * 0.08), new THREE.MeshBasicMaterial({ color: '#e2574c' }));
    red.position.set(-W * 0.12, barY, cabZ);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(W * 0.2, bodyH * 0.16, L * 0.08), new THREE.MeshBasicMaterial({ color: '#3f7fd4' }));
    blue.position.set(W * 0.12, barY, cabZ);
    g.add(red, blue);
    // نوار تیره کنار بدنه
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, bodyH * 0.3, L * 0.5), accentMat);
    stripe.position.set(0, bodyY - bodyH * 0.1, -L * 0.02);
    g.add(stripe);
  } else if (variant === 'pickup') {
    // بدنه بار باز (سه دیواره کوتاه عقب)
    const bedL = L * 0.4;
    const bedH = bodyH * 0.5;
    const bedZ = L * 0.26;
    const wallGeo = new THREE.BoxGeometry(W * 0.94, bedH, bedL);
    const bedBack = new THREE.Mesh(wallGeo, accentMat);
    bedBack.position.set(0, bodyY + bodyH / 2 + bedH / 2 - bedH * 0.15, bedZ + bedL / 2 - L * 0.02);
    const sideGeo = new THREE.BoxGeometry(W * 0.06, bedH, bedL);
    for (const x of [-W * 0.44, W * 0.44]) {
      const side = new THREE.Mesh(sideGeo, accentMat);
      side.position.set(x, bedBack.position.y, bedZ);
      side.castShadow = true;
      g.add(side);
    }
    bedBack.castShadow = true;
    g.add(bedBack);
  } else if (variant === 'player') {
    // نوار قرمز ورزشی روی سقف و کاپوت
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(W * 0.16, bodyH * 0.06, L * 0.94), accentMat);
    stripe.position.set(0, bodyY + bodyH / 2 + 1, 0);
    g.add(stripe);
  }

  // ---------- چراغ‌ها ----------
  const lightGeo = new THREE.BoxGeometry(W * 0.18, bodyH * 0.2, L * 0.03);
  for (const x of [-W * 0.32, W * 0.32]) {
    const h = new THREE.Mesh(lightGeo, headMat as THREE.MeshBasicMaterial);
    h.position.set(x, bodyY + bodyH * 0.08, -L / 2 - L * 0.015);
    const t = new THREE.Mesh(lightGeo, tailMat as THREE.MeshBasicMaterial);
    t.position.set(x, bodyY + bodyH * 0.08, L / 2 + L * 0.015);
    g.add(h, t);
  }

  // ---------- چرخ‌ها ----------
  const wheels: THREE.Mesh[] = [];
  const tireW = W * 0.14;
  for (const x of [-W / 2 + tireW * 0.2, W / 2 - tireW * 0.2]) {
    for (const z of [-L * 0.3, L * 0.3]) {
      const tire = new THREE.Mesh(wheelGeo as THREE.CylinderGeometry, tireMat as THREE.MeshLambertMaterial);
      tire.scale.set(wheelR, tireW, wheelR);
      tire.position.set(x, wheelR, z);
      tire.castShadow = true;
      // کلاهک چرخ — فرزندِ گروه، نه فرزندِ چرخِ اسکیل‌شده!
      // (اگر فرزند تایر باشد اسکیل‌ها ضرب می‌شوند و کلاهک غول‌پیکر می‌شود)
      const hub = new THREE.Mesh(hubGeo as THREE.CylinderGeometry, hubMat as THREE.MeshLambertMaterial);
      hub.scale.set(wheelR * 0.5, tireW * 1.04, wheelR * 0.5);
      hub.position.set(x + Math.sign(x) * tireW * 0.3, wheelR, z);
      wheels.push(tire);
      g.add(tire, hub);
    }
  }

  return { group: g, wheels, bodyColor: spec.body };
}

/** استخراج واریانت از assetId ترافیک */
export function variantFromAssetId(assetId: string): CarVariant {
  if (assetId.includes('taxi')) return 'taxi';
  if (assetId.includes('police')) return 'police';
  if (assetId.includes('pickup')) return 'pickup';
  return 'sedan';
}
