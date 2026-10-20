/**
 * TrafficCar.ts — خودروی ترافیک با AI ساده شبکه جاده (فاز 2)
 * ============================================================
 * - روی لاینِ درستِِ دست‌راست حرکت می‌کند (ایران: فرمان چپ، تردد دست‌راست)
 * - در تقاطع تصمیم می‌گیرد: مستقیم / راست / چپ (از TrafficManager)
 * - «سرعت مطلوب» را مدیر می‌گیرد (ترمز پشت مانع) و خودش شتاب/ترمز می‌کند
 * - هندسه جاده در TrafficManager است تا این کلاس فقط فیزیک بداند
 *
 * v0.2.42 — «برخورد طبیعی، بازگشت طبیعی»:
 *  - پرتاب/چرخش ضربه سر جایش است؛ ولی بازیافت دیگر «سِنِپ» نیست:
 *    زاویه و آفست لاین با نرخ راننده‌وار برمی‌گردد (فرمان آرام، نه مگنت!)
 *  - مد تعقیب: normal | pursuit (پلیس) | angry (تاکسی عصبانی)
 */

import { TRAFFIC } from '../data/balance';

/** آستانه «ضربه واقعی» برای چرخش بدنه — هم‌خوان با COLLISION.softCrashSpeed (بدون import چرخشی) */
const COLLISION_SOFT = 90;

export type TrafficDir = 'N' | 'E' | 'S' | 'W';

/** مد رفتاری ترافیک (v0.2.42) */
export type TrafficMode = 'normal' | 'pursuit' | 'angry';

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

  /** مد فعلی — پلیس تعقیب‌چی یا تاکسی عصبانی (v0.2.42) */
  mode: TrafficMode = 'normal';
  /** تایمر مد (تاکسی: باقی‌ماندهٔ قهر؛ پلیس: بی‌اثر) */
  modeTimer = 0;

  /** مکث پس از برخورد با بازیکن (ثانیه) */
  stunned = 0;
  // ---------- پرتاب برخوردی (فاز APK-FIX) ----------
  /** سرعت پرتاب فعلی بر اثر ضربه بازیکن (px/s) — مستقل از AI */
  knockVx = 0;
  knockVy = 0;
  /** چرخش بدنه بر اثر ضربه محکم (rad/s) */
  spinVel = 0;
  /** 🔕 ثانیه‌های ماندهٔ «تازه‌ضربه‌خورده» — در این مدت بازیافت نمیشود (ضد غیب‌شدن جلوی چشم) */
  knockedSec = 0;
  /** چند ثانیه است پشت مانع گیر کرده (برای بوق) */
  blockedSec = 0;
  /** در همینepisode گیر، بوق زده؟ */
  honkedThisBlock = false;
  /** پشت چراغ قرمز ایستاده؟ (فاز GRAPHICS_OVERHAUL — بوق اعصاب ندارد) */
  atLight = false;
  /** 🔕 v0.2.42 — بلافاصله بعد از پیچ: بازگشت لاین موقتاً تیزتر (پیچ تمیز و راننده‌وار) */
  turnBlend = 0;

  // ---------- وضعیت روی شبکه جاده ----------
  /** N/S: شماره جاده عمودی | E/W: شماره جاده افقی */
  roadIndex = 0;
  /** شماره گره (تقاطع) بعدی روی محور حرکت (0..roadCount) */
  nodeIndex = 0;
  /** مختصات ثابت لاین (محور عمود بر حرکت) */
  lane = 0;
  /** آفست لاین از مرکز جاده — داخلی 70 یا بیرونی 190 (دو لاین هر جهت — فاز BIG-IR) */
  laneOff = 70;
  /** تصمیم برای گره فعلی گرفته شد؟ */
  decided = false;
  /** اگر تصمیم «پیچ» است: نقطه اجرای پیچ روی محور حرکت */
  pendingTrigger = Number.NaN;
  /** اگر تصمیم «پیچ» است: جهت مقصد */
  pendingDir: TrafficDir | null = null;

  get hitW(): number { return this.drawW * 0.8; }
  get hitH(): number { return this.drawH * 0.85; }

  /** در حال تعقیب بازیکن است؟ (پلیس یا تاکسی عصبانی) */
  get isChasing(): boolean {
    return this.mode !== 'normal';
  }

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
   * پرتاب برخوردی — ماشین بر اساس شدت ضربه به عقب پرت می‌شود (فاز APK-FIX)
   * @param dirX/dirY  جهت پرتاب (نرمال یا خام — داخل نرمال می‌شود)
   * @param impact     شدت ضربه (px/s سرعت نسبی لحظه تماس)
   */
  knock(dirX: number, dirY: number, impact: number): void {
    const len = Math.hypot(dirX, dirY) || 1;
    const k = Math.min(TRAFFIC.knockMax, TRAFFIC.knockBase + impact * TRAFFIC.knockScale);
    this.knockVx += (dirX / len) * k;
    this.knockVy += (dirY / len) * k;
    this.knockedSec = 6; // 🔕 تا ۶ ثانیه بازیافت ممنوع — کاربر باید نتیجهٔ ضربه را ببیند
    // ضربه محکم = کمی چرخش بدنه (طنز کارتونی!)
    if (impact > COLLISION_SOFT) {
      this.spinVel += (Math.random() - 0.5) * 2 * impact * TRAFFIC.spinScale;
    }
  }

  /** آیا به‌تازگی ضربه خورده؟ (بازیافت در این حالت متوقف است) */
  recentlyKnocked(): boolean {
    return this.knockedSec > 0;
  }

  /**
   * یک گام فیزیک — desiredSpeed را مدیر تعیین می‌کند (0 = ایست پشت مانع)
   * شامل پرتاب برخوردی (knock) که مستقل از AI کار می‌کند (فاز APK-FIX)
   */
  update(dt: number, desiredSpeed: number): void {
    // 🔕 آخرین وضعیت سالم — برای گارد NaN (یک محاسبهٔ بد هرگز ماشین را غایب نمیکند)
    const px0 = this.x;
    const py0 = this.y;
    const pa0 = this.angle;
    if (this.knockedSec > 0) this.knockedSec -= dt;
    if (this.turnBlend > 0) this.turnBlend -= dt;

    // ---------- چرخش بدنه بر اثر ضربه (قبل از نرم‌سازی AI تا با هم نجنگند) ----------
    if (Math.abs(this.spinVel) > 0.02) {
      this.angle += this.spinVel * dt;
      this.spinVel *= Math.exp(-3.2 * dt);
      if (Math.abs(this.spinVel) < 0.02) this.spinVel = 0;
    }

    // ---------- پرتاب برخوردی: حرکت آزاد + میرایی (مستقل از استان/AI) ----------
    const kv = Math.hypot(this.knockVx, this.knockVy);
    if (kv > 2) {
      this.x += this.knockVx * dt;
      this.y += this.knockVy * dt;
      const damp = Math.exp(-TRAFFIC.knockDecay * dt);
      this.knockVx *= damp;
      this.knockVy *= damp;
    } else {
      this.knockVx = 0;
      this.knockVy = 0;
    }

    // نرم شدن زاویه به سمت جهت هدف — v0.2.42: نرخ راننده‌وار (قبلاً 7/s = تله‌پورت بصری)
    // فقط وقتی چرخش ضربه تمام شده؛ حین تعقیب زاویه را AI هدف می‌دهد (همین نرخ خوب است)
    if (Math.abs(this.spinVel) < 0.02) {
      const target = DIR_INFO[this.dir].angle;
      let diff = target - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += diff * Math.min(1, TRAFFIC.angleReturnRate * dt);
    }

    if (this.stunned > 0) {
      this.stunned -= dt;
      this.speed = Math.max(0, this.speed - TRAFFIC.brakePower * dt);
    } else {
      // شتاب / ترمز تا سرعت مطلوب (تعقیب شتاب بیشتر دارد — پلیس دیر نمی‌کند!)
      const acc = this.mode === 'pursuit' ? 260 : this.mode === 'angry' ? 220 : TRAFFIC.accel;
      if (this.speed < desiredSpeed) {
        this.speed = Math.min(desiredSpeed, this.speed + acc * dt);
      } else if (this.speed > desiredSpeed) {
        this.speed = Math.max(desiredSpeed, this.speed - TRAFFIC.brakePower * dt);
      }
    }

    // حرکت روی محور جهت
    const v = DIR_INFO[this.dir];
    this.x += v.x * this.speed * dt;
    this.y += v.y * this.speed * dt;

    // 🔑 v0.2.42 — بازگشت نرم روی مرکز لاین: راننده‌واری، نه مگنتِ ۵ برابرِ ثانیه‌ای!
    // حین پرتاب فعالِ لاین را رها کن وگرنه با ضربه می‌جنگد.
    if (kv <= 40) {
      const blend = this.turnBlend > 0;
      const rate = Math.min(1, (blend ? TRAFFIC.turnBlendRate : TRAFFIC.laneReturnRate) * dt);
      const cap = (blend ? TRAFFIC.turnBlendMax : TRAFFIC.laneReturnMax) * dt; // سقف جابه‌جایی عرضی این گام
      if (v.x === 0) {
        // حرکت N/S — عرضی همان X است
        const err = this.lane - this.x;
        const step = Math.sign(err) * Math.min(Math.abs(err) * rate, cap, Math.abs(err));
        this.x += step;
      } else {
        const err = this.lane - this.y;
        const step = Math.sign(err) * Math.min(Math.abs(err) * rate, cap, Math.abs(err));
        this.y += step;
      }
    }

    // 🔕 گارد NaN: اگر هر محاسبه‌ای مقدار نامعتبر ساخت، به آخرین وضعیت سالم برگرد
    if (!Number.isFinite(this.x) || !Number.isFinite(this.y) || !Number.isFinite(this.angle)) {
      this.x = px0;
      this.y = py0;
      this.angle = pa0;
      this.knockVx = 0;
      this.knockVy = 0;
      this.spinVel = 0;
      this.speed = 0;
    }
  }
}
