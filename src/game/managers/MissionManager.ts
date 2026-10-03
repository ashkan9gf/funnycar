/**
 * MissionManager.ts — مدیر مأموریت‌ها (فاز 4 + فاز ۵: پارک دوبل/مسافرکشی/چالش)
 * ============================================================
 * - ماشین وضعیت: idle / active / succeeded / failed
 * - هیچ عددی Hard-Code نیست: محتوا از data/missions.ts، اعداد از balance.ts
 * - پنهان‌کاری با منطق ندارد: رویدادها را به GameManager برمی‌گرداند
 *   (صدا/ذرات/دیالوگ کار GameManager است؛ این کلاس فقط قوانین مأموریت)
 * - چاله‌ها فقط در مأموریت pothole_run ساخته می‌شوند (غیر برخوردی — «غُر» می‌کنی!)
 *
 * فاز ۵:
 *  - parallel_park: جای پارک بین دو «ماشین نگهبان» (با collider واقعی) —
 *    تراز + توقف + مکث کوتاه = موفق
 *  - taxi_fare: دو مرحله (سوار شدن → مقصد) + انعام اگر سریع برسی
 *  - checkpoint_run: عبور از نقاط به‌ترتیب
 *  - coin_rush: جمع‌آوری سکه (سکه‌ها را GameManager گزارش می‌کند)
 *  - currentTarget(): هدف «فعلی» برای HUD/فلش/بیکن — برای مأموریت‌های چندمرحله‌ای
 */

import { MISSIONS as M, PARK, TAXI, CHALLENGE, RENDER } from '../data/balance';
import { MISSION_LIST, type MissionDef, type MissionFailReason, type MissionCategory } from '../data/missions';
import { WORLD, WORLD_SIZE, type World } from '../world/World';
import type { Collider } from '../entities/Vehicle';

export type MissionState = 'idle' | 'active' | 'succeeded' | 'failed';

/** فاز مأموریت‌های چندمرحله‌ای (فعلاً فقط تاکسی) */
export type MissionPhase = 'only' | 'to_pickup' | 'to_target';

/** داده HUD مأموریت — اعداد فارسی‌سازی اینجا انجام می‌شود */
export interface MissionHud {
  id: string;
  title: string;
  objective: string;
  /** ثانیه باقی‌مانده؛ -1 = بدون تایمر */
  timeLeft: number;
  /** کل زمان مأموریت (برای نوار HUD)؛ 0 = بدون تایمر */
  timeLimit: number;
  /** فاصله نمایشی تا هدف فعلی (متر) */
  distM: number;
  /** متن وضعیت اضافه (تصادف/چاله/جریمه/راهنمای پارک...) */
  extra: string;
  /** وضعیت مأموریت */
  state: MissionState;
}

export interface MissionStats {
  elapsedSec: number;
  penaltySec: number;
  hardCrashes: number;
  potholeHits: number;
  /** فاز ۵: انعام تاکسی (سکه اضافه) — فقط taxi_fare موفق */
  bonusCoins: number;
  /** فاز ۵: تعداد چک‌پوینت/سکه انجام‌شده (برای گزارش) */
  progress: number;
}

export interface MissionCallbacks {
  /** هدف رسیده شد */
  onSucceed: (def: MissionDef, stats: MissionStats) => void;
  /** مأموریت شکست خورد */
  onFail: (def: MissionDef, reason: MissionFailReason, stats: MissionStats) => void;
  /** چاله! (تأثیر فیزیکی/صوتی کار GameManager) */
  onPothole: (x: number, y: number) => void;
  /** فاز ۵: مسافر سوار شد (حباب/صدا کار GameManager) */
  onTaxiPickup?: (x: number, y: number) => void;
  /** فاز ۵: یک چک‌پوینت رد شد (i از ۱ شروع می‌شود) */
  onCheckpoint?: (x: number, y: number, i: number, total: number) => void;
}

export interface Pothole {
  x: number; y: number;
  hit: boolean;
}

/** ماشین نگهبان جای پارک — فقط برای parallel_park (رندر + collider) */
export interface GuardCar {
  x: number; y: number;
  angle: number;
  kind: 'peugeot405' | 'samand';
  /** طول واقعی مدل (px) — برای collider و رندر */
  len: number;
}

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
/** تبدیل عدد به رقم فارسی (مشترک با HUD و فلش هدف) */
export function faNum(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** طول ماشین نگهبان — میانگین واقعی مدل‌ها؛ buildCar3D با همین عدد مقیاس می‌شود */
const GUARD_LEN = 195;

interface VehiclePos { x: number; y: number; speed: number; angle: number }

export class MissionManager {
  private state: MissionState = 'idle';
  private def: MissionDef | null = null;
  private elapsed = 0;
  private penaltySec = 0;
  private hardCrashes = 0;
  private potholeHits = 0;
  private potholes: Pothole[] = [];
  private completedIds: Set<string> = new Set();

  // ---------- فاز ۵ ----------
  /** فاز فعلی (تاکسی: to_pickup → to_target) */
  private phase: MissionPhase = 'only';
  /** شمارنده چک‌پوینت عبورشده */
  private checkpointIdx = 0;
  /** تعداد سکه جمع‌شده (coin_rush) */
  private coinsGot = 0;
  /** تایمر مکث پارک/توقف تاکسی */
  private holdT = 0;
  /** ماشین‌های نگهبان پارک (فقط parallel_park) */
  private guards: GuardCar[] = [];
  /** colliderهای نگهبان — برای حذف دقیق از world.colliders */
  private guardColliders: Collider[] = [];
  /** انعام تاکسی (در finish محاسبه می‌شود) */
  private tipCoins = 0;

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

  /** فاز ۵: فاز فعلی مأموریت (تاکسی) */
  getPhase(): MissionPhase {
    return this.phase;
  }

  /** فاز ۵: پیشرفت (چک‌پوینت ردشده یا سکه) */
  getProgress(): number {
    if (!this.def) return 0;
    if (this.def.kind === 'checkpoint_run') return this.checkpointIdx;
    if (this.def.kind === 'coin_rush') return this.coinsGot;
    return 0;
  }

  /** فاز ۵: ماشین‌های نگهبان جای پارک (برای رندر سه‌بعدی) */
  getGuardCars(): GuardCar[] {
    return this.state === 'active' ? this.guards : [];
  }

  /**
   * فاز ۵: هدف «فعلی» مأموریت — برای بیکن/فلش/HUD.
   * تاکسی: اول جای سوارشدن، بعد مقصد. چک‌پوینت: نقطه بعدی.
   * سکه: نزدیک‌ترین سکه برداشته‌نشده.
   */
  currentTarget(vehicle?: VehiclePos): { x: number; y: number } | null {
    const def = this.def;
    if (!def || this.state !== 'active') return null;
    switch (def.kind) {
      case 'taxi_fare':
        return this.phase === 'to_pickup' ? (def.pickup ?? def.target) : def.target;
      case 'checkpoint_run':
        return def.checkpoints?.[this.checkpointIdx] ?? def.target;
      case 'coin_rush': {
        if (!vehicle) return def.target;
        let best: { x: number; y: number } | null = null;
        let bestD = Infinity;
        for (const c of this.world.coins) {
          if (c.taken) continue;
          const d = (c.x - vehicle.x) ** 2 + (c.y - vehicle.y) ** 2;
          if (d < bestD) { bestD = d; best = { x: c.x, y: c.y }; }
        }
        return best;
      }
      default:
        return def.target;
    }
  }

  /** لیست مأموریت‌ها برای منو (با وضعیت انجام‌شدگی + فیلتر دسته فاز ۵)
   *  فاز ۷: قفل زنجیره — مأموریت‌های requires تا تمام‌شدن مأموریت مرجع قفل‌اند */
  list(completed: string[], category?: MissionCategory): Array<MissionDef & { done: boolean; locked: boolean; requiresTitle: string | null }> {
    this.completedIds = new Set(completed);
    return MISSION_LIST
      .filter((m) => !category || (m.category ?? 'story') === category)
      .map((m) => {
        const req = m.requires ? MISSION_LIST.find((x) => x.id === m.requires) : undefined;
        const locked = m.requires !== undefined && !this.completedIds.has(m.requires);
        return { ...m, done: this.completedIds.has(m.id), locked, requiresTitle: req?.title ?? null };
      });
  }

  /** شروع مأموریت — همیشه از وضعیت تمیز (قفل زنجیره‌ای فاز ۷ رعایت می‌شود)
   *  فاز ENDLESS: اگر بازیکن بیرون تهرانِ مبدأ باشد، هدف با مضرب pitch جابه‌جا می‌شود
   *  (چیدمان خیابان در مضرب‌های ۱۴۰۰ تکرار می‌شود → هدف روی جادهٔ معتبر همان حوالی بازیکن) */
  start(id: string, near?: { x: number; y: number }): boolean {
    const def = MISSION_LIST.find((m) => m.id === id);
    if (!def) return false;
    // فاز ۷: مأموریت قفل شروع نمی‌شود (نگهبان امنیتی — UI هم قفل نشان می‌دهد)
    if (def.requires !== undefined && !this.completedIds.has(def.requires)) return false;
    this.cleanupMissionWorld(); // اگر مأموریت قبلی نگهبان داشته — جمع کن
    this.def = this.retargetDef(def, near);
    this.startPos = near ? { x: near.x, y: near.y } : null;
    this.state = 'active';
    this.elapsed = 0;
    this.penaltySec = 0;
    this.hardCrashes = 0;
    this.potholeHits = 0;
    this.phase = def.kind === 'taxi_fare' ? 'to_pickup' : 'only';
    this.checkpointIdx = 0;
    this.coinsGot = 0;
    this.holdT = 0;
    this.tipCoins = 0;
    this.guards = def.kind === 'parallel_park' ? this.spawnGuards(def) : [];
    this.potholes = def.kind === 'pothole_run' ? this.spawnPotholes(def) : [];
    return true;
  }

  /** انصراف بازیکن یا برگشت به منو */
  abort(): void {
    this.cleanupMissionWorld();
    this.state = 'idle';
    this.def = null;
    this.potholes = [];
  }

  /** نقطهٔ شروع مأموریت (برای چاله‌ها) — نزدیک بازیکن در دنیای بی‌پایان */
  private startPos: { x: number; y: number } | null = null;

  /** فاز ENDLESS: جابه‌جایی هدف مأموریت با مضرب pitch وقتی بازیکن دورِ مبدأ است */
  private retargetDef(def: MissionDef, near?: { x: number; y: number }): MissionDef {
    if (!near) return def;
    const P = WORLD.pitch;
    const outside =
      near.x < -P || near.y < -P ||
      near.x > WORLD_SIZE + P || near.y > WORLD_SIZE + P;
    if (!outside) return def;
    const t = def.target;
    const sx = Math.round((near.x - t.x) / P) * P;
    const sy = Math.round((near.y - t.y) / P) * P;
    if (sx === 0 && sy === 0) return def;
    const shift = (p: { x: number; y: number }): { x: number; y: number } => ({ x: p.x + sx, y: p.y + sy });
    return {
      ...def,
      target: shift(t),
      pickup: def.pickup ? shift(def.pickup) : undefined,
      checkpoints: def.checkpoints ? def.checkpoints.map(shift) : undefined,
    };
  }

  /** وضعیت نتیجه باید توسط GameManager مصرف و بعد پاک شود */
  clearResult(): void {
    if (this.state === 'succeeded' || this.state === 'failed') {
      this.cleanupMissionWorld();
      this.state = 'idle';
      this.def = null;
      this.potholes = [];
    }
  }

  // ============ رویدادهای ورودی از GameManager ============

  /** GameManager هر برخورد را گزارش می‌دهد (طبق COLLISION) */
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
      case 'taxi_fare':
        // مسافر سرنشین داره! تصادف شدید = جریمه وقت
        if (severity === 'hard') this.penaltySec += M.hardCrashTimePenalty;
        break;
      case 'parallel_park':
      case 'checkpoint_run':
      case 'coin_rush':
      case 'pothole_run':
        break; // آزاد — تمرکز روی هدف اصلی است
    }
  }

  /** فاز ۵: سکه جمع شد (برای coin_rush) — تعداد را GameManager می‌دهد */
  onCoinCollected(count: number): void {
    if (this.state !== 'active' || !this.def) return;
    if (this.def.kind !== 'coin_rush') return;
    this.coinsGot += count;
    if (this.coinsGot >= (this.def.coinTarget ?? 0)) {
      this.finish(true);
    }
  }

  // ============ حلقه ============

  update(dt: number, vehicle: VehiclePos): void {
    if (this.state !== 'active' || !this.def) return;
    const def = this.def;
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
        if (this.potholeHits > (def.maxPotholes ?? 0)) {
          this.finish(false, 'too_many_potholes');
          return;
        }
      }
    }

    // ---------- پایان وقت ----------
    const limit = def.timeLimitSec;
    if (limit > 0 && this.elapsed + this.penaltySec >= limit) {
      this.finish(false, def.kind === 'parallel_park' ? 'park_missed' : 'time_up');
      return;
    }

    // ---------- پارک دوبل (فاز ۵) ----------
    if (def.kind === 'parallel_park') {
      this.updatePark(dt, vehicle, def);
      return;
    }

    // ---------- مسافرکشی (فاز ۵) ----------
    if (def.kind === 'taxi_fare') {
      this.updateTaxi(dt, vehicle, def);
      return;
    }

    // ---------- چالش چک‌پوینت (فاز ۵) ----------
    if (def.kind === 'checkpoint_run') {
      const cps = def.checkpoints ?? [];
      const cp = cps[this.checkpointIdx];
      if (cp) {
        const d = Math.hypot(cp.x - vehicle.x, cp.y - vehicle.y);
        if (d < CHALLENGE.checkpointRadius) {
          this.checkpointIdx++;
          this.holdT = 0;
          this.callbacks.onCheckpoint?.(cp.x, cp.y, this.checkpointIdx, cps.length);
          if (this.checkpointIdx >= cps.length) {
            this.finish(true);
            return;
          }
        }
      }
      return; // پایان با چک‌پوینت آخر یا اتمام وقت
    }

    // ---------- رسیدن به هدف (انواع کلاسیک) ----------
    const d = Math.hypot(def.target.x - vehicle.x, def.target.y - vehicle.y);
    if (d < M.reachRadius) this.finish(true);
  }

  /** منطق پارک دوبل — تراز + توقف + مکث (فاز ۵) */
  private updatePark(dt: number, v: VehiclePos, def: MissionDef): void {
    const spotAngle = def.spotAngle ?? 0;
    const dx = v.x - def.target.x;
    const dy = v.y - def.target.y;
    // محور طولی/عرضی جای پارک بر اساس راستای جاده
    const horizontal = Math.abs(Math.sin(spotAngle)) > 0.5;
    const along = horizontal ? dx : dy;
    const lateral = horizontal ? dy : dx;

    // انحراف زاویه روی محور (mod π — پارک در هر دو جهت قبول است)
    let angDev = (v.angle - spotAngle) % Math.PI;
    if (angDev < 0) angDev += Math.PI;
    if (angDev > Math.PI / 2) angDev = Math.PI - angDev;

    const aligned =
      Math.abs(lateral) < PARK.lateralTol &&
      Math.abs(along) < PARK.alongTol &&
      angDev < PARK.angleTol;

    if (aligned && Math.abs(v.speed) < PARK.stopSpeed) {
      this.holdT += dt;
      if (this.holdT >= PARK.holdSec) this.finish(true);
    } else {
      this.holdT = 0;
    }
  }

  /** منطق تاکسی — توقف در جای سوارشدن، سپس مقصد (فاز ۵) */
  private updateTaxi(dt: number, v: VehiclePos, def: MissionDef): void {
    const stopped = Math.abs(v.speed) < TAXI.stopSpeed;
    if (stopped) this.holdT += dt;
    else this.holdT = 0;

    if (this.phase === 'to_pickup') {
      const pk = def.pickup ?? def.target;
      const d = Math.hypot(pk.x - v.x, pk.y - v.y);
      if (d < TAXI.pickupRadius && this.holdT >= TAXI.stopHoldSec) {
        this.phase = 'to_target';
        this.holdT = 0;
        this.callbacks.onTaxiPickup?.(pk.x, pk.y);
      }
      return;
    }

    // to_target — رسیدن + توقف کامل = پیاده شدن
    const d = Math.hypot(def.target.x - v.x, def.target.y - v.y);
    if (d < M.reachRadius && this.holdT >= TAXI.stopHoldSec) {
      this.finish(true);
    }
  }

  // ============ HUD ============

  hud(vehicle: VehiclePos): MissionHud | null {
    if (!this.def) return null;
    const def = this.def;
    const tgt = this.currentTarget(vehicle);
    let extra = '';
    if (def.kind === 'tolerant_reach') {
      extra = `تصادف شدید: ${faNum(this.hardCrashes)}/${faNum(def.maxHardCrashes ?? 0)}`;
    } else if (def.kind === 'pothole_run') {
      extra = `چاله: ${faNum(this.potholeHits)}/${faNum(def.maxPotholes ?? 0)}`;
    } else if ((def.kind === 'timed_reach' || def.kind === 'taxi_fare') && this.penaltySec > 0) {
      extra = `جریمه: ${faNum(Math.round(this.penaltySec))} ثانیه`;
    } else if (def.kind === 'fragile_reach') {
      extra = 'بدون تصادف!';
    } else if (def.kind === 'checkpoint_run') {
      extra = `چک‌پوینت: ${faNum(this.checkpointIdx)}/${faNum(def.checkpoints?.length ?? 0)}`;
    } else if (def.kind === 'coin_rush') {
      extra = `سکه: ${faNum(this.coinsGot)}/${faNum(def.coinTarget ?? 0)}`;
    } else if (def.kind === 'parallel_park') {
      extra = this.parkHudExtra(vehicle, def);
    } else if (def.kind === 'taxi_fare') {
      extra = this.phase === 'to_pickup' ? 'برو سر جای سوارشدن و وایسا' : 'مسافر سرنشین داره — برسونش!';
    }
    return {
      id: def.id,
      title: def.title,
      objective: def.objective,
      timeLeft: def.timeLimitSec > 0
        ? Math.max(0, def.timeLimitSec - this.elapsed - this.penaltySec)
        : -1,
      timeLimit: def.timeLimitSec,
      distM: tgt ? Math.round(Math.hypot(tgt.x - vehicle.x, tgt.y - vehicle.y) / M.pxPerMeter) : 0,
      extra,
      state: this.state,
    };
  }

  /** متن راهنمای زنده پارک (فاز ۵) */
  private parkHudExtra(v: VehiclePos, def: MissionDef): string {
    const spotAngle = def.spotAngle ?? 0;
    const horizontal = Math.abs(Math.sin(spotAngle)) > 0.5;
    const lateral = horizontal ? v.y - def.target.y : v.x - def.target.x;
    let angDev = (v.angle - spotAngle) % Math.PI;
    if (angDev < 0) angDev += Math.PI;
    if (angDev > Math.PI / 2) angDev = Math.PI - angDev;
    const deg = Math.round((angDev * 180) / Math.PI);

    if (this.holdT > 0) return `داری پارک می‌کنی... ${faNum(Math.max(0, Math.ceil((PARK.holdSec - this.holdT) * 10) / 10))} ثانیه`;
    const latM = (Math.abs(lateral) / M.pxPerMeter).toFixed(1).replace('.', '٫');
    if (angDev >= PARK.angleTol) return `تراز کن! زاویه: ${faNum(deg)}°`;
    return `فاصله جانبی: ${faNum(latM)}م — دنده‌عقب یا جلو برو`;
  }

  // ============ داخلی ============

  private finish(success: boolean, reason?: MissionFailReason): void {
    if (!this.def) return;
    const def = this.def;
    // انعام تاکسی: اگر سریع رسید (فاز ۵)
    if (success && def.kind === 'taxi_fare' && def.timeLimitSec > 0) {
      const leftFrac = Math.max(0, 1 - (this.elapsed + this.penaltySec) / def.timeLimitSec);
      if (leftFrac >= TAXI.tipTimeFrac) {
        this.tipCoins = Math.round(def.rewardCoins * TAXI.tipFactor);
      }
    }
    const stats: MissionStats = {
      elapsedSec: Math.round(this.elapsed * 10) / 10,
      penaltySec: this.penaltySec,
      hardCrashes: this.hardCrashes,
      potholeHits: this.potholeHits,
      bonusCoins: this.tipCoins,
      progress: def.kind === 'checkpoint_run' ? this.checkpointIdx : this.coinsGot,
    };
    this.state = success ? 'succeeded' : 'failed';
    // ماشین‌های نگهبان بعد از پایان آزاد می‌شوند (خیابان عادی می‌شود)
    this.removeGuardColliders();
    this.guards = [];
    if (success) {
      this.completedIds.add(def.id);
      this.callbacks.onSucceed(def, stats);
    } else {
      this.callbacks.onFail(def, reason ?? 'time_up', stats);
    }
  }

  /**
   * ماشین‌های نگهبان پارک — دو طرف جای پارک (فاز ۵)
   * قطعی: یک ۴۰۵ بالا و یک سمند پایین (بر اساس زوجیت مختصات)
   */
  private spawnGuards(def: MissionDef): GuardCar[] {
    const spotAngle = def.spotAngle ?? 0;
    const spotLen = def.spotLen ?? 320;
    const off = spotLen / 2 + GUARD_LEN / 2 + PARK.guardGap;
    const horizontal = Math.abs(Math.sin(spotAngle)) > 0.5;
    const flip = (def.target.x + def.target.y) % 2 === 0;
    const mk = (i: number): GuardCar => ({
      x: horizontal ? def.target.x + (i === 0 ? -off : off) : def.target.x,
      y: horizontal ? def.target.y : def.target.y + (i === 0 ? -off : off),
      angle: spotAngle,
      kind: (i === 0) === flip ? 'peugeot405' : 'samand',
      len: GUARD_LEN,
    });
    const g1 = mk(0);
    const g2 = mk(1);
    this.addGuardColliders(def, [g1, g2]);
    return [g1, g2];
  }

  /** collider ماشین‌های نگهبان — AABB (جای پارک‌ها همیشه محوری‌اند) */
  private addGuardColliders(def: MissionDef, guards: GuardCar[]): void {
    const hw = PARK.guardHitW;
    const hh = (GUARD_LEN * 0.9) / 2;
    for (const g of guards) {
      const horizontal = Math.abs(Math.sin(g.angle)) > 0.5;
      const c: Collider = horizontal
        ? { x: g.x - hh, y: g.y - hw, w: hh * 2, h: hw * 2 }
        : { x: g.x - hw, y: g.y - hh, w: hw * 2, h: hh * 2 };
      this.guardColliders.push(c);
      this.world.addDynamicCollider(c);
    }
  }

  /** حذف colliderهای نگهبان (identity — بدون دست زدن به بقیه دنیا) */
  private removeGuardColliders(): void {
    if (this.guardColliders.length === 0) return;
    this.world.removeDynamicColliders(this.guardColliders);
    this.guardColliders = [];
  }

  /** پاکسازی کامل دنیای مأموریت (نگهبان‌ها) — قبل از شروع جدید/انصراف/پاک‌کردن نتیجه */
  private cleanupMissionWorld(): void {
    this.removeGuardColliders();
    this.guards = [];
    this.phase = 'only';
    this.checkpointIdx = 0;
    this.coinsGot = 0;
    this.holdT = 0;
    this.tipCoins = 0;
  }

  /**
   * چاله‌ها: روی کاشی جاده، در دالان مسیر اسپاون→هدف، با فاصله‌گذاری
   * (Math.random فقط داخل قیدهای جغرافیایی — از دنیا بیرون نمی‌زند)
   */
  private spawnPotholes(def: MissionDef): Pothole[] {
    const out: Pothole[] = [];
    const spawn = this.startPos ?? this.world.playerSpawn();
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
