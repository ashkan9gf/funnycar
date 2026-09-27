/**
 * TrafficCar.ts — خودروی ترافیک با AI ساده شبکه جاده (فاز 2)
 * ============================================================
 * - روی لاینِ درستِِ دست‌راست حرکت می‌کند (ایران: فرمان چپ، تردد دست‌راست)
 * - در تقاطع تصمیم می‌گیرد: مستقیم / راست / چپ (از TrafficManager)
 * - «سرعت مطلوب» را از مدیر می‌گیرد (ترمز پشت مانع) و خودش شتاب/ترمز می‌کند
 * - هندسه جاده در TrafficManager است تا این کلاس فقط فیزیک بداند
 */

import { TRAFFIC } from '../data/balance';

export type TrafficDir = 'N' | 'E' | 'S' | 'W';

/** بردار و زاویه هدف هر جهت — angle با قرارداد Vehicle (0=شمال) */
export const DIR_INFO: Record<TrafficDir, { x: number; y: number; angle: number }> = {
  N: { x: 0, y: -1, angle: 0 },
  E: { x: 1, y: 0, angle: Math.PI / 2 },
  S: { x: 0, y: 1, angle: Math.PI },
  W: { x: -1, y: 0, angle: -Math.PI / 2 },
};

export class TrafficCar {
  x = 0;
  y = 0;
  angle = 0;
  /** سرعت فعلی px/s */
  speed = 0;
  /** سرعت کروز شخصی این ماشین */
  cruise: number = TRAFFIC.cruiseSpeed;
  /** شناسه Asset در manifest */
  assetId = 'veh_sedan_01';
  drawW = TRAFFIC.drawW;
  drawH = Math.round(TRAFFIC.drawW * 1.75);
  /** جهت فعلی حرکت */
  dir: TrafficDir = 'N';

  /** مکث پس از برخورد با بازیکن (ثانیه) */
  stunned = 0;
  /** چند ثانیه است پشت مانع گیر کرده (برای بوق) */
  blockedSec = 0;
  /** در همینepisode گیر، بوق زده؟ */
  honkedThisBlock = false;

  // ---------- وضعیت روی شبکه جاده ----------
  /** N/S: شماره جاده عمودی | E/W: شماره جاده افقی */
  roadIndex = 0;
  /** شماره گره (تقاطع) بعدی روی محور حرکت (0..roadCount) */
  nodeIndex = 0;
  /** مختصات ثابت لاین (محور عمود بر حرکت) */
  lane = 0;
  /** تصمیم برای گره فعلی گرفته شد؟ */
  decided = false;
  /** اگر تصمیم «پیچ» است: نقطه اجرای پیچ روی محور حرکت */
  pendingTrigger = Number.NaN;
  /** اگر تصمیم «پیچ» است: جهت مقصد */
  pendingDir: TrafficDir | null = null;

  get hitW(): number { return this.drawW * 0.8; }
  get hitH(): number { return this.drawH * 0.85; }

  setDir(d: TrafficDir, angleSnap = false): void {
    this.dir = d;
    if (angleSnap) this.angle = DIR_INFO[d].angle;
  }

  /** برخورد خورد → چند ثانیه می‌ایستد */
  stun(sec: number): void {
    this.stunned = Math.max(this.stunned, sec);
    this.honkedThisBlock = true; // بعد از برخورد بوق اعصاب نمی‌زند
  }

  /**
   * یک گام فیزیک — desiredSpeed را مدیر تعیین می‌کند (0 = ایست پشت مانع)
   */
  update(dt: number, desiredSpeed: number): void {
    // نرم شدن زاویه به سمت جهت هدف (پیچ‌های بصری)
    const target = DIR_INFO[this.dir].angle;
    let diff = target - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.angle += diff * Math.min(1, 7 * dt);

    if (this.stunned > 0) {
      this.stunned -= dt;
      this.speed = Math.max(0, this.speed - TRAFFIC.brakePower * dt);
      return;
    }

    // شتاب / ترمز تا سرعت مطلوب
    if (this.speed < desiredSpeed) {
      this.speed = Math.min(desiredSpeed, this.speed + TRAFFIC.accel * dt);
    } else if (this.speed > desiredSpeed) {
      this.speed = Math.max(desiredSpeed, this.speed - TRAFFIC.brakePower * dt);
    }

    // حرکت روی محور جهت
    const v = DIR_INFO[this.dir];
    this.x += v.x * this.speed * dt;
    this.y += v.y * this.speed * dt;

    // قفل نرم روی مرکز لاین
    if (v.x === 0) this.x += (this.lane - this.x) * Math.min(1, 5 * dt);
    else this.y += (this.lane - this.y) * Math.min(1, 5 * dt);
  }
}
