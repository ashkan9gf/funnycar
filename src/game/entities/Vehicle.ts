/**
 * Vehicle.ts — فیزیک آرکید خودرو از نمای بالا
 * ============================================================
 * مدل ساده و قابل پیش‌بینی (بدون درفت پیچیده):
 *  - سرعت روی محور جلو/عقب، فرمان فقط وقتی حرکت می‌کنی اثر دارد
 *  - همه اعداد از balance.ts می‌آیند (بدون عدد Hard-Code)
 *  - برخورد AABB با موانع (ساختمان‌ها) — نتیجه: توقف/جهش + رویداد
 */

import { VEHICLE_PHYSICS as VP, COLLISION } from '../data/balance';

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
  /** شدت ترمز امتیازی (برای رویداد hard_brake) */
  brakedHard: boolean;
}

export class Vehicle {
  x = 0;
  y = 0;
  angle = 0;
  speed = 0;
  /** ابعاد رسم (منطقی) — از AssetManager پس از Boot تنظیم می‌شود */
  drawW = 112;
  drawH = 196;

  /** جعبه برخورد کوچک‌تر از رسم (راندمان و حس بهتر) */
  get hitW(): number { return this.drawW * 0.82; }
  get hitH(): number { return this.drawH * 0.9; }

  reset(x: number, y: number, angle = 0): void {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
  }

  get vx(): number { return Math.sin(this.angle) * this.speed; }
  get vy(): number { return -Math.cos(this.angle) * this.speed; }

  /**
   * یک گام فیزیک (dt ثابت 1/120) — ورودی از InputManager.collect
   */
  update(dt: number, input: { steer: number; gas: boolean; brake: boolean }, colliders: Collider[]): VehicleUpdateResult {
    const res: VehicleUpdateResult = { crashed: false, impactSpeed: 0, brakedHard: false };

    // ---------- سرعت ----------
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

    this.speed = Math.max(-VP.maxReverse, Math.min(VP.maxSpeed, this.speed));

    // ---------- فرمان (اثر متناسب با سرعت) ----------
    const speedRatio = Math.abs(this.speed) / VP.maxSpeed;
    if (speedRatio > VP.minSteerSpeedRatio) {
      const steerEff = VP.steerStrength * Math.min(1, speedRatio * 1.6);
      // عقب رفتن فرمان معکوس می‌شود (مثل ماشین واقعی)
      this.angle += input.steer * steerEff * dt * Math.sign(this.speed || 1);
      // محدود کردن زاویه به 0..2π برای تمیزی
      if (this.angle > Math.PI) this.angle -= Math.PI * 2;
      if (this.angle < -Math.PI) this.angle += Math.PI * 2;
    }

    // ---------- حرکت ----------
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // ---------- برخورد (حل محور-به-محور = لغزش در امتداد دیوار، بدون گیر کردن) ----------
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
        if (penLeft < penRight) this.x -= penLeft;
        else this.x += penRight;
      } else {
        axisImpact = Math.abs(this.vy);
        if (penTop < penBottom) this.y -= penTop;
        else this.y += penBottom;
      }

      // ساییدن به مانع: سرعت کم می‌شود ولی حرکت ادامه می‌یابد (لغزش)
      this.speed *= COLLISION.wallSlideFactor;

      if (axisImpact > COLLISION.softCrashSpeed) {
        res.crashed = true;
        res.impactSpeed = axisImpact;
      }
      break; // یک مانع در هر گام کافی است
    }

    return res;
  }

  private overlaps(c: Collider): boolean {
    const hw = this.hitW / 2;
    const hh = this.hitH / 2;
    return this.x + hw > c.x && this.x - hw < c.x + c.w
      && this.y + hh > c.y && this.y - hh < c.y + c.h;
  }
}
