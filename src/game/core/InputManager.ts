/**
 * InputManager.ts — یکپارچه‌سازی ورودی لمسی و کیبورد
 * ============================================================
 * دکمه‌های لمسی (React) با setVirtual* وضعیت را تنظیم می‌کنند؛
 * کیبورد (برای تست دسکتاپ) هم به همان ساختار می‌ریزد.
 * هیچ کجای بازی مستقیم event لمسی را نمی‌خواند.
 */

import { VEHICLE_PHYSICS } from '../data/balance';

export interface InputState {
  /** -1 چپ، 0 هیچ، +1 راست */
  steer: number;
  gas: boolean;
  brake: boolean;
  /** بوق: لبه‌ای (هر فشار = یک بار مصرف می‌شود) */
  hornPressed: boolean;
}

export class InputManager {
  private keys = new Set<string>();
  private virtual = { left: false, right: false, gas: false, brake: false };
  private hornEdge = false;
  /** 🔑 v0.2.45 — فرمان آنالوگ (فرمان‌دستی/ژیروسکوپ) — null = غیرفعال (دکمه‌ها)؛ -1..1 = فعال */
  private analogSteer: number | null = null;
  /** جلوگیری از تکرار رویداد کیبورد وقتی در input/textbox هستیم */
  private enabled = true;

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if (k === 'h' && !this.keys.has('h')) this.hornEdge = true; // لبه‌ای
    this.keys.add(k);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };
  private onBlur = (): void => {
    this.keys.clear();
    this.virtual = { left: false, right: false, gas: false, brake: false };
  };

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }
  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.onBlur();
  }

  // ---------- دکمه‌های لمسی مجازی (از React) ----------
  setVirtualLeft(v: boolean): void { this.virtual.left = v; }
  setVirtualRight(v: boolean): void { this.virtual.right = v; }
  setVirtualGas(v: boolean): void { this.virtual.gas = v; }
  setVirtualBrake(v: boolean): void { this.virtual.brake = v; }
  /** 🔑 v0.2.45 — فرمان آنالوگ: فرمان‌دستی (چرخش انگشت) و ژیروسکوپ اینجا می‌ریزند */
  setVirtualSteerAnalog(v: number | null): void {
    this.analogSteer = v === null ? null : Math.max(-1, Math.min(1, v));
  }
  pressHorn(): void { this.hornEdge = true; }

  /**
   * وضعیت لحظه‌ای ورودی — هر فریم یک بار خوانده می‌شود
   */
  collect(): InputState {
    const keyLeft = this.keys.has('arrowleft') || this.keys.has('a');
    const keyRight = this.keys.has('arrowright') || this.keys.has('d');
    const keyGas = this.keys.has('arrowup') || this.keys.has('w');
    const keyBrake = this.keys.has('arrowdown') || this.keys.has('s') || this.keys.has(' ');

    // 🔑 v0.2.45 — آنالوگ فعال است؟ (فرمان/ژیروسکوپ) — دکمه‌های چپ/رست پشت آن بی‌اثرند
    const steerRaw = this.analogSteer !== null
      ? this.analogSteer
      : (this.virtual.right || keyRight ? 1 : 0) - (this.virtual.left || keyLeft ? 1 : 0);
    const state: InputState = {
      steer: steerRaw,
      gas: this.virtual.gas || keyGas,
      brake: this.virtual.brake || keyBrake,
      hornPressed: this.hornEdge,
    };
    this.hornEdge = false;
    return state;
  }

  /** سوییچ دنده عقب خودکار وقتی ترمز در توقف نگه داشته شود؟ — در فاز 2 تصمیم می‌گیریم؛ فعلاً ساده */
  static readonly allowReverse = VEHICLE_PHYSICS.maxReverse > 0;
}
