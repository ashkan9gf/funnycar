/**
 * Camera.ts — دوربین دنبال‌کننده نرم + لرزش برخورد
 * ============================================================
 * دوربین مرکز دید را با lerp نرم دنبال می‌کند و کمی جلوتر از حرکت ماشین
 * می‌رود (Lookahead) تا بازیکن جاده جلو را ببیند. (GAME_DESIGN بخش ۴)
 */

import { CAMERA } from '../data/balance';

export class Camera {
  x = 0;
  y = 0;
  /** نیم‌اندازه‌های دید منطقی (هر فریم توسط GameManager تنظیم می‌شود) */
  halfW = 360;
  halfH = 640;
  private shake = 0;
  private shakeX = 0;
  private shakeY = 0;

  /** جهش اولیه — بدون انیمیشن */
  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  update(dt: number, targetX: number, targetY: number, vx: number, vy: number): void {
    const lx = targetX + vx * CAMERA.lookahead;
    const ly = targetY + vy * CAMERA.lookahead;
    const t = 1 - Math.exp(-CAMERA.lerp * dt);
    this.x += (lx - this.x) * t;
    this.y += (ly - this.y) * t;

    // لرزش محو‌شونده
    if (this.shake > 0.1) {
      this.shake *= Math.exp(-CAMERA.shakeDecay * dt);
      this.shakeX = (Math.random() * 2 - 1) * this.shake;
      this.shakeY = (Math.random() * 2 - 1) * this.shake;
    } else {
      this.shake = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  addShake(amount: number): void {
    this.shake = Math.min(CAMERA.maxShake, this.shake + amount);
  }

  /** تبدیل مختصات دنیا → صفحه (قبل از رسم با translate استفاده می‌شود) */
  offsetX(): number {
    return Math.round(this.x - this.halfW + this.shakeX);
  }
  offsetY(): number {
    return Math.round(this.y - this.halfH + this.shakeY);
  }

  /** آیا مستطیل دنیا در کادر دوربین است؟ (Culling — ARCHITECTURE بخش ۱۰) */
  isVisible(x: number, y: number, w: number, h: number, margin = 64): boolean {
    const left = this.x - this.halfW - margin;
    const right = this.x + this.halfW + margin;
    const top = this.y - this.halfH - margin;
    const bottom = this.y + this.halfH + margin;
    return x + w > left && x < right && y + h > top && y < bottom;
  }
}
