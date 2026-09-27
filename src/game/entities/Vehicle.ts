/**
 * Vehicle.ts — فیزیک آرکید خودرو + سیستم آسیب (فاز BIG-IR)
 * ============================================================
 * مدل ساده و قابل پیش‌بینی:
 *  - سرعت روی محور جلو/عقب، فرمان فقط وقتی حرکت می‌کنی اثر دارد
 *  - همه اعداد از balance.ts می‌آیند (بدون عدد Hard-Code)
 *  - برخورد AABB با موانع — نتیجه: توقف/جهش + رویداد + «نقطه برخورد»
 *  - سلامت (health): برخورد با موانع بزرگ آسیب می‌زند؛ سرعت بیشینه افت می‌کند
 */

import { VEHICLE_PHYSICS as VP, COLLISION, DRIFT, DAMAGE } from '../data/balance';

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

  /** جعبه برخورد کوچک‌تر از رسم (راندمان و حس بهتر) */
  get hitW(): number { return this.drawW * 0.82; }
  get hitH(): number { return this.drawH * 0.9; }

  reset(x: number, y: number, angle = 0): void {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.latVel = 0;
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

  /** سرعت بیشینه مؤثر با توجه به خرابی (تا -35%) */
  get maxSpeed(): number {
    const k = 1 - DAMAGE.maxSpeedPenalty * (1 - this.health / DAMAGE.maxHealth);
    return VP.maxSpeed * k;
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

  /**
   * یک گام فیزیک (dt ثابت 1/120) — ورودی از InputManager.collect
   */
  update(dt: number, input: { steer: number; gas: boolean; brake: boolean }, colliders: Collider[]): VehicleUpdateResult {
    const res: VehicleUpdateResult = { crashed: false, impactSpeed: 0, impactX: 0, impactY: 0, nx: 0, ny: 0, damage: 0, front: false, brakedHard: false, skidding: false };

    // ---------- سرعت (با سقف وابسته به سلامت) ----------
    const cap = this.maxSpeed;
    const prevSpeed = this.speed;
    if (input.gas) {
      this.speed += VP.accel * dt;
    } else if (input.brake) {
      if (this.speed > 8) {
        this.speed -= VP.brake * dt;
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

    // ---------- فرمان (اثر متناسب با سرعت) ----------
    const speedRatio = Math.abs(this.speed) / VP.maxSpeed;
    if (speedRatio > VP.minSteerSpeedRatio) {
      const steerEff = VP.steerStrength * Math.min(1, speedRatio * 1.6);
      // عقب رفتن فرمان معکوس می‌شود (مثل ماشین واقعی)
      this.angle += input.steer * steerEff * dt * Math.sign(this.speed || 1);
      // محدود کردن زاویه به -π..π برای تمیزی
      if (this.angle > Math.PI) this.angle -= Math.PI * 2;
      if (this.angle < -Math.PI) this.angle += Math.PI * 2;
    }

    // ---------- درفت ملایم (فاز 2) ----------
    const speedRatioAbs = Math.abs(this.speed) / VP.maxSpeed;
    if (speedRatioAbs > DRIFT.minSpeedRatio && this.speed > 0 && input.steer !== 0) {
      // بیرون پیچ = خلاف جهت فرمان (فیزیک: جرم به مسیر قبلی ادامه می‌دهد)
      this.latVel -= input.steer * DRIFT.slipGain * speedRatioAbs * Math.abs(this.speed) * dt;
    }
    // میرایی چسبندگی
    const grip = Math.exp(-DRIFT.gripDecay * dt);
    this.latVel *= grip;
    this.latVel = Math.max(-DRIFT.maxLateral, Math.min(DRIFT.maxLateral, this.latVel));
    res.skidding = Math.abs(this.latVel) > DRIFT.skidThreshold;

    // ---------- حرکت (طولی + جانبی) ----------
    this.x += (this.vx + this.rightX * this.latVel) * dt;
    this.y += (this.vy + this.rightY * this.latVel) * dt;

    // ---------- برخورد (حل محور-به-محور = لغزش در امتداد دیوار + نقطه تماس) ----------
    for (const c of colliders) {
      if (!this.overlaps(c)) continue;

      const hw = this.hitW / 2;
      const hh = this.hitH / 2;
      // عمق نفوذ در هر جهت
      const penLeft = this.x + hw - c.x;
      const penRight = c.x + c.w - (this.x - hw);
      const penTop = this.y + hh - c.y;
      const penBottom = c.y + c.h - (this.y - hh);
      const minX = Math.min(penLeft, penRight);
      const minY = Math.min(penTop, penBottom);

      // رفع نفوذ در محور کم‌عمق‌تر + اندازه‌گیری شدت برخورد همان محور
      let axisImpact = 0;
      if (minX <= minY) {
        axisImpact = Math.abs(this.vx);
        if (penLeft < penRight) {
          this.x -= penLeft;
          res.nx = -1; res.ny = 0;
          res.impactX = c.x;                 // وجه چپ مانع
          res.impactY = Math.max(c.y, Math.min(c.y + c.h, this.y));
        } else {
          this.x += penRight;
          res.nx = 1; res.ny = 0;
          res.impactX = c.x + c.w;           // وجه راست مانع
          res.impactY = Math.max(c.y, Math.min(c.y + c.h, this.y));
        }
      } else {
        axisImpact = Math.abs(this.vy);
        if (penTop < penBottom) {
          this.y -= penTop;
          res.nx = 0; res.ny = -1;
          res.impactX = Math.max(c.x, Math.min(c.x + c.w, this.x));
          res.impactY = c.y;                 // وجه بالای مانع
        } else {
          this.y += penBottom;
          res.nx = 0; res.ny = 1;
          res.impactX = Math.max(c.x, Math.min(c.x + c.w, this.x));
          res.impactY = c.y + c.h;           // وجه پایین مانع
        }
      }

      // آسیب داینامیک با جهت برخورد (جلو/عقب — فاز BIG-IR)
      // فقط برخورد واقعی (سرعت > آستانه نرم) آسیب می‌زند — ساییدنِ ایستانه صفر
      if (axisImpact > COLLISION.softCrashSpeed) {
        res.damage = this.applyDamage(this.dmgFor(axisImpact), this.isFrontHit(res.nx, res.ny));
        res.front = this.isFrontHit(res.nx, res.ny);
      }

      // ساییدن به مانع: سرعت کم می‌شود ولی حرکت ادامه می‌یابد (لغزش)
      this.speed *= COLLISION.wallSlideFactor;
      this.latVel *= 0.4;

      if (axisImpact > COLLISION.softCrashSpeed) {
        res.crashed = true;
        res.impactSpeed = axisImpact;
      }
      break; // یک مانع در هر گام کافی است
    }

    return res;
  }

  /** آسیب این برخورد = base + impact×scale با سقف (فاز BIG-IR) */
  private dmgFor(impact: number): number {
    const raw = DAMAGE.worldHitBase + impact * DAMAGE.worldHitScale;
    return Math.min(DAMAGE.worldHitMax, raw);
  }

  private overlaps(c: Collider): boolean {
    const hw = this.hitW / 2;
    const hh = this.hitH / 2;
    return this.x + hw > c.x && this.x - hw < c.x + c.w
      && this.y + hh > c.y && this.y - hh < c.y + c.h;
  }
}
