/**
 * RandomEventManager.ts — رویدادهای تصادفی طنز واقعی (فاز 2)
 * ============================================================
 * سه رویداد سبک که دنیا را «زنده» می‌کنند:
 *  1) cat     — گربه از جاده رد می‌شود (غیر برخوردی + دیالوگ cat_event)
 *  2) cones   — چند مخروط جلوی بازیکن ظاهر می‌شود (غیر برخوردی، موقتی)
 *  3) taxi    — تاکسیِ نزدیک بوق می‌زند و حباب طنز می‌دهد
 * همه اعداد از RANDOM_EVENTS (balance) — هیچ عدد Hard-Code
 * اسپاون فقط روی کاشی جاده و داخل دنیا؛ اگر جای معتبر نبود، رویداد رد می‌شود.
 */

import { RANDOM_EVENTS as RE, RENDER } from '../data/balance';
import { WORLD, WORLD_SIZE } from '../world/World';
import { TRAFFIC } from '../data/balance';

export type RandomEventKind = 'cat' | 'cones' | 'taxi';

export interface EventCat {
  x: number; y: number;
  vx: number; vy: number;
  ttl: number;
  seed: number;
}

export interface EventCone {
  x: number; y: number;
  ttl: number;
}

export interface RandomEventCallbacks {
  /** رویداد اجرا شد — برای صدا/دیالوگ (kind، نقطه) */
  onEvent?: (kind: RandomEventKind, x: number, y: number) => void;
}

interface PlayerPos { x: number; y: number; angle: number }

const TS = RENDER.tileSize;

export class RandomEventManager {
  cat: EventCat | null = null;
  cones: EventCone[] = [];

  private timer = RE.minIntervalSec + Math.random() * (RE.maxIntervalSec - RE.minIntervalSec);
  private lastKind: RandomEventKind | null = null;

  constructor(
    private readonly world: { tileAt(c: number, r: number): string },
    private readonly callbacks: RandomEventCallbacks = {},
  ) {}

  update(dt: number, player: PlayerPos): void {
    // ---------- گربه ----------
    if (this.cat) {
      const c = this.cat;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.ttl -= dt;
      if (c.ttl <= 0 || c.x < 0 || c.y < 0 || c.x > WORLD_SIZE || c.y > WORLD_SIZE) this.cat = null;
    }

    // ---------- مخروط‌ها ----------
    for (let i = this.cones.length - 1; i >= 0; i--) {
      this.cones[i].ttl -= dt;
      if (this.cones[i].ttl <= 0) this.cones.splice(i, 1);
    }

    // ---------- تایمر رویداد ----------
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = RE.minIntervalSec + Math.random() * (RE.maxIntervalSec - RE.minIntervalSec);
      this.fireRandom(player);
    }
  }

  private fireRandom(player: PlayerPos): void {
    const kinds: RandomEventKind[] = ['cat', 'cones', 'taxi'];
    // از تکرار همان رویداد پشت سر هم پرهیز کن
    const pool = kinds.filter((k) => k !== this.lastKind);
    const kind = pool[Math.floor(Math.random() * pool.length)];
    this.lastKind = kind;

    switch (kind) {
      case 'cat': this.spawnCat(player); break;
      case 'cones': this.spawnCones(player); break;
      case 'taxi': this.callbacks.onEvent?.('taxi', player.x, player.y); break;
    }
  }

  /** آیا نقطه روی کاشی جاده است؟ */
  private isRoad(x: number, y: number): boolean {
    const k = this.world.tileAt(Math.floor(x / TS), Math.floor(y / TS));
    return k === 'road_v' || k === 'road_h' || k === 'cross';
  }

  /** گربه: از جاده نزدیک بازیکن عرضی رد می‌شود */
  private spawnCat(player: PlayerPos): void {
    for (let t = 0; t < 16; t++) {
      // نقطه‌ای روی جاده در فاصله 180..420 از بازیکن
      const a = Math.random() * Math.PI * 2;
      const d = 180 + Math.random() * 240;
      const x = Math.max(60, Math.min(WORLD_SIZE - 60, player.x + Math.cos(a) * d));
      const y = Math.max(60, Math.min(WORLD_SIZE - 60, player.y + Math.sin(a) * d));
      if (!this.isRoad(x, y)) continue;

      // جهت عبور: عمود بر جاده زیر پا
      const kind = this.world.tileAt(Math.floor(x / TS), Math.floor(y / TS));
      const crossX = kind === 'road_h'; // جاده افقی → گربه عمودی رد می‌شود
      const sgn = Math.random() < 0.5 ? 1 : -1;
      const v = RE.catSpeed * sgn;
      // از یک سمت جاده شروع کن (کمی بیرون لبه)
      const startX = crossX ? x : x - sgn * (WORLD.roadW / 2 + 26);
      const startY = crossX ? y - sgn * (WORLD.roadW / 2 + 26) : y;
      // طول مسیر عبور + حاشیه
      const travel = WORLD.roadW + 52;
      this.cat = {
        x: startX,
        y: startY,
        vx: crossX ? 0 : v,
        vy: crossX ? v : 0,
        ttl: travel / RE.catSpeed + 1.2,
        seed: Math.random() * Math.PI * 2,
      };
      this.callbacks.onEvent?.('cat', x, y);
      return;
    }
  }

  /** مخروط‌ها: چند عدد روی جاده جلوی بازیکن (غیر برخوردی) */
  private spawnCones(player: PlayerPos): void {
    const fx = Math.sin(player.angle);
    const fy = -Math.cos(player.angle);
    for (let t = 0; t < 16; t++) {
      const dist = 220 + Math.random() * 200;
      const cx = player.x + fx * dist;
      const cy = player.y + fy * dist;
      if (cx < 60 || cy < 60 || cx > WORLD_SIZE - 60 || cy > WORLD_SIZE - 60) continue;
      if (!this.isRoad(cx, cy)) continue;

      // ردیف مخروط عمود بر جهت جاده (حدوداً عمود بر جهت بازیکن)
      const px = -fy;
      const py = fx;
      for (let i = 0; i < RE.coneCount; i++) {
        const off = (i - (RE.coneCount - 1) / 2) * 52;
        this.cones.push({ x: cx + px * off, y: cy + py * off, ttl: RE.coneLifetimeSec });
      }
      this.callbacks.onEvent?.('cones', cx, cy);
      return;
    }
  }

  /** نزدیک‌ترین ترافیک از نوع تاکسی (برای رویداد taxi) */
  nearestTaxi(list: Array<{ x: number; y: number; assetId: string }>, px: number, py: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const c of list) {
      if (!c.assetId.includes('taxi')) continue;
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < bestD) { bestD = d; best = { x: c.x, y: c.y }; }
    }
    return best;
  }

  /** رویداد taxi نیاز به فاصله معقول دارد */
  static readonly taxiMinDistance = 140;
  static readonly taxiMaxDistance = TRAFFIC.honkReactionRadius;
}
