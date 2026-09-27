/**
 * WorldRenderer.ts — رسم دنیا (فقط رسم؛ هیچ منطق گیم‌پلی)
 * ============================================================
 * ترتیب رسم: کاشی‌ها → ساختمان‌ها → پروپ‌ها → سکه‌ها → ماشین → ذرات → حباب گفتار
 * Culling: فقط آنچه در کادر دوربین است رسم می‌شود (ARCHITECTURE بخش ۱۰)
 */

import type { AssetManager } from '../core/AssetManager';
import type { Camera } from '../core/Camera';
import type { Vehicle } from '../entities/Vehicle';
import type { World } from './World';
import { RENDER } from '../data/balance';

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
}

const T = RENDER.tileSize;

export class WorldRenderer {
  private particles: Particle[] = [];

  constructor(
    private assets: AssetManager,
    private world: World,
    private camera: Camera,
  ) {}

  /** ذرات برخورد/سکه — از Pool ساده استفاده می‌شود (بدون new در حلقه اوج) */
  spawnBurst(x: number, y: number, color: string, count = 8, power = 160): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const p: Particle = {
        x, y,
        vx: Math.cos(a) * power * (0.4 + Math.random() * 0.6),
        vy: Math.sin(a) * power * (0.4 + Math.random() * 0.6),
        life: 0.5 + Math.random() * 0.3,
        maxLife: 0.8,
        size: 4 + Math.random() * 7,
        color,
      };
      if (this.particles.length < 220) this.particles.push(p); // سقف Pool
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }

  draw(ctx: CanvasRenderingContext2D, car: Vehicle): void {
    const cam = this.camera;
    const left = cam.offsetX();
    const top = cam.offsetY();
    const viewW = cam.halfW * 2;
    const viewH = cam.halfH * 2;

    ctx.save();
    ctx.translate(-left, -top);

    this.drawTiles(ctx, left, top, viewW, viewH);
    this.drawBuildings(ctx);
    this.drawProps(ctx);
    this.drawCoins(ctx);
    this.drawCar(ctx, car);
    this.drawParticles(ctx);

    ctx.restore();
  }

  // ---------- کاشی‌ها ----------
  private drawTiles(ctx: CanvasRenderingContext2D, left: number, top: number, viewW: number, viewH: number): void {
    const w = this.world;
    const c0 = Math.max(0, Math.floor(left / T));
    const r0 = Math.max(0, Math.floor(top / T));
    const c1 = Math.min(w.gridSize - 1, Math.floor((left + viewW) / T));
    const r1 = Math.min(w.gridSize - 1, Math.floor((top + viewH) / T));

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const kind = w.tileAt(c, r);
        const x = c * T;
        const y = r * T;
        let id = '';
        if (kind === 'road_v') id = 'env_road_straight_01';
        else if (kind === 'cross') id = 'env_road_cross_01';
        else if (kind === 'sidewalk') id = 'env_sidewalk_01';
        else if (kind === 'ground') id = 'env_ground_01';

        if (id) {
          this.drawImageFit(ctx, id, x, y, T, T);
        }
        // جاده افقی: همان کاشی عمودی با چرخش 90 درجه
        if (kind === 'road_h') {
          const img = this.assets.get('env_road_straight_01');
          if (img) {
            ctx.save();
            ctx.translate(x + T / 2, y + T / 2);
            ctx.rotate(Math.PI / 2);
            this.drawImageCentered(ctx, img, T);
            ctx.restore();
          }
        }
      }
    }
  }

  private drawImageFit(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number): void {
    const img = this.assets.get(id);
    if (img) ctx.drawImage(img, x, y, w, h);
  }

  private drawImageCentered(ctx: CanvasRenderingContext2D, img: CanvasImageSource, size: number): void {
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
  }

  // ---------- ساختمان‌ها ----------
  private drawBuildings(ctx: CanvasRenderingContext2D): void {
    for (const p of this.world.props) {
      if (p.kind !== 'building') continue;
      if (!this.camera.isVisible(p.x, p.y, p.w, p.h, 120)) continue;
      // ساختمان واقعی در Batch 3 می‌آید؛ فعلاً رسم برنامه‌ای برچسب‌دار
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      // سایه
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      this.roundRect(ctx, p.x + 10, p.y + 14, p.w, p.h, 26);
      ctx.fill();
      // بدنه
      ctx.fillStyle = p.tint ?? '#2A9D8F';
      ctx.strokeStyle = '#3A2E2A';
      ctx.lineWidth = 8;
      this.roundRect(ctx, p.x, p.y, p.w, p.h, 26);
      ctx.fill();
      ctx.stroke();
      // پنجره‌ها
      ctx.fillStyle = 'rgba(189,224,254,0.9)';
      const cols = 3;
      const rows = 4;
      const pw = (p.w - 140) / cols;
      const ph = (p.h - 160) / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          this.roundRect(ctx, p.x + 80 + i * (pw + 34), p.y + 90 + j * (ph + 30), pw, ph, 12);
          ctx.fill();
        }
      }
      // برچسب Placeholder (واضح ولی کوچک — قانون بخش ۳۲)
      ctx.fillStyle = 'rgba(58,46,42,0.55)';
      ctx.font = '600 20px Vazirmatn, Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PLACEHOLDER_ENVIRONMENT', cx, p.y + p.h - 30);
    }
  }

  // ---------- پروپ‌ها ----------
  private drawProps(ctx: CanvasRenderingContext2D): void {
    for (const p of this.world.props) {
      if (p.kind === 'building') continue;
      if (!this.camera.isVisible(p.x, p.y, p.w, p.h)) continue;
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const r = Math.min(p.w, p.h) / 2;
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#3A2E2A';
      switch (p.kind) {
        case 'tree':
          ctx.fillStyle = 'rgba(0,0,0,0.15)';
          ctx.beginPath(); ctx.ellipse(cx + 6, cy + 10, r * 0.95, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#8AC926';
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#5FA84B';
          ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.3, 0, Math.PI * 2); ctx.fill();
          break;
        case 'trash':
          ctx.fillStyle = '#4F772D';
          this.roundRect(ctx, p.x, p.y, p.w, p.h * 1.05, 10);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = 'rgba(58,46,42,0.35)';
          ctx.fillRect(p.x + 6, p.y + p.h * 0.32, p.w - 12, 6);
          break;
        case 'pole':
          ctx.fillStyle = '#8D99AE';
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#EF476F';
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2); ctx.fill();
          break;
        case 'cone':
          ctx.fillStyle = '#F4A261';
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath(); ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2); ctx.fill();
          break;
      }
    }
  }

  // ---------- سکه‌ها ----------
  private drawCoins(ctx: CanvasRenderingContext2D, time = performance.now() / 1000): void {
    for (const c of this.world.coins) {
      if (c.taken) continue;
      if (!this.camera.isVisible(c.x - 30, c.y - 30, 60, 60)) continue;
      const bob = Math.sin(time * 3 + c.seed) * 4;
      const squash = 0.72 + Math.abs(Math.cos(time * 2.6 + c.seed)) * 0.28; // چرخش ظاهری
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.scale(squash, 1);
      ctx.fillStyle = '#F2B705';
      ctx.strokeStyle = '#B8801A';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFF3D6';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------- ماشین بازیکن ----------
  private drawCar(ctx: CanvasRenderingContext2D, car: Vehicle): void {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const img = this.assets.get('veh_player_01');
    if (img) {
      ctx.drawImage(img, -car.drawW / 2, -car.drawH / 2, car.drawW, car.drawH);
    } else {
      ctx.fillStyle = '#D64545';
      this.roundRect(ctx, -car.drawW / 2, -car.drawH / 2, car.drawW, car.drawH, 22);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.6 + alpha * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
