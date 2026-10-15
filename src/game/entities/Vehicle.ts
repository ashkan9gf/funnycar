/**
 * Vehicle.ts — فیزیک آرکید خودرو + سیستم آسیب (فاز BIG-IR)
 * ============================================================
 * مدل ساده و قابل پیش‌بینی:
 *  - سرعت روی محور جلو/عقب، فرمان فقط وقتی حرکت می‌کنی اثر دارد
 *  - همه اعداد از balance.ts می‌آیند (بدون عدد Hard-Code)
 *  - برخورد OBB دقیق (SAT) با موانع — نتیجه: توقف/جهش + رویداد + «نقطه برخورد»
 *  - سلامت (health): برخورد با موانع بزرگ آسیب می‌زند؛ سرعت بیشینه افت می‌کند
 */

import { VEHICLE_PHYSICS as VP, COLLISION, DRIFT, DAMAGE } from '../data/balance';
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

  /** سرعت بیشینه مؤثر با توجه به خرابی (تا -35%) و آپگرید موتور (فاز ۶) */
  get maxSpeed(): number {
    const k = 1 - DAMAGE.maxSpeedPenalty * (1 - this.health / DAMAGE.maxHealth);
    return VP.maxSpeed * this.tune.maxSpeedMul * k;
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
      this.speed += VP.accel * this.tune.accelMul * dt;
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

    // ---------- فرمان (اثر متناسب با سرعت + آپگرید لاستیک فاز ۶) ----------
    const speedRatio = Math.abs(this.speed) / VP.maxSpeed;
    if (speedRatio > VP.minSteerSpeedRatio) {
      const steerEff = VP.steerStrength * this.tune.steerMul * Math.min(1, speedRatio * 1.6);
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

      // نقطه تماس تقریبی: گوشه ماشین در جهت نرمال (برای ذرات/خرابی)
      const alongF = mtv.x * playerBox.ax + mtv.y * playerBox.ay;
      const alongR = mtv.x * playerBox.bx + mtv.y * playerBox.by;
      const pushF = Math.abs(alongF) >= Math.abs(alongR) ? Math.sign(alongF) * playerBox.ha : 0;
      const pushR = pushF === 0 ? Math.sign(alongR) * playerBox.hb : 0;
      res.impactX = this.x + playerBox.ax * pushF + playerBox.bx * pushR;
      res.impactY = this.y + playerBox.ay * pushF + playerBox.by * pushR;

      // آسیب داینامیک با جهت برخورد (جلو/عقب — فاز BIG-IR)
      // فقط برخورد واقعی (سرعت > آستانه نرم) آسیب می‌زند — ساییدنِ ایستانه صفر
      if (axisImpact > COLLISION.softCrashSpeed) {
        res.damage = this.applyDamage(this.dmgFor(axisImpact), this.isFrontHit(res.nx, res.ny));
        res.front = this.isFrontHit(res.nx, res.ny);
      }

      // ساییدن به مانع: سرعت کم می‌شود ولی حرکت ادامه می‌یابد (لغزش)
      // 🔕 تصادف واقعی‌تر: کوبشِ سختِ پیشانی = توقف تقریبی + برگشت کوچک، نه سُرخوردن
      const frontalMag = Math.abs(Math.sin(this.angle) * mtv.x - Math.cos(this.angle) * mtv.y);
      if (axisImpact > COLLISION.hardCrashSpeed && frontalMag > 0.72) {
        this.speed = -Math.min(42, axisImpact * 0.14); // کوبش + برگشت ملایم مثل خودروی واقعی
        this.latVel *= 0.2;
      } else {
        this.speed *= COLLISION.wallSlideFactor;
        this.latVel *= 0.4;
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
}
