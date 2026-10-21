/**
 * Vehicle.ts — فیزیک آرکید خودرو + سیستم آسیب (فاز BIG-IR)
 * ============================================================
 * مدل ساده و قابل پیش‌بینی:
 *  - سرعت روی محور جلو/عقب، فرمان فقط وقتی حرکت می‌کنی اثر دارد
 *  - همه اعداد از balance.ts می‌آیند (بدون عدد Hard-Code)
 *  - برخورد OBB دقیق (SAT) با موانع — نتیجه: توقف/جهش + رویداد + «نقطه برخورد»
 *  - سلامت (health): برخورد با موانع بزرگ آسیب می‌زند؛ سرعت بیشینه افت می‌کند
 */

import { VEHICLE_PHYSICS as VP, COLLISION, DRIFT, DAMAGE, FUEL } from '../data/balance';
import { NEUTRAL_TUNING, type VehicleTuning } from '../data/garage';
import { obbFromAngle, obbFromAABB, satOverlapMTV } from './obb';

export interface Collider {
  x: number; y: number; w: number; h: number;
}

export interface VehicleState {
  x: number; y: number;
  /** زاویه به رادیان؛ 0 = رو به بالا (شمال) */
  angle: number;
  /** px/s — مثبت جلو، منفی عقب */
  speed: number;
}

export interface VehicleUpdateResult {
  /** برخورد با مانع رخ داد؟ */
  crashed: boolean;
  /** شدت برخورد (px/s لحظه برخورد) — 0 اگر برخوردی نبود */
  impactSpeed: number;
  /** نقطه تقریبی تماس (برای ذرات/خرابی داینامیک — فاز BIG-IR) */
  impactX: number;
  impactY: number;
  /** نرمال برخورد (از مانع به بیرون) — جهت پرتاب ذرات */
  nx: number;
  ny: number;
  /** آسیب واردشده به ماشین در همین برخورد (0 = هیچ) */
  damage: number;
  /** برخورد از سمت جلوی ماشین بود؟ */
  front: boolean;
  /** شدت ترمز امتیازی (برای رویداد hard_brake) */
  brakedHard: boolean;
  /** در حال درفت/سرخوردن است؟ (رد لاستیک + صدای سایش) */
  skidding: boolean;
}

export class Vehicle {
  x = 0;
  y = 0;
  angle = 0;
  speed = 0;
  /** سرعت جانبی در قاب خودکار (درفت ملایم فاز 2) */
  latVel = 0;
  /** ابعاد رسم (منطقی) — از AssetManager پس از Boot تنظیم می‌شود */
  drawW = 112;
  drawH = 196;

  /** سلامت ماشین 100..0 — صفر = خاموشی (فاز BIG-IR) */
  health: number = DAMAGE.maxHealth;
  /** آسیب تجمعی جلو/عقب برای جدا شدن سپر */
  frontDamage = 0;
  rearDamage = 0;

  /** فاز ۶ گاراژ — ضرایب آپگرید (پیش‌فرض: کارخانه) */
  tune: VehicleTuning = { ...NEUTRAL_TUNING };

  /** 🔑 v0.2.45 — باک بنزین ۰..۱۰۰ (۰ = موتور به نفس نمی‌رسد) */
  fuel: number = FUEL.max;

  /** جعبه برخورد کوچک‌تر از رسم (راندمان و حس بهتر) */
  get hitW(): number { return this.drawW * 0.82; }
  get hitH(): number { return this.drawH * 0.9; }

  /** 🔑 v0.2.46 — فرمان نرم‌شده (‎-1..1‎) — ورودی خام را با نرخ attack/release دنبال می‌کند
   *  (فرمون دیگر آنی روشن/خاموش نمی‌شود؛ مثل فرمان واقعی می‌چرخد و برمی‌گردد) */
  steerSmooth = 0;
  /** آخرین فرمان مؤثر اعمال‌شده (انیمیشن چرخ جلوی 3D) */
  lastSteerApplied = 0;

  reset(x: number, y: number, angle = 0): void {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.latVel = 0;
    this.steerSmooth = 0;
    this.lastSteerApplied = 0;
    // 🔑 v0.2.45 — شروع/مأموریت جدید = باک پر (سرویس قبل از حرکت!)
    this.fuel = FUEL.max;
  }

  /** ماشین کامل ترمیم شد (زون تعمیرگاه/اسکران) */
  fullRepair(): void {
    this.health = DAMAGE.maxHealth;
    this.frontDamage = 0;
    this.rearDamage = 0;
  }

  /** آسیب بگیر — برمی‌گرداند سلامت باقی‌مانده */
  applyDamage(amount: number, fromFront: boolean): number {
    this.health = Math.max(0, this.health - amount);
    if (fromFront) this.frontDamage += amount;
    else this.rearDamage += amount;
    return this.health;
  }

  /** موتور خاموش است؟ */
  get dead(): boolean {
    return this.health <= 0;
  }

  /** 🔑 v0.2.45 — ضریب توان موتور با توجه به باک (خالی = ۳۴٪ قدرت — نه خاموشی کامل) */
  private get powerMul(): number {
    return this.fuel > 0 ? 1 : FUEL.emptyPowerMul;
  }

  /** سرعت بیشینه مؤثر با توجه به خرابی (تا -35%) و آپگرید موتور (فاز ۶) و باک (v0.2.45) */
  get maxSpeed(): number {
    const k = 1 - DAMAGE.maxSpeedPenalty * (1 - this.health / DAMAGE.maxHealth);
    return VP.maxSpeed * this.tune.maxSpeedMul * k * this.powerMul;
  }

  get vx(): number { return Math.sin(this.angle) * this.speed; }
  get vy(): number { return -Math.cos(this.angle) * this.speed; }

  /** بردار راست خودکار (نسبت به جهت فعلی) — برای درفت */
  private get rightX(): number { return Math.cos(this.angle); }
  private get rightY(): number { return Math.sin(this.angle); }

  /** آیا برخورد از سمت جلوی ماشین بود؟ (نرمال رو به بیرون مانع × بردار جلو) */
  private isFrontHit(nx: number, ny: number): boolean {
    const dot = Math.sin(this.angle) * nx - Math.cos(this.angle) * ny;
    return dot < 0; // نرمال خلاف جهت جلو = مانع جلوی ماشین است
  }

  /** 🔑 v0.2.45 — مصرف بنزین (هر گام فیزیک) — بیکاری تقریباً صفر، سرعت بیشتر = مصرف بیشتر */
  drainFuel(dt: number): void {
    if (this.fuel <= 0) return;
    this.fuel = Math.max(0, this.fuel - (FUEL.drainBase + Math.abs(this.speed) * FUEL.drainPerSpeed) * dt);
  }

  /** 🔑 v0.2.45 — سوخت‌گیری در زون پمپ بنزین؛ true = باک پر شد */
  refuel(dt: number): boolean {
    if (this.fuel >= FUEL.max) return false;
    this.fuel = Math.min(FUEL.max, this.fuel + FUEL.refillRate * dt);
    return this.fuel >= FUEL.max;
  }

  /**
   * یک گام فیزیک (dt ثابت 1/120) — ورودی از InputManager.collect
   */
  update(dt: number, input: { steer: number; gas: boolean; brake: boolean }, colliders: Collider[]): VehicleUpdateResult {
    const res: VehicleUpdateResult = { crashed: false, impactSpeed: 0, impactX: 0, impactY: 0, nx: 0, ny: 0, damage: 0, front: false, brakedHard: false, skidding: false };

    // ---------- سرعت (با سقف وابسته به سلامت) ----------
    const cap = this.maxSpeed;
    const prevSpeed = this.speed;
    if (input.gas) {
      // 🔑 v0.2.45 — شتاب تدریجی: نزدیک سقف، گشتاور موتور کم می‌شود (خم توان)
      // 0..40٪ سرعت = شتاب کامل؛ بعدش نرم تا ~۲۲٪ در سقف → «سرعت کم‌کم بالا می‌ره»
      const frac = Math.max(0, this.speed) / cap;
      const curve = 1 - VP.accelCurve * frac * frac;
      this.speed += VP.accel * this.tune.accelMul * curve * dt;
    } else if (input.brake) {
      if (this.speed > 8) {
        this.speed -= VP.brake * this.tune.brakeMul * dt;
        if (prevSpeed > 250 && this.speed <= 250) res.brakedHard = true;
      } else {
        // توقف کامل + ادامه ترمز = دنده عقب ملایم
        this.speed -= VP.reverseAccel * dt;
      }
    } else {
      // اصطکاک موتور
      const drop = VP.engineBrake * dt;
      this.speed = Math.abs(this.speed) <= drop ? 0 : this.speed - Math.sign(this.speed) * drop;
    }

    this.speed = Math.max(-VP.maxReverse, Math.min(cap, this.speed));

    // ---------- 🔑 v0.2.46 — نرم‌سازی فرمان (attack/release مثل فرمان واقعی) ----------
    const steerTarget = Math.max(-1, Math.min(1, input.steer));
    const steerDiff = steerTarget - this.steerSmooth;
    if (Math.abs(steerDiff) <= 0.001) {
      this.steerSmooth = steerTarget;
    } else {
      // در جهت هدف = attack؛ برگشت به مرکز یا عوض‌کردن جهت = release
      const toward = steerTarget !== 0 && Math.sign(steerDiff) === Math.sign(steerTarget);
      const rate = toward ? VP.steerAttack : VP.steerRelease;
      this.steerSmooth += Math.sign(steerDiff) * Math.min(Math.abs(steerDiff), rate * dt);
    }

    // ---------- 🔑 v0.2.46 — فرمان حرفه‌ای: نرم‌شده × منحنی سرعت ----------
    // سرعت کم = دستاورد کامل (پارک/مانور راحت)؛ سرعت بالا = محافظه‌کار (نه لرزش و قوس‌وقار)
    const speedRatio = Math.abs(this.speed) / VP.maxSpeed;
    if (speedRatio > VP.minSteerSpeedRatio) {
      const lowGain = Math.min(1, VP.steerLowGain + speedRatio * 1.9);
      const hot = Math.max(0, Math.min(1, (speedRatio - VP.steerHighFrom) / (1 - VP.steerHighFrom)));
      const damp = 1 - VP.steerHighDamp * hot * hot * (3 - 2 * hot); // smoothstep
      const steerEff = VP.steerStrength * this.tune.steerMul * lowGain * damp;
      // عقب رفتن فرمان معکوس می‌شود (مثل ماشین واقعی)
      this.angle += this.steerSmooth * steerEff * dt * Math.sign(this.speed || 1);
      this.lastSteerApplied = this.steerSmooth;
      // محدود کردن زاویه به -π..π برای تمیزی
      if (this.angle > Math.PI) this.angle -= Math.PI * 2;
      if (this.angle < -Math.PI) this.angle += Math.PI * 2;
    } else {
      this.lastSteerApplied = 0;
    }

    // ---------- درفت ملایم (فاز 2) — 🔑 v0.2.46 با فرمان نرم‌شده (پرش لاستیکی ندارد) ----------
    const speedRatioAbs = Math.abs(this.speed) / VP.maxSpeed;
    if (speedRatioAbs > DRIFT.minSpeedRatio && this.speed > 0 && Math.abs(this.steerSmooth) > 0.05) {
      // بیرون پیچ = خلاف جهت فرمان (فیزیک: جرم به مسیر قبلی ادامه می‌دهد)
      this.latVel -= this.steerSmooth * DRIFT.slipGain * speedRatioAbs * Math.abs(this.speed) * dt;
    }
    // میرایی چسبندگی (لاستیک آپگریدشده = چسبندگی بیشتر — فاز ۶)
    const grip = Math.exp(-DRIFT.gripDecay * this.tune.gripMul * dt);
    this.latVel *= grip;
    this.latVel = Math.max(-DRIFT.maxLateral, Math.min(DRIFT.maxLateral, this.latVel));
    res.skidding = Math.abs(this.latVel) > DRIFT.skidThreshold;

    // ---------- حرکت (طولی + جانبی) ----------
    this.x += (this.vx + this.rightX * this.latVel) * dt;
    this.y += (this.vy + this.rightY * this.latVel) * dt;

    // ---------- برخورد (فاز HITBOX-EXACT: OBB×SAT — اگر واقعاً نخوردی، تصادف نیست!) ----------
    // جعبه چرخان دقیق ماشین در برابر مانع (ساختمان/دیوار) — در حرکت مورب دیگر جعبه متورم نداریم
    const velX = this.vx + this.rightX * this.latVel;
    const velY = this.vy + this.rightY * this.latVel;
    const playerBox = obbFromAngle(this.x, this.y, this.angle, this.hitH / 2, this.hitW / 2);

    for (const c of colliders) {
      // رد سریع با دایره محاطی (کولایدهای دور تست SAT نمی‌گیرند)
      const ccx = c.x + c.w / 2;
      const ccy = c.y + c.h / 2;
      const cRad = Math.hypot(c.w, c.h) / 2 + this.hitH / 2;
      const ddx = ccx - this.x;
      const ddy = ccy - this.y;
      if (ddx * ddx + ddy * ddy > cRad * cRad) continue;

      const mtv = satOverlapMTV(playerBox, obbFromAABB(c.x, c.y, c.w, c.h));
      if (!mtv) continue;

      // جداسازی کامل بازیکن در جهت کم‌عمق‌ترین محور (لغزش روی دیوار حفظ می‌شود)
      this.x += mtv.x * mtv.depth;
      this.y += mtv.y * mtv.depth;

      // شدت برخورد = مؤلفه سرعت روی محور برخورد
      const axisImpact = Math.abs(velX * mtv.x + velY * mtv.y);
      res.nx = mtv.x;
      res.ny = mtv.y;

      // 🔑 v0.2.45 — نقطهٔ تماس واقعی: نزدیک‌ترین نقطهٔ AABB مانع به مرکز ماشین؛
      // برای ذرات درست‌تر است و مهم‌تر: گشتاور ضربهٔ گوشه‌ای از همین r حساب می‌شود
      // (تخمین قدیمی همیشه وسط وجه ماشین می‌افتاد → گشتاور همیشه صفر بود)
      const clampCx = Math.max(c.x, Math.min(this.x, c.x + c.w));
      const clampCy = Math.max(c.y, Math.min(this.y, c.y + c.h));
      res.impactX = clampCx;
      res.impactY = clampCy;

      // آسیب داینامیک با جهت برخورد (جلو/عقب — فاز BIG-IR)
      // فقط برخورد واقعی (سرعت > آستانه نرم) آسیب می‌زند — ساییدنِ ایستانه صفر
      if (axisImpact > COLLISION.softCrashSpeed) {
        res.damage = this.applyDamage(this.dmgFor(axisImpact), this.isFrontHit(res.nx, res.ny));
        res.front = this.isFrontHit(res.nx, res.ny);
      }

      // ضربه: جهش کم در راستای نرمال + اصطکاک روی سطح برخورد (ادغام از شاخهٔ کاربر)؛
      // کوبشِ سخت = برگشت کوچک، ساییدنِ آرام = لغزش روان — دیگر قفل روی دیوار نیست
      const hardImpact = axisImpact > COLLISION.hardCrashSpeed;
      this.applyCollisionResponse(
        mtv.x,
        mtv.y,
        hardImpact ? COLLISION.hardRestitution : COLLISION.restitution,
        hardImpact ? COLLISION.hardTangentRetention : COLLISION.tangentRetention,
      );

      // 🔑 v0.2.45 — گشتاور طبیعی: ضربهٔ گوشه‌ای (خارج از مرکز) ماشین را می‌چرخاند؛
      // ضربه‌های وسط‌بدنه گشتاور تقریباً صفر دارند → برخورد سر‌به‌سر مستقیم می‌ماند
      if (axisImpact > COLLISION.softCrashSpeed) {
        const rx = res.impactX - this.x;
        const ry = res.impactY - this.y;
        // نیروی وارد بر ماشین = خلاف نرمال جداسازی (مانع ماشین را هل می‌دهد)
        const Fx = -mtv.x * axisImpact;
        const Fy = -mtv.y * axisImpact;
        const torque = rx * Fy - ry * Fx;
        const kick = Math.max(-COLLISION.spinKickMax, Math.min(COLLISION.spinKickMax, torque * COLLISION.spinKick));
        this.angle += kick;
      }

      if (axisImpact > COLLISION.softCrashSpeed) {
        res.crashed = true;
        res.impactSpeed = axisImpact;
      }
      break; // یک مانع در هر گام کافی است
    }

    return res;
  }

  /** آسیب این برخورد = base + impact×scale با سقف (فاز BIG-IR) × بدنه آپگرید (فاز ۶) */
  private dmgFor(impact: number): number {
    const raw = (DAMAGE.worldHitBase + impact * DAMAGE.worldHitScale) * this.tune.armorMul;
    return Math.min(DAMAGE.worldHitMax, raw);
  }

  /**
   * پاسخ فیزیکی برخورد (ادغام از شاخهٔ کاربر + پیاده‌سازی گمشده):
   * سرعت جهانی را به مؤلفهٔ نرمال (عمود بر سطح) و مماسی (موازی سطح) تجزیه می‌کند —
   * نرمال با ضریب جهش برمی‌گردد، مماس با ضریب اصطکاک حفظ می‌شود؛ سپس به (speed, latVel) بازمی‌سازد.
   * nx/ny = نرمال جداسازی MTV (به بیرون مانع).
   */
  applyCollisionResponse(nx: number, ny: number, restitution: number, tangentRetention: number): void {
    const wvx = this.vx + this.rightX * this.latVel;
    const wvy = this.vy + this.rightY * this.latVel;
    const vn = wvx * nx + wvy * ny; // مؤلفه نرمال (منفی = در حال نفوذ به مانع)
    const tx = -ny;
    const ty = nx;
    const vt = wvx * tx + wvy * ty; // مؤلفه مماسی
    // فقط وقتی به سمت مانع می‌رویم جهش می‌کنیم؛ اگر در حال جداشدنیم دست نمی‌زنیم
    const vnNew = vn < 0 ? -vn * restitution : vn;
    const vtNew = vt * tangentRetention;
    // بازسازی سرعت جهانی
    const nwx = nx * vnNew + tx * vtNew;
    const nwy = ny * vnNew + ty * vtNew;
    // تجزیه به (طولی، جانبی) نسبت به جهت فعلی ماشین
    const sinA = Math.sin(this.angle);
    const cosA = Math.cos(this.angle);
    this.speed = nwx * sinA - nwy * cosA; // تصویر روی بردار جلو (sin, −cos)
    this.latVel = nwx * cosA + nwy * sinA; // تصویر روی بردار راست (cos, sin)
  }
}
