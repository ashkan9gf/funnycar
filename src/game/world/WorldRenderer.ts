/**
 * WorldRenderer.ts — رسم دنیا (فقط رسم؛ هیچ منطق گیم‌پلی)
 * ============================================================
 * ترتیب رسم: کاشی‌ها → رد لاستیک → ساختمان‌ها → پروپ‌ها → مخروط‌های رویداد
 *            → سکه‌ها → ترافیک → گربه → ماشین بازیکن → ذرات → حباب‌های محیطی
 * Culling: فقط آنچه در کادر دوربین است رسم می‌شود (ARCHITECTURE بخش ۱۰)
 */

import type { AssetManager } from '../core/AssetManager';
import type { Camera } from '../core/Camera';
import type { Vehicle } from '../entities/Vehicle';
import type { TrafficCar } from '../entities/TrafficCar';
import type { World } from './World';
import type { EventCat, EventCone } from '../managers/RandomEventManager';
import { RENDER } from '../data/balance';
import { RANDOM_EVENTS as RE } from '../data/balance';

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
}

/** رد لاستیک (درفت) — کوتاه و محو شونده */
interface SkidMark {
  x: number; y: number;
  angle: number;
  life: number;
}

/** حباب گفتگوی محیطی (ترافیک/رویداد) — مستقل از VoiceManager بازیکن */
interface AmbientBubble {
  text: string;
  x: number; y: number;
  portraitId?: string;
  ttl: number; maxTtl: number;
}

const T = RENDER.tileSize;
const SKID_MAX = 260;
const SKID_LIFE = 3.4;

export class WorldRenderer {
  private particles: Particle[] = [];
  private skids: SkidMark[] = [];
  private bubbles: AmbientBubble[] = [];

  constructor(
    private assets: AssetManager,
    private world: World,
    private camera: Camera,
  ) {}

  // ---------- APIهای ورودی از GameManager ----------

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

  /** رد لاستیک در محل محور عقب هنگام درفت */
  addSkidMark(x: number, y: number, angle: number): void {
    if (this.skids.length >= SKID_MAX) this.skids.shift();
    this.skids.push({ x, y, angle, life: SKID_LIFE });
  }

  /** حباب گفتگوی محیطی (مثلاً راننده تاکسی جواب بوق می‌دهد) */
  pushBubble(text: string, x: number, y: number, portraitId?: string, ttl = 2.6): void {
    if (this.bubbles.length >= 3) this.bubbles.shift();
    this.bubbles.push({ text, x, y, portraitId, ttl, maxTtl: ttl });
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
    for (let i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      this.bubbles[i].ttl -= dt;
      if (this.bubbles[i].ttl <= 0) this.bubbles.splice(i, 1);
    }
  }

  // ============ رسم اصلی ============

  draw(
    ctx: CanvasRenderingContext2D,
    car: Vehicle,
    traffic: TrafficCar[] = [],
    cat: EventCat | null = null,
    cones: EventCone[] = [],
  ): void {
    const cam = this.camera;
    const left = cam.offsetX();
    const top = cam.offsetY();
    const viewW = cam.halfW * 2;
    const viewH = cam.halfH * 2;

    ctx.save();
    ctx.translate(-left, -top);

    this.drawTiles(ctx, left, top, viewW, viewH);
    this.drawSkids(ctx);
    this.drawBuildings(ctx);
    this.drawProps(ctx);
    this.drawEventCones(ctx, cones);
    this.drawCoins(ctx);
    this.drawTraffic(ctx, traffic);
    this.drawCat(ctx, cat);
    this.drawCar(ctx, car);
    this.drawParticles(ctx);

    ctx.restore();

    // حباب‌های محیطی — با مختصات دنیا ولی خارج از restore اول (هم‌الگو با حباب بازیکن)
    ctx.save();
    ctx.translate(-left, -top);
    this.drawAmbientBubbles(ctx);
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

  // ---------- رد لاستیک (درفت) ----------
  private drawSkids(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.strokeStyle = 'rgba(45,38,35,0.5)';
    ctx.lineCap = 'round';
    for (const s of this.skids) {
      if (!this.camera.isVisible(s.x - 14, s.y - 14, 28, 28)) continue;
      const a = Math.max(0, Math.min(1, s.life / SKID_LIFE));
      ctx.globalAlpha = a * 0.55;
      ctx.lineWidth = 7;
      ctx.beginPath();
      // دو خط کوتاه موازی = دو لاستیک عقب
      const ox = Math.cos(s.angle) * 6;
      const oy = Math.sin(s.angle) * 6;
      const dx = Math.sin(s.angle) * 7;
      const dy = -Math.cos(s.angle) * 7;
      ctx.moveTo(s.x - dx - ox, s.y - dy - oy);
      ctx.lineTo(s.x + dx - ox, s.y + dy - oy);
      ctx.moveTo(s.x - dx + ox, s.y - dy + oy);
      ctx.lineTo(s.x + dx + ox, s.y + dy + oy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ---------- ساختمان‌ها ----------
  private drawBuildings(ctx: CanvasRenderingContext2D): void {
    for (const p of this.world.props) {
      if (p.kind !== 'building') continue;
      if (!this.camera.isVisible(p.x, p.y, p.w, p.h, 140)) continue;

      const img = p.assetId ? this.assets.get(p.assetId) : undefined;
      if (img) {
        // Asset واقعی (Batch 2) — خودش سایه دارد؛ اندازه با حفظ نسبت داخل کادر
        const iw = this.assets.getSize(p.assetId as string);
        const scale = Math.min(p.w / iw.w, p.h / iw.h);
        const dw = iw.w * scale;
        const dh = iw.h * scale;
        ctx.drawImage(img, p.x + (p.w - dw) / 2, p.y + (p.h - dh) / 2, dw, dh);
      } else {
        // fallback برنامه‌ای برچسب‌دار (وقتی Asset نیست)
        const cx = p.x + p.w / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        this.roundRect(ctx, p.x + 10, p.y + 14, p.w, p.h, 26);
        ctx.fill();
        ctx.fillStyle = p.tint ?? '#2A9D8F';
        ctx.strokeStyle = '#3A2E2A';
        ctx.lineWidth = 8;
        this.roundRect(ctx, p.x, p.y, p.w, p.h, 26);
        ctx.fill();
        ctx.stroke();
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
        ctx.fillStyle = 'rgba(58,46,42,0.55)';
        ctx.font = '600 20px Vazirmatn, Tahoma, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PLACEHOLDER_ENVIRONMENT', cx, p.y + p.h - 30);
      }
    }
  }

  // ---------- پروپ‌ها ----------
  private drawProps(ctx: CanvasRenderingContext2D): void {
    for (const p of this.world.props) {
      if (p.kind === 'building') continue;
      if (!this.camera.isVisible(p.x, p.y, p.w, p.h)) continue;
      this.drawConeOrProp(ctx, p.kind, p.x, p.y, p.w, p.h);
    }
  }

  /** مخروط‌های رویداد تصادفی — همان ظاهر مخروط ثابت */
  private drawEventCones(ctx: CanvasRenderingContext2D, cones: EventCone[]): void {
    const s = 54;
    for (const c of cones) {
      if (!this.camera.isVisible(c.x - s, c.y - s, s * 2, s * 2)) continue;
      // محو شدن در دو ثانیه آخر عمر
      const fade = Math.min(1, c.ttl / 2);
      ctx.globalAlpha = fade;
      this.drawConeOrProp(ctx, 'cone', c.x - s / 2, c.y - s / 2, s, s);
      ctx.globalAlpha = 1;
    }
  }

  /** رسم یک پروپ (درخت/سطل/تیر/مخروط) — مشترک بین ثابت و رویدادی */
  private drawConeOrProp(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, w: number, h: number): void {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.min(w, h) / 2;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#3A2E2A';
    switch (kind) {
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
        this.roundRect(ctx, x, y, w, h * 1.05, 10);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(58,46,42,0.35)';
        ctx.fillRect(x + 6, y + h * 0.32, w - 12, 6);
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

  // ---------- ترافیک (فاز 2) ----------
  private drawTraffic(ctx: CanvasRenderingContext2D, cars: TrafficCar[]): void {
    for (const c of cars) {
      if (!this.camera.isVisible(c.x - c.drawW, c.y - c.drawH, c.drawW * 2, c.drawH * 2)) continue;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      const img = this.assets.get(c.assetId);
      if (img) {
        ctx.drawImage(img, -c.drawW / 2, -c.drawH / 2, c.drawW, c.drawH);
      } else {
        // fallback برنامه‌ای برچسب‌دار
        ctx.fillStyle = '#8AC926';
        ctx.strokeStyle = '#3A2E2A';
        ctx.lineWidth = 5;
        this.roundRect(ctx, -c.drawW / 2, -c.drawH / 2, c.drawW, c.drawH, 18);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---------- گربه (رویداد تصادفی — رسم برنامه‌ای بامزه) ----------
  private drawCat(ctx: CanvasRenderingContext2D, cat: EventCat | null): void {
    if (!cat) return;
    if (!this.camera.isVisible(cat.x - 40, cat.y - 40, 80, 80)) return;
    const s = RE.catSize;
    const t = performance.now() / 1000;
    const bob = Math.sin(t * 10 + cat.seed) * 1.6;
    const cx = cat.x;
    const cy = cat.y + bob;

    ctx.save();
    // جهت حرکت
    const ang = Math.atan2(cat.vy, cat.vx);
    ctx.translate(cx, cy);
    ctx.rotate(ang + Math.PI / 2);

    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#3A2E2A';
    // بدن
    ctx.fillStyle = '#3D3A3A';
    ctx.beginPath();
    ctx.ellipse(0, 2, s * 0.34, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // سر
    ctx.beginPath();
    ctx.arc(0, -s * 0.42, s * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // گوش‌ها
    ctx.beginPath();
    ctx.moveTo(-s * 0.22, -s * 0.56);
    ctx.lineTo(-s * 0.3, -s * 0.78);
    ctx.lineTo(-s * 0.08, -s * 0.64);
    ctx.moveTo(s * 0.22, -s * 0.56);
    ctx.lineTo(s * 0.3, -s * 0.78);
    ctx.lineTo(s * 0.08, -s * 0.64);
    ctx.closePath();
    ctx.fillStyle = '#3D3A3A';
    ctx.fill();
    ctx.stroke();
    // چشم‌ها (زرد)
    ctx.fillStyle = '#F2B705';
    ctx.beginPath();
    ctx.arc(-s * 0.1, -s * 0.44, s * 0.06, 0, Math.PI * 2);
    ctx.arc(s * 0.1, -s * 0.44, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
    // دم
    ctx.strokeStyle = '#3A2E2A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.5);
    ctx.quadraticCurveTo(s * 0.35, s * 0.6 + Math.sin(t * 6 + cat.seed) * 3, s * 0.28, s * 0.85);
    ctx.stroke();
    ctx.restore();
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

  // ---------- حباب‌های محیطی ----------
  private drawAmbientBubbles(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bubbles) {
      const alpha = Math.min(1, b.ttl / 0.4); // محو در آخر
      ctx.globalAlpha = Math.max(0, alpha);
      this.drawBubbleBox(ctx, b.text, b.x, b.y, 90, b.portraitId);
      ctx.globalAlpha = 1;
    }
  }

  /**
   * جعبه حباب RTL با پرتره — مشترک بین حباب بازیکن (GameManager) و محیطی
   * (anchor = نقطه ماشین؛ clamp داخل کادر دوربین)
   */
  drawBubbleBox(
    ctx: CanvasRenderingContext2D,
    text: string,
    anchorX: number,
    anchorY: number,
    anchorH = 100,
    portraitId?: string,
  ): void {
    ctx.save();
    ctx.direction = 'rtl';
    ctx.font = '700 24px Vazirmatn, Tahoma, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const maxTextW = 260;
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width > maxTextW && current) {
        lines.push(current);
        current = w;
      } else current = test;
    }
    if (current) lines.push(current);

    const lineH = 32;
    const portraitR = 26;
    const bubbleW = Math.min(maxTextW + portraitR * 2 + 40, 360);
    const bubbleH = Math.max(72, lines.length * lineH + 34);

    const viewTop = this.camera.y - this.camera.halfH;
    const viewBottom = this.camera.y + this.camera.halfH;
    const viewLeft = this.camera.x - this.camera.halfW;
    const viewRight = this.camera.x + this.camera.halfW;

    let bx = anchorX - bubbleW / 2;
    let by = anchorY - anchorH / 2 - bubbleH - 22;
    let tailBelow = false;
    if (by < viewTop + 8) {
      by = anchorY + anchorH / 2 + 22;
      tailBelow = true;
    }
    if (by + bubbleH > viewBottom - 8) by = viewBottom - 8 - bubbleH;
    if (by < viewTop + 8) by = viewTop + 8;
    bx = Math.min(Math.max(bx, viewLeft + 8), viewRight - 8 - bubbleW);

    // دم
    ctx.fillStyle = '#FFF9EC';
    ctx.strokeStyle = '#3A2E2A';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (tailBelow) {
      ctx.moveTo(anchorX - 13, by + 2);
      ctx.lineTo(anchorX, by - 20);
      ctx.lineTo(anchorX + 13, by + 2);
    } else {
      ctx.moveTo(anchorX - 13, by + bubbleH - 2);
      ctx.lineTo(anchorX, by + bubbleH + 20);
      ctx.lineTo(anchorX + 13, by + bubbleH - 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // بدنه
    ctx.beginPath();
    const r = 18;
    ctx.moveTo(bx + r, by);
    ctx.arcTo(bx + bubbleW, by, bx + bubbleW, by + bubbleH, r);
    ctx.arcTo(bx + bubbleW, by + bubbleH, bx, by + bubbleH, r);
    ctx.arcTo(bx, by + bubbleH, bx, by, r);
    ctx.arcTo(bx, by, bx + bubbleW, by, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // پرتره (دایره‌ای) سمت راست
    const pid = portraitId ?? 'char_driver_01_idle';
    const img = this.assets.get(pid);
    const pcx = bx + bubbleW - portraitR - 14;
    const pcy = by + bubbleH / 2;
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(pcx, pcy, portraitR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, pcx - portraitR, pcy - portraitR, portraitR * 2, portraitR * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = '#E8C39E';
      ctx.beginPath();
      ctx.arc(pcx, pcy, portraitR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#3A2E2A';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(pcx, pcy, portraitR, 0, Math.PI * 2);
    ctx.stroke();

    // متن
    ctx.fillStyle = '#3A2E2A';
    const textAreaCenter = bx + (bubbleW - portraitR * 2 - 18) / 2;
    lines.forEach((ln, i) => {
      ctx.fillText(ln, textAreaCenter, by + bubbleH / 2 + (i - (lines.length - 1) / 2) * lineH);
    });
    ctx.restore();
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
