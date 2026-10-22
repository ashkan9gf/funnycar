/**
 * Camera.ts — دوربین دنبال‌کننده نرم + لرزش برخورد سینمایی
 * ============================================================
 * دوربین مرکز دید را با lerp نرم دنبال می‌کند و کمی جلوتر از حرکت ماشین
 * می‌رود (Lookahead) تا بازیکن جاده جلو را ببیند. لرزش برخورد با نویز هموارشده
 * و مستقل از نرخ فریم اجرا می‌شود تا روی موبایل حس پرش تصادفی و آزاردهنده نداشته باشد.
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
  private shakeTargetX = 0;
  private shakeTargetY = 0;
  private shakeNoiseClock = 0;

  /** جهش اولیه — بدون انیمیشن */
  snapTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  update(dt: number, targetX: number, targetY: number, vx: number, vy: number): void {
    // Avoid huge interpolation jumps after a background-tab pause.
    const safeDt = Math.max(0, Math.min(dt, 0.1));
    const lx = targetX + vx * CAMERA.lookahead;
    const ly = targetY + vy * CAMERA.lookahead;
    const t = 1 - Math.exp(-CAMERA.lerp * safeDt);
    this.x += (lx - this.x) * t;
    this.y += (ly - this.y) * t;

    // Smooth, low-frequency shake: random targets are refreshed at a fixed cadence,
    // then approached continuously. This avoids harsh per-frame random jitter.
    if (this.shake > 0.1) {
      this.shake *= Math.exp(-CAMERA.shakeDecay * safeDt);
      this.shakeNoiseClock += safeDt;
      while (this.shakeNoiseClock >= 0.045) {
        this.shakeNoiseClock -= 0.045;
        this.shakeTargetX = (Math.random() * 2 - 1) * this.shake;
        this.shakeTargetY = (Math.random() * 2 - 1) * this.shake;
      }
      const shakeBlend = 1 - Math.exp(-24 * safeDt);
      this.shakeX += (this.shakeTargetX - this.shakeX) * shakeBlend;
      this.shakeY += (this.shakeTargetY - this.shakeY) * shakeBlend;
    } else {
      this.shake = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeTargetX = 0;
      this.shakeTargetY = 0;
      this.shakeNoiseClock = 0;
    }
  }

  addShake(amount: number): void {
    this.shake = Math.min(CAMERA.maxShake, this.shake + amount);
  }

  /** لرزش فعلی برای دوربین سه‌بعدی (فاز 3D) — بدون round برای lerp نرم */
  getShake(): { x: number; y: number } {
    return { x: this.shakeX, y: this.shakeY };
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
