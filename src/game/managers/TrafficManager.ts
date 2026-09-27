/**
 * TrafficManager.ts — مدیر ترافیک: شبکه جاده، لاین دست‌راست، تصمیم تقاطع (فاز 2)
 * ============================================================
 * هندسه جاده:
 *   - جاده‌ها روی محور k*1024 مرکز 128+k*1024 (k = 0..roadCount) — از World
 *   - لاین دست‌راست: آفست 64px از مرکز جاده (نصف عرض لاین)
 *       N (رو به شمال) → لاین شرقی  |  S → لاین غربی
 *       E (رو به شرق)  → لاین جنوبی |  W → لاین شمالی
 *   - گره‌ها = تقاطع‌ها؛ هر ماشین گره بعدی را می‌داند و در نزدیک‌ترین
 *     نقطه تصمیم (خط لاینِ پیچ) اقدام می‌کند: مستقیم / راست / چپ
 * تصمیم‌ها Deterministic-Per-Random: با Math.random ولی محدود به گزینه‌های معتبر
 * (هرگز از دنیا بیرون نمی‌زند — گره لبه گزینه نامعتبر را حذف می‌کند)
 */

import { TRAFFIC } from '../data/balance';
import { WORLD, WORLD_SIZE } from '../world/World';
import { TrafficCar, TrafficDir, DIR_INFO } from '../entities/TrafficCar';

/** بیشترین شماره جاده (جاده‌ها = roadCount+1 تا لبه‌های دنیا هم جاده باشند) */
const ROAD_MAX = WORLD.roadCount; // 4 → 5 جاده (0..4)
/** آفست لاین از مرکز جاده */
const LANE_OFF = WORLD.roadW / 4; // 64

/** مرکز جاده k-ام */
export function roadCenter(k: number): number {
  return k * WORLD.pitch + WORLD.roadW / 2;
}

/** مختصات لاین برای یک جهت روی جاده idx (قاعده دست‌راست) */
function laneFor(dir: TrafficDir, idx: number): number {
  const c = roadCenter(idx);
  switch (dir) {
    case 'N': return c + LANE_OFF;
    case 'S': return c - LANE_OFF;
    case 'E': return c + LANE_OFF;
    case 'W': return c - LANE_OFF;
  }
}

/** علامت حرکت روی محور: -1 = در حال کم‌شدن مختصات */
function signOf(dir: TrafficDir): number {
  const v = DIR_INFO[dir];
  return v.x !== 0 ? v.x : v.y;
}

/** مختصات روی محور حرکت */
function alongOf(dir: TrafficDir, x: number, y: number): number {
  return DIR_INFO[dir].x !== 0 ? x : y;
}

export interface TrafficCallbacks {
  /** ماشین بوق زد (گیر کرده) */
  onHonk?: (car: TrafficCar) => void;
}

interface PlayerLike {
  x: number; y: number;
  hitW: number; hitH: number;
}

export class TrafficManager {
  readonly cars: TrafficCar[] = [];

  constructor(
    private readonly allowedAssets: string[],
    private readonly callbacks: TrafficCallbacks = {},
    /** نقطه‌ای که نباید ماشین‌ها نزدیک آن اسپاون شوند (اسپاون بازیکن) */
    private readonly avoidSpawn: { x: number; y: number; r: number } = { x: 0, y: 0, r: 0 },
  ) {
    this.spawnAll();
  }

  // ============ شبکه جاده ============

  /** آیا «مستقیم» رفتن در گره فعلی معتبر است؟ */
  private straightValid(car: TrafficCar): boolean {
    const s = signOf(car.dir);
    return s < 0 ? car.nodeIndex > 0 : car.nodeIndex < ROAD_MAX;
  }

  /** پیچ به dir جدید در گره فعلی معتبر است؟ (جاده مقصد باید ادامه داشته باشد) */
  private turnValid(car: TrafficCar, newDir: TrafficDir): boolean {
    const s = signOf(newDir);
    // برای N/S: ادامه روی جاده عمودی newRoadIndex لازم است
    if (newDir === 'N' || newDir === 'S') {
      return s < 0 ? car.nodeIndex > 0 : car.nodeIndex < ROAD_MAX;
    }
    return s < 0 ? car.roadIndex > 0 : car.roadIndex < ROAD_MAX;
  }

  // ============ اسپاون ============

  private spawnAll(): void {
    const kinds = [...this.allowedAssets];
    for (let i = 0; i < TRAFFIC.count; i++) {
      const car = new TrafficCar();
      car.assetId = kinds[i % kinds.length];
      car.cruise = TRAFFIC.cruiseSpeed + (Math.random() * 2 - 1) * TRAFFIC.cruiseJitter;
      if (this.spawnOne(car, 24)) this.cars.push(car);
    }
  }

  /** یک ماشین در نقطه معتبر اسپاون کن؛ false = بعد از tries نشد */
  private spawnOne(car: TrafficCar, tries: number): boolean {
    const dirs: TrafficDir[] = ['N', 'E', 'S', 'W'];
    for (let t = 0; t < tries; t++) {
      const dir = dirs[Math.floor(Math.random() * 4)];
      const vertical = dir === 'N' || dir === 'S';
      // شماره جاده‌ای که روی آن حرکت می‌کنیم + گره مقصد
      const roadIdx = Math.floor(Math.random() * (ROAD_MAX + 1));
      // گره مقصد: نه لبه‌ای که پشت سرش استاب مرزی است — بین 1..ROAD_MAX-1 برای سگمنت امن
      const nodeIdx = 1 + Math.floor(Math.random() * (ROAD_MAX - 1));
      const tt = 0.3 + Math.random() * 0.4;
      let x: number; let y: number;
      if (vertical) {
        x = laneFor(dir, roadIdx);
        const c = roadCenter(nodeIdx);
        y = dir === 'N' ? c + WORLD.pitch * tt : c - WORLD.pitch * tt;
        if (y < 60 || y > WORLD_SIZE - 60) continue;
      } else {
        y = laneFor(dir, roadIdx);
        const c = roadCenter(nodeIdx);
        x = dir === 'E' ? c - WORLD.pitch * tt : c + WORLD.pitch * tt;
        if (x < 60 || x > WORLD_SIZE - 60) continue;
      }
      if (
        this.avoidSpawn.r > 0 &&
        Math.hypot(x - this.avoidSpawn.x, y - this.avoidSpawn.y) < this.avoidSpawn.r
      ) continue;

      car.x = x;
      car.y = y;
      car.setDir(dir, true);
      car.roadIndex = roadIdx;
      car.nodeIndex = nodeIdx;
      car.lane = vertical ? x : y;
      car.decided = false;
      car.pendingTrigger = Number.NaN;
      car.speed = car.cruise * 0.6;
      return true;
    }
    return false;
  }

  // ============ تصمیم تقاطع ============

  /** تصمیم برای گره فعلی: مستقیم یا پیچ (فقط از گزینه‌های معتبر) */
  private decideAtNode(car: TrafficCar): void {
    const s = signOf(car.dir);
    const right: TrafficDir = car.dir === 'N' ? 'E' : car.dir === 'S' ? 'W' : car.dir === 'E' ? 'S' : 'N';
    const left: TrafficDir = car.dir === 'N' ? 'W' : car.dir === 'S' ? 'E' : car.dir === 'E' ? 'N' : 'S';
    const canStraight = this.straightValid(car);
    const canRight = this.turnValid(car, right);
    const canLeft = this.turnValid(car, left);

    let action: 'straight' | 'right' | 'left';
    const r = Math.random();
    if (r < TRAFFIC.straightChance && canStraight) action = 'straight';
    else if (canRight && canLeft) action = r < 0.5 ? 'right' : 'left';
    else if (canRight) action = 'right';
    else if (canLeft) action = 'left';
    else if (canStraight) action = 'straight';
    else action = 'straight'; // هرگز نباید رخ دهد (گوشه حداقل یک پیچ دارد) — fallback امن

    if (action === 'straight') {
      // از گره رد شو؛ گره بعدی همان جهت
      car.nodeIndex = s < 0 ? car.nodeIndex - 1 : car.nodeIndex + 1;
      return;
    }
    const nd: TrafficDir = action === 'right' ? right : left;
    // جاده مقصد: N/S به جاده افقی (nodeIndex فعلی)، E/W به جاده عمودی (nodeIndex فعلی)
    const ontoIdx = car.nodeIndex;
    // نقطه اجرای پیچ = خط لاینِ جهت جدید روی همان محور حرکت
    car.pendingTrigger = laneFor(nd, ontoIdx);
    car.decided = true;
    car.pendingDir = nd;
  }

  private executeTurn(car: TrafficCar): void {
    const nd = car.pendingDir as TrafficDir;
    const ontoIdx = car.nodeIndex;
    car.setDir(nd, false);
    car.lane = laneFor(nd, ontoIdx);
    // جای‌گذاری روی لاین جدید (محور ثابت سِناپ می‌شود)
    if (nd === 'N' || nd === 'S') car.x = car.lane;
    else car.y = car.lane;
    // شماره‌ها: جاده فعلی = جاده پیچ‌خورده؛ گره بعدی = گره بعدی روی محور جدید
    car.roadIndex = ontoIdx;
    const s = signOf(nd);
    car.nodeIndex = s < 0 ? ontoIdx - 1 : ontoIdx + 1;
    car.decided = false;
    car.pendingTrigger = Number.NaN;
    car.pendingDir = null;
  }

  // ============ به‌روزرسانی ============

  update(dt: number, player: PlayerLike): void {
    for (const car of this.cars) {
      // تصمیم‌های تقاطع
      const s = signOf(car.dir);
      const along = alongOf(car.dir, car.x, car.y);
      if (!car.decided) {
        const farTrigger = roadCenter(car.nodeIndex) - LANE_OFF * s;
        if (s < 0 ? along <= farTrigger : along >= farTrigger) this.decideAtNode(car);
      } else if (!Number.isNaN(car.pendingTrigger)) {
        if (s < 0 ? along <= car.pendingTrigger : along >= car.pendingTrigger) this.executeTurn(car);
      }

      // دید جلو: بازیکن و بقیه ماشین‌ها
      const desired = this.desiredSpeed(car, player);
      car.update(dt, desired);

      // بوق اعصاب وقتی گیر است
      if (desired === 0 && car.speed < 25) {
        car.blockedSec += dt;
        if (car.blockedSec > TRAFFIC.honkAfterBlockedSec && !car.honkedThisBlock) {
          car.honkedThisBlock = true;
          this.callbacks.onHonk?.(car);
        }
      } else {
        car.blockedSec = 0;
        if (desired > 0) car.honkedThisBlock = false;
      }
    }
  }

  /** سرعت مطلوب بر اساس موانع جلویی (بازیکن + ترافیک) */
  private desiredSpeed(car: TrafficCar, player: PlayerLike): number {
    const v = DIR_INFO[car.dir];
    let desired = car.cruise;

    const check = (ox: number, oy: number, ohw: number, ohh: number): void => {
      const dx = ox - car.x;
      const dy = oy - car.y;
      const forward = dx * v.x + dy * v.y;
      const lateral = Math.abs(dx * v.y - dy * v.x); // |ضرب خارجی|
      if (forward <= 0 || forward > TRAFFIC.lookAhead + Math.max(ohw, ohh)) return;
      if (lateral > LANE_OFF + Math.min(ohw, ohh) * 0.4) return;
      const gap = forward - (car.hitH / 2 + ohh / 2);
      if (gap < TRAFFIC.safeGap * 0.5) desired = 0;
      else desired = Math.min(desired, Math.max(0, (gap - TRAFFIC.safeGap * 0.4) * 2.4));
    };

    // بازیکن
    check(player.x, player.y, player.hitW / 2, player.hitH / 2);
    // بقیه ترافیک
    for (const other of this.cars) {
      if (other === car) continue;
      check(other.x, other.y, other.hitW / 2, other.hitH / 2);
    }
    return desired;
  }

  /** بازیکن بوق زد → ماشین‌های نزدیک ممکن است جواب بدهند؛ برمی‌گرداند: ماشین‌هایی که بوق زدند */
  onPlayerHorn(px: number, py: number): TrafficCar[] {
    const reacted: TrafficCar[] = [];
    for (const car of this.cars) {
      const d = Math.hypot(car.x - px, car.y - py);
      if (d < TRAFFIC.honkReactionRadius && Math.random() < TRAFFIC.honkBackChance) {
        reacted.push(car);
      }
    }
    if (reacted.length > 0) this.callbacks.onHonk?.(reacted[0]);
    return reacted;
  }
}
