/**
 * MissionManager.ts — مدیر مأموریت‌ها (فاز 4 — Mode 2 سند طراحی)
 * ============================================================
 * - ماشین وضعیت: idle / active / succeeded / failed
 * - هیچ عددی Hard-Code نیست: محتوا از data/missions.ts، اعداد از balance.ts
 * - پنهان‌کاری با منطق ندارد: رویدادها را به GameManager برمی‌گرداند
 *   (صدا/ذرات/دیالوگ کار GameManager است؛ این کلاس فقط قوانین مأموریت)
 * - چاله‌ها فقط در مأموریت pothole_run ساخته می‌شوند (غیر برخوردی — «غُر» می‌کنی!)
 */

import { MISSIONS as M, RENDER } from '../data/balance';
import { MISSION_LIST, type MissionDef, type MissionFailReason } from '../data/missions';
import type { World } from '../world/World';

export type MissionState = 'idle' | 'active' | 'succeeded' | 'failed';

/** داده HUD مأموریت — اعداد فارسی‌سازی اینجا انجام می‌شود */
export interface MissionHud {
  id: string;
  title: string;
  objective: string;
  /** ثانیه باقی‌مانده؛ -1 = بدون تایمر */
  timeLeft: number;
  /** کل زمان مأموریت (برای نوار HUD)؛ 0 = بدون تایمر */
  timeLimit: number;
  /** فاصله نمایشی تا هدف (متر) */
  distM: number;
  /** متن وضعیت اضافه (تصادف/چاله/جریمه) */
  extra: string;
  /** وضعیت مأموریت */
  state: MissionState;
}

export interface MissionStats {
  elapsedSec: number;
  penaltySec: number;
  hardCrashes: number;
  potholeHits: number;
}

export interface MissionCallbacks {
  /** هدف رسیده شد */
  onSucceed: (def: MissionDef, stats: MissionStats) => void;
  /** مأموریت شکست خورد */
  onFail: (def: MissionDef, reason: MissionFailReason, stats: MissionStats) => void;
  /** چاله! (تأثیر فیزیکی/صوتی کار GameManager) */
  onPothole: (x: number, y: number) => void;
}

export interface Pothole {
  x: number; y: number;
  hit: boolean;
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
/** تبدیل عدد به رقم فارسی (مشترک با HUD و فلش هدف) */
export function faNum(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

interface VehiclePos { x: number; y: number; speed: number }

export class MissionManager {
  private state: MissionState = 'idle';
  private def: MissionDef | null = null;
  private elapsed = 0;
  private penaltySec = 0;
  private hardCrashes = 0;
  private potholeHits = 0;
  private potholes: Pothole[] = [];
  private completedIds: Set<string> = new Set();

  constructor(
    private readonly world: World,
    private readonly callbacks: MissionCallbacks,
  ) {}

  // ============ API عمومی ============

  getState(): MissionState {
    return this.state;
  }

  getDef(): MissionDef | null {
    return this.def;
  }

  getPotholes(): Pothole[] {
    return this.potholes;
  }

  /** لیست مأموریت‌ها برای منو (با وضعیت انجام‌شدگی) */
  list(completed: string[]): Array<MissionDef & { done: boolean }> {
    this.completedIds = new Set(completed);
    return MISSION_LIST.map((m) => ({ ...m, done: this.completedIds.has(m.id) }));
  }

  /** شروع مأموریت — همیشه از وضعیت تمیز */
  start(id: string): boolean {
    const def = MISSION_LIST.find((m) => m.id === id);
    if (!def) return false;
    this.def = def;
    this.state = 'active';
    this.elapsed = 0;
    this.penaltySec = 0;
    this.hardCrashes = 0;
    this.potholeHits = 0;
    this.potholes = def.kind === 'pothole_run' ? this.spawnPotholes(def) : [];
    return true;
  }

  /** انصراف بازیکن یا برگشت به منو */
  abort(): void {
    this.state = 'idle';
    this.def = null;
    this.potholes = [];
  }

  /** وضعیت نتیجه باید توسط GameManager مصرف و بعد پاک شود */
  clearResult(): void {
    if (this.state === 'succeeded' || this.state === 'failed') {
      this.state = 'idle';
      this.def = null;
      this.potholes = [];
    }
  }

  // ============ رویدادهای ورودی از GameManager ============

  /** GameManager هر برخورد را گزارش می‌دهد (طبقه‌بندی طبق COLLISION) */
  onCrash(severity: 'soft' | 'hard'): void {
    if (this.state !== 'active' || !this.def) return;
    if (severity === 'hard') this.hardCrashes++;

    switch (this.def.kind) {
      case 'fragile_reach':
        // ماشین لَخت! حتی یک تصادف = خاموشی
        this.finish(false, 'engine_died');
        break;
      case 'timed_reach':
        if (severity === 'hard') this.penaltySec += M.hardCrashTimePenalty;
        break;
      case 'tolerant_reach':
        if (this.hardCrashes > (this.def.maxHardCrashes ?? 0)) this.finish(false, 'too_many_crashes');
        break;
      case 'pothole_run':
        break; // تصادف آزاد است؛ چاله مهم است
    }
  }

  // ============ حلقه ============

  update(dt: number, vehicle: VehiclePos): void {
    if (this.state !== 'active' || !this.def) return;
    this.elapsed += dt;

    // ---------- چاله‌ها ----------
    for (const p of this.potholes) {
      if (p.hit) continue;
      const dx = p.x - vehicle.x;
      const dy = p.y - vehicle.y;
      if (dx * dx + dy * dy < M.potholeRadius * M.potholeRadius) {
        p.hit = true;
        this.potholeHits++;
        this.callbacks.onPothole(p.x, p.y);
        if (this.potholeHits > (this.def.maxPotholes ?? 0)) {
          this.finish(false, 'too_many_potholes');
          return;
        }
      }
    }

    // ---------- پایان وقت ----------
    const limit = this.def.timeLimitSec;
    if (limit > 0 && this.elapsed + this.penaltySec >= limit) {
      this.finish(false, 'time_up');
      return;
    }

    // ---------- رسیدن به هدف ----------
    const d = Math.hypot(this.def.target.x - vehicle.x, this.def.target.y - vehicle.y);
    if (d < M.reachRadius) this.finish(true);
  }

  // ============ HUD ============

  hud(vehicle: VehiclePos): MissionHud | null {
    if (!this.def) return null;
    const def = this.def;
    let extra = '';
    if (def.kind === 'tolerant_reach') {
      extra = `تصادف شدید: ${faNum(this.hardCrashes)}/${faNum(def.maxHardCrashes ?? 0)}`;
    } else if (def.kind === 'pothole_run') {
      extra = `چاله: ${faNum(this.potholeHits)}/${faNum(def.maxPotholes ?? 0)}`;
    } else if (def.kind === 'timed_reach' && this.penaltySec > 0) {
      extra = `جریمه: ${faNum(this.penaltySec)}s`;
    } else if (def.kind === 'fragile_reach') {
      extra = 'بدون تصادف!';
    }
    return {
      id: def.id,
      title: def.title,
      objective: def.objective,
      timeLeft: def.timeLimitSec > 0
        ? Math.max(0, def.timeLimitSec - this.elapsed - this.penaltySec)
        : -1,
      timeLimit: def.timeLimitSec,
      distM: Math.round(Math.hypot(def.target.x - vehicle.x, def.target.y - vehicle.y) / M.pxPerMeter),
      extra,
      state: this.state,
    };
  }

  // ============ داخلی ============

  private finish(success: boolean, reason?: MissionFailReason): void {
    if (!this.def) return;
    const def = this.def;
    const stats: MissionStats = {
      elapsedSec: Math.round(this.elapsed * 10) / 10,
      penaltySec: this.penaltySec,
      hardCrashes: this.hardCrashes,
      potholeHits: this.potholeHits,
    };
    this.state = success ? 'succeeded' : 'failed';
    if (success) {
      this.completedIds.add(def.id);
      this.callbacks.onSucceed(def, stats);
    } else {
      this.callbacks.onFail(def, reason ?? 'time_up', stats);
    }
  }

  /**
   * چاله‌ها: روی کاشی جاده، در دالان مسیر اسپاون→هدف، با فاصله‌گذاری
   * (Math.random فقط داخل قیدهای جغرافیایی — از دنیا بیرون نمی‌زند)
   */
  private spawnPotholes(def: MissionDef): Pothole[] {
    const out: Pothole[] = [];
    const spawn = this.world.playerSpawn();
    const minX = Math.min(spawn.x, def.target.x) - 260;
    const maxX = Math.max(spawn.x, def.target.x) + 260;
    const minY = Math.min(spawn.y, def.target.y) - 300;
    const maxY = Math.max(spawn.y, def.target.y) + 260;

    for (let t = 0; t < 90 && out.length < M.potholeCount; t++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      if (!this.isRoad(x, y)) continue;
      if (Math.hypot(x - spawn.x, y - spawn.y) < M.potholeSafeFromSpawn) continue;
      if (Math.hypot(x - def.target.x, y - def.target.y) < M.potholeSafeFromTarget) continue;
      let tooClose = false;
      for (const p of out) {
        if (Math.hypot(p.x - x, p.y - y) < M.potholeMinGap) { tooClose = true; break; }
      }
      if (tooClose) continue;
      out.push({ x, y, hit: false });
    }
    return out;
  }

  private isRoad(x: number, y: number): boolean {
    const k = this.world.tileAt(Math.floor(x / RENDER.tileSize), Math.floor(y / RENDER.tileSize));
    return k === 'road_v' || k === 'road_h' || k === 'cross';
  }
}
