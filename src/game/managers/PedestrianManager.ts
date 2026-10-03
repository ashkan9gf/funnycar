/**
 * PedestrianManager.ts — عابرهای پیاده (فاز BIG-IR — زندگی خیابان GTA)
 * ============================================================
 * منطق خالص (بدون Three.js): هر عابر روی حلقه پیاده‌روی یک بلوک راه می‌رود.
 *  - مسیر = مستطیل دور بلوک (داخل پیاده‌رو) با پارامتر t
 *  - ماشین با سرعت نزدیک شود → می‌پرد کنار + رویداد ترس (حباب طنز در GameManager)
 *  - همه اعداد از PEDESTRIANS (balance) — قطعی در چیدمان اولیه
 */

import { PEDESTRIANS as P } from '../data/balance';
import { ENDLESS } from '../data/balance';
import { WORLD } from '../world/World';

/** اندازه بلوک = pitch - roadW */
const BLOCK = WORLD.pitch - WORLD.roadW; // 840
/** فاصله مسیر عابر از لبه بلوک (وسط پیاده‌رو) */
const RING_INSET = 52;

export interface Pedestrian {
  x: number;
  y: number;
  /** جهت نگاه (رادیان — قرارداد Vehicle: 0=شمال) */
  angle: number;
  /** بلوک اختصاصی */
  bi: number;
  bj: number;
  /** پارامتر مسیر (0..محیط) */
  t: number;
  /** جهت حرکت روی حلقه: +1/-1 */
  dirSign: number;
  /** سرعت شخصی */
  speed: number;
  /** تایمر پرش ترس (0 = عادی) */
  hopT: number;
  /** جهت فرار (نرمال‌شده) */
  fleeX: number;
  fleeY: number;
  /** سردشدن ترس */
  scareCd: number;
  /** فاز انیمیشن راه رفتن */
  phase: number;
  /** رنگ لباس (اندیس پالت رندر) */
  colorIdx: number;
  // ---------- برخورد با ماشین (فاز SMASH) ----------
  /** تایمر پرواز/چرخش در هوا */
  knockT: number;
  /** تایمر افتادن روی زمین */
  downT: number;
  /** تایمر بلند شدن */
  riseT: number;
  /** سرعت پرتاب */
  kvx: number;
  kvy: number;
  /** زاویه چرخش در هوا */
  spin: number;
  spinRate: number;
}

export interface PedestrianCallbacks {
  /** عابر ترسید — برای حباب/صدا (x, y) */
  onScare?: (x: number, y: number) => void;
}

interface PlayerLike { x: number; y: number; speed: number }

/** مختصات نقطه t از محیط مستطیل (شروع: گوشه بالا-چپ، ساعت‌گرد) */
function ringPos(x0: number, y0: number, x1: number, y1: number, t: number): { x: number; y: number; angle: number } {
  const w = x1 - x0;
  const h = y1 - y0;
  const per = 2 * (w + h);
  let u = ((t % per) + per) % per;
  // لبه بالا: چپ→راست
  if (u < w) return { x: x0 + u, y: y0, angle: Math.PI / 2 };
  u -= w;
  // لبه راست: بالا→پایین
  if (u < h) return { x: x1, y: y0 + u, angle: Math.PI };
  u -= h;
  // لبه پایین: راست→چپ
  if (u < w) return { x: x1 - u, y: y1, angle: -Math.PI / 2 };
  u -= w;
  // لبه چپ: پایین→بالا
  return { x: x0, y: y1 - u, angle: 0 };
}

export class PedestrianManager {
  readonly peds: Pedestrian[] = [];

  constructor(
    private readonly callbacks: PedestrianCallbacks = {},
  ) {
    this.spawnAll();
  }

  private spawnAll(): void {
    for (let i = 0; i < P.count; i++) {
      // پخش قطعی روی بلوک‌های مختلف شهر
      const bi = (i * 5 + 1) % WORLD.roadCount;
      const bj = (i * 3 + 2) % WORLD.roadCount;
      const bx = bi * WORLD.pitch + WORLD.roadW;
      const by = bj * WORLD.pitch + WORLD.roadW;
      const x0 = bx + RING_INSET;
      const y0 = by + RING_INSET;
      const x1 = bx + BLOCK - RING_INSET;
      const y1 = by + BLOCK - RING_INSET;
      const t = (i * 467) % (2 * ((x1 - x0) + (y1 - y0))); // پراکندگی روی حلقه
      const pos = ringPos(x0, y0, x1, y1, t);
      this.peds.push({
        x: pos.x,
        y: pos.y,
        angle: pos.angle,
        bi, bj,
        t,
        dirSign: i % 2 === 0 ? 1 : -1,
        speed: P.walkSpeed * (0.85 + ((i * 37) % 30) / 100),
        hopT: 0,
        fleeX: 0,
        fleeY: 0,
        scareCd: 0,
        phase: (i * 1.7) % (Math.PI * 2),
        colorIdx: i % 6,
        knockT: 0,
        downT: 0,
        riseT: 0,
        kvx: 0,
        kvy: 0,
        spin: 0,
        spinRate: 0,
      });
    }
  }

  update(dt: number, player: PlayerLike): void {
    const recycle2 = ENDLESS.pedRecycleDist * ENDLESS.pedRecycleDist;
    for (const ped of this.peds) {
      // ---------- بازیافت بی‌پایان: دور از بازیکن → بلوک نزدیک بازیکن ----------
      // (بلوک مقصد همیشه روی شبکهٔ جهانی است — چیدمان حلقه یکسان)
      const pdx = ped.x - player.x;
      const pdy = ped.y - player.y;
      if (pdx * pdx + pdy * pdy > recycle2 && ped.knockT <= 0 && ped.downT <= 0) {
        const pi = Math.round((player.x - WORLD.roadW) / WORLD.pitch);
        const pj = Math.round((player.y - WORLD.roadW) / WORLD.pitch);
        ped.bi = pi + Math.floor(Math.random() * 5) - 2;
        ped.bj = pj + Math.floor(Math.random() * 5) - 2;
        ped.t = Math.random() * 4000;
        ped.hopT = 0;
        continue;
      }
      // ---------- پرتاب با ضربه ماشین (فاز SMASH) ----------
      if (ped.knockT > 0) {
        ped.knockT -= dt;
        ped.x += ped.kvx * dt;
        ped.y += ped.kvy * dt;
        ped.kvx *= 1 - 1.9 * dt;
        ped.kvy *= 1 - 1.9 * dt;
        ped.spin += ped.spinRate * dt;
        if (ped.knockT <= 0) ped.downT = P.downSec;
        continue;
      }
      if (ped.downT > 0) {
        ped.downT -= dt;
        if (ped.downT <= 0) ped.riseT = P.riseSec;
        continue;
      }
      if (ped.riseT > 0) {
        ped.riseT -= dt;
        if (ped.riseT <= 0) {
          // بلند شد — فرار به سمت بیرون حلقه و ادامه مسیر
          ped.hopT = P.hopSec;
          const dx = ped.x - player.x;
          const dy = ped.y - player.y;
          const d = Math.hypot(dx, dy) || 1;
          ped.fleeX = dx / d;
          ped.fleeY = dy / d;
          ped.scareCd = P.scareCooldownSec;
        }
        continue;
      }

      const bx = ped.bi * WORLD.pitch + WORLD.roadW;
      const by = ped.bj * WORLD.pitch + WORLD.roadW;
      const x0 = bx + RING_INSET;
      const y0 = by + RING_INSET;
      const x1 = bx + BLOCK - RING_INSET;
      const y1 = by + BLOCK - RING_INSET;

      // ---------- راه رفتن ----------
      if (ped.hopT <= 0) {
        ped.t += ped.dirSign * ped.speed * dt;
        const pos = ringPos(x0, y0, x1, y1, ped.t);
        ped.x = pos.x;
        ped.y = pos.y;
        ped.angle = pos.angle;
        if (ped.dirSign < 0) ped.angle += Math.PI; // خلاف جهت حلقه
      }

      // ---------- پرش ترس ----------
      if (ped.hopT > 0) {
        ped.hopT -= dt;
        // فرار کوتاه به سمت بیرون
        const fleeSpeed = 190;
        ped.x += ped.fleeX * fleeSpeed * dt;
        ped.y += ped.fleeY * fleeSpeed * dt;
      }

      // ---------- ترس از ماشین سریع ----------
      ped.scareCd = Math.max(0, ped.scareCd - dt);
      const dx = ped.x - player.x;
      const dy = ped.y - player.y;
      const d2 = dx * dx + dy * dy;
      if (
        ped.scareCd <= 0 &&
        Math.abs(player.speed) > P.scareSpeed &&
        d2 < P.scareRadius * P.scareRadius
      ) {
        const d = Math.sqrt(d2) || 1;
        ped.fleeX = dx / d;
        ped.fleeY = dy / d;
        ped.hopT = P.hopSec;
        ped.scareCd = P.scareCooldownSec;
        this.callbacks.onScare?.(ped.x, ped.y);
      }
    }
  }

  /** پرتاب عابر با ضربه ماشین — جهت = سرعت ماشین، شدت = سرعت (فاز SMASH) */
  knockPed(ped: Pedestrian, vx: number, vy: number, impact: number): void {
    const d = Math.hypot(vx, vy) || 1;
    const power = Math.min(1.7, impact / 280);
    ped.knockT = P.knockSec * (0.85 + power * 0.35);
    ped.kvx = (vx / d) * (170 + 210 * power);
    ped.kvy = (vy / d) * (170 + 210 * power);
    ped.spin = 0;
    ped.spinRate = (Math.random() - 0.5) * 22;
    ped.hopT = 0;
  }
}
