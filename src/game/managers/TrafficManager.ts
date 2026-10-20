/**
 * TrafficManager.ts — مدیر ترافیک دوطرفه (فاز 2 + فاز BIG-IR)
 * ============================================================
 * هندسه جاده (نقشه بزرگ تهران):
 *   - جاده‌ها روی محور k*1400 مرکز 280+k*1400 (k = 0..roadCount) — از World
 *   - دو لاین هر جهت (دوطرفه): لاین داخلی ±70 و بیرونی ±210 از مرکز
 *       N (رو به شمال) → سمت شرق  |  S → سمت غرب
 *       E (رو به شرق)  → سمت جنوب |  W → سمت شمال
 *   - هر ماشین لاین داخلی یا بیرونی را تصادفی نگه می‌دارد و در پیچ با
 *     همان آفست می‌پیچد (ترافیک طبیعی دوطرفه)
 * تصمیم‌ها Deterministic-Per-Random: با Math.random ولی محدود به گزینه‌های معتبر
 * (هرگز از دنیا بیرون نمی‌زند — گره لبه گزینه نامعتبر را حذف می‌کند)
 */

import { TRAFFIC, TRAFFIC_LIGHTS, CHASE, RENDER3D } from '../data/balance';
import { ENDLESS } from '../data/balance';
import { WORLD, roadCenter } from '../world/World';
import { TrafficCar, TrafficDir, DIR_INFO } from '../entities/TrafficCar';
import type { TrafficLights } from '../world/TrafficLights';

/** فاز ENDLESS-1: شبکه جاده بی‌نهایت است — هر شماره جاده/گره صحیح معتبر است.
 *  ترافیک همیشه دور بازیکن جاری می‌شود: دورتر از trafficRecycleDist → اسپاون دوباره نزدیک بازیکن. */

/** نزدیک‌ترین شماره جاده به مختصات (هر عدد صحیح — بی‌پایان) */
function nearestRoadIndex(v: number): number {
  return Math.round((v - WORLD.roadW / 2) / WORLD.pitch);
}

/** مختصات لاین برای یک جهت روی جاده idx با آفست مشخص (قاعده دست‌راست) */
function laneFor(dir: TrafficDir, idx: number, off: number): number {
  const c = roadCenter(idx);
  switch (dir) {
    case 'N': return c + off;
    case 'S': return c - off;
    case 'E': return c + off;
    case 'W': return c - off;
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
  /** سرعت فعلی بازیکن — برای رامِ پلیس/تاکسی (v0.2.42) */
  speed: number;
}

export class TrafficManager {
  readonly cars: TrafficCar[] = [];

  constructor(
    private readonly allowedAssets: string[],
    private readonly callbacks: TrafficCallbacks = {},
    /** نقطه‌ای که نباید ماشین‌ها نزدیک آن اسپاون شوند (اسپاون بازیکن) */
    private readonly avoidSpawn: { x: number; y: number; r: number } = { x: 0, y: 0, r: 0 },
    /** چراغ‌های تقاطع — اختیاری (null = بدون چراغ) */
    private readonly lights: TrafficLights | null = null,
  ) {
    this.spawnAll();
  }

  // ============ شبکه جاده ============

  /** آیا «مستقیم» رفتن در گره فعلی معتبر است؟ — شهر بی‌پایان: همیشه */
  private straightValid(_car: TrafficCar): boolean {
    return true;
  }

  /** پیچ به dir جدید در گره فعلی معتبر است؟ — شهر بی‌پایان: همیشه */
  private turnValid(_car: TrafficCar, _newDir: TrafficDir): boolean {
    return true;
  }

  // ============ اسپاون ============

  private spawnAll(): void {
    const kinds = [...this.allowedAssets];
    for (let i = 0; i < TRAFFIC.count; i++) {
      const car = new TrafficCar();
      car.assetId = kinds[i % kinds.length];
      car.cruise = TRAFFIC.cruiseSpeed + (Math.random() * 2 - 1) * TRAFFIC.cruiseJitter;
      if (this.spawnOne(car, 24, this.avoidSpawn)) this.cars.push(car);
    }
  }

  /** یک ماشین نزدیک نقطهٔ «around» اسپاون کن؛ false = بعد از tries نشد
   *  🔕 minDist: کمینه فاصلهٔ اسپاون از around — بازیافت هرگز جلوی چشم ظاهر نمیشود
   *  v0.2.42: پیش‌فرض = لبهٔ مه کامل (fogFar) — پاپ‌این صفر */
  private spawnOne(car: TrafficCar, tries: number, around: { x: number; y: number }, minDist = RENDER3D.fogFar): boolean {
    const dirs: TrafficDir[] = ['N', 'E', 'S', 'W'];
    for (let t = 0; t < tries; t++) {
      const dir = dirs[Math.floor(Math.random() * 4)];
      const vertical = dir === 'N' || dir === 'S';
      // جاده/گره نزدیک بازیکن — بی‌پایان: منفی هم معتبر
      // v0.2.42: برد جست‌وجو بازتر (جاده ±2، گره ±3) تا کاندیدِ بیرون مه پیدا شود
      const roadIdx = nearestRoadIndex(vertical ? around.x : around.y) + Math.floor(Math.random() * 5) - 2;
      const nodeIdx = nearestRoadIndex(vertical ? around.y : around.x) + Math.floor(Math.random() * 7) - 3;
      const tt = 0.3 + Math.random() * 0.4;
      // لاین داخلی یا بیرونی (دو لاین هر جهت)
      const laneOff = Math.random() < 0.5 ? WORLD.laneIn : WORLD.laneOut;
      let x: number; let y: number;
      if (vertical) {
        x = laneFor(dir, roadIdx, laneOff);
        const c = roadCenter(nodeIdx);
        y = dir === 'N' ? c + WORLD.pitch * tt : c - WORLD.pitch * tt;
      } else {
        y = laneFor(dir, roadIdx, laneOff);
        const c = roadCenter(nodeIdx);
        x = dir === 'E' ? c - WORLD.pitch * tt : c + WORLD.pitch * tt;
      }
      if (
        this.avoidSpawn.r > 0 &&
        Math.hypot(x - this.avoidSpawn.x, y - this.avoidSpawn.y) < this.avoidSpawn.r
      ) continue;
      // 🔕 ضد pop-in: کاندید نزدیک‌تر از minDist دور انداخته می‌شود (بازیافت بیرون دید)
      if (minDist > 0 && Math.hypot(x - around.x, y - around.y) < minDist) continue;

      car.x = x;
      car.y = y;
      car.setDir(dir, true);
      car.roadIndex = roadIdx;
      car.nodeIndex = nodeIdx;
      car.laneOff = laneOff;
      car.lane = vertical ? x : y;
      car.decided = false;
      car.pendingTrigger = Number.NaN;
      car.speed = car.cruise * 0.6;
      return true;
    }
    return false;
  }

  // ============ تصمیم تقاطع ============

  /** تصمیم برای گره فعلی: مستقیم یا پیچ (فقط از گزینه‌های معتبر)
   *  v0.2.42 — حین تعقیب: ناوبری حریص به سمت بازیکن (روی شبکهٔ جاده، مثل رانندهٔ واقعی) */
  private decideAtNode(car: TrafficCar, player: PlayerLike): void {
    const s = signOf(car.dir);
    const right: TrafficDir = car.dir === 'N' ? 'E' : car.dir === 'S' ? 'W' : car.dir === 'E' ? 'S' : 'N';
    const left: TrafficDir = car.dir === 'N' ? 'W' : car.dir === 'S' ? 'E' : car.dir === 'E' ? 'N' : 'S';

    // ---------- تعقیب: برو از جهتی که فاصلهٔ منهتن کمتر می‌شود ----------
    if (car.isChasing) {
      // مختصات گرهٔ جلویی روی شبکه
      const vertical = car.dir === 'N' || car.dir === 'S';
      const nodeX = vertical ? roadCenter(car.roadIndex) : roadCenter(car.nodeIndex);
      const nodeY = vertical ? roadCenter(car.nodeIndex) : roadCenter(car.roadIndex);
      const cand: Array<{ dir: TrafficDir; d: number }> = [];
      for (const nd of [car.dir, right, left]) {
        const v = DIR_INFO[nd];
        const nx = nodeX + v.x * WORLD.pitch;
        const ny = nodeY + v.y * WORLD.pitch;
        cand.push({ dir: nd, d: Math.abs(nx - player.x) + Math.abs(ny - player.y) });
      }
      cand.sort((a, b) => a.d - b.d);
      // ۱۵٪ «مغز خوش‌بین» — کمی نامنظم تا رباتیک نشود
      const chosen = cand.length > 1 && Math.random() < 0.15 ? cand[1] : cand[0];
      if (chosen.dir === car.dir) {
        car.nodeIndex = s < 0 ? car.nodeIndex - 1 : car.nodeIndex + 1;
        return;
      }
      car.pendingTrigger = laneFor(chosen.dir, car.nodeIndex, car.laneOff);
      car.decided = true;
      car.pendingDir = chosen.dir;
      return;
    }

    // ---------- ترافیک عادی: شافل طبیعی تقاطع‌ها ----------
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
    // نقطه اجرای پیچ = خط لاینِ جهت جدید (همان آفست لاین خودش)
    car.pendingTrigger = laneFor(nd, ontoIdx, car.laneOff);
    car.decided = true;
    car.pendingDir = nd;
  }

  private executeTurn(car: TrafficCar): void {
    const nd = car.pendingDir as TrafficDir;
    const ontoIdx = car.nodeIndex;
    car.setDir(nd, false);
    car.lane = laneFor(nd, ontoIdx, car.laneOff);
    // 🔕 v0.2.42 — دیگر سِنِپ عرضی نیست! لاین جدید با بازگشت نرم (turnBlend) لِرپ می‌شود
    // → پیچ به‌شکل قوس واقعی دیده می‌شود نه «جابه‌جایی لحظه‌ای»
    car.turnBlend = TRAFFIC.turnBlendSec;
    // شماره‌ها: جاده فعلی = جاده پیچ‌خورده؛ گره بعدی = گره بعدی روی محور جدید
    car.roadIndex = ontoIdx;
    const s = signOf(nd);
    car.nodeIndex = s < 0 ? ontoIdx - 1 : ontoIdx + 1;
    car.decided = false;
    car.pendingTrigger = Number.NaN;
    car.pendingDir = null;
  }

  /**
   * محدودیت چراغ قرمز: اگر تقاطع جلویی قرمز/زردِ‌دور باشد، سرعت مطلوب را کاهش می‌دهد
   * بازگشت: desired اصلاح‌شده + آیا پشت چراغ ایستاده است (برای بی‌صدا ماندن بوق اعصاب)
   */
  private lightConstraint(car: TrafficCar, desired: number): { desired: number; atLight: boolean } {
    if (!this.lights) return { desired, atLight: false };
    // 🔔 v0.2.42 — پلیس/تاکسیِ تعقیب‌چی چراغ قرمز برایش معنا ندارد (تعقیب تعقیبه!)
    if (car.isChasing) return { desired, atLight: false };
    const v = DIR_INFO[car.dir];
    const axis: 'v' | 'h' = v.x === 0 ? 'v' : 'h';
    const along = v.x !== 0 ? car.x : car.y;
    const s = v.x !== 0 ? v.x : v.y;
    const center = roadCenter(car.nodeIndex);
    const half = WORLD.roadW / 2;
    // خط توقف: قبل از لبه تقاطع (سِمنا با جهت حرکت)
    const stopLine = s < 0 ? center + half + TRAFFIC_LIGHTS.stopGap : center - half - TRAFFIC_LIGHTS.stopGap;
    // فاصله تا خط توقف (اگر هنوز رد نشده)
    const dist = s < 0 ? along - stopLine : stopLine - along;
    if (dist <= 0) return { desired, atLight: false }; // داخل/بعد از تقاطع — برو

    const state = axis === 'v'
      ? this.lights.stateNS(car.roadIndex, car.nodeIndex)
      : this.lights.stateEW(car.nodeIndex, car.roadIndex);
    if (state === 'green') return { desired, atLight: false };
    if (state === 'yellow' && dist < TRAFFIC_LIGHTS.yellowCommitDist) return { desired, atLight: false };

    // توقف نرم پشت خط
    const gap = Math.max(0, dist - 18);
    if (gap < TRAFFIC.safeGap * 0.5) return { desired: 0, atLight: true };
    return { desired: Math.min(desired, Math.max(0, (gap - TRAFFIC.safeGap * 0.4) * 2.2)), atLight: true };
  }


  // ============ به‌روزرسانی ============

  update(dt: number, player: PlayerLike): void {
    const recycle2 = ENDLESS.trafficRecycleDist * ENDLESS.trafficRecycleDist;
    for (const car of this.cars) {
      // ---------- بازگشت از تعقیب به ترافیک عادی (تایمر تاکسی) ----------
      if (car.mode === 'angry') {
        car.modeTimer -= dt;
        if (car.modeTimer <= 0) this.demote(car);
      }

      // ---------- بازیافت ایمنی (شهر بی‌پایان: دور از بازیکن → نزدیکش دوباره) ----------
      const pdx = car.x - player.x;
      const pdy = car.y - player.y;
      const pd2 = pdx * pdx + pdy * pdy;
      if (
        pd2 > recycle2 ||
        !Number.isFinite(car.lane) || !Number.isFinite(car.x) || !Number.isFinite(car.y)
      ) {
        // 🔕 ضد «غیب میشه توی مسیرش ظاهر میشه»:
        //  - تعقیب‌چی‌ها بازیافت نمیشوند (دنبال بازیکن‌اند!) — فقط اگر خیلی دور شد re-sync
        //  - تازه‌ضربه‌خورده‌ها بازیافت نمیشوند؛ کاربر باید نتیجهٔ ضربه را ببیند
        //  - اسپاون بازیافت حتماً بیرون مه کامل (fogFar=۳۳۰۰) — پاپ صفر
        if (car.isChasing) {
          if (pd2 > 5200 * 5200) this.resyncChaser(car, player);
        } else if (car.recentlyKnocked() && Number.isFinite(car.x) && Number.isFinite(car.y)) {
          // بیرون مه هم که تازه ضربه خورده، جابه‌جا نشود — خودش برمی‌گردد
        } else if (this.spawnOne(car, 24, player)) {
          continue;
        }
      }

      // تصمیم‌های تقاطع
      const s = signOf(car.dir);
      const along = alongOf(car.dir, car.x, car.y);
      if (!car.decided) {
        const nearTrigger = roadCenter(car.nodeIndex) - car.laneOff * s;
        if (s < 0 ? along <= nearTrigger : along >= nearTrigger) this.decideAtNode(car, player);
      } else if (!Number.isNaN(car.pendingTrigger)) {
        if (s < 0 ? along <= car.pendingTrigger : along >= car.pendingTrigger) this.executeTurn(car);
      }

      // 🔔 v0.2.42 — نشانه‌گیری عرضی حین تعقیبِ نزدیک: لاین به سمت عرضیِ بازیکن کشیده
      // می‌شود تا پلیس/تاکسی واقعاً «بهت برسند» و در لاین مجاور رد نشوند
      if (car.isChasing && !car.recentlyKnocked() && pd2 < 950 * 950) {
        const vd = DIR_INFO[car.dir];
        const crossTarget = vd.x === 0 ? player.x : player.y;
        const bound = WORLD.roadW / 2 - 44;
        const c = roadCenter(car.roadIndex);
        car.lane = Math.max(c - bound, Math.min(c + bound, crossTarget));
      }

      // دید جلو: تعقیب‌چی ترمز پشت بازیکن نمی‌گیرد (می‌کوبد!) — فقط پشت ترافیک عادی
      const desired = car.isChasing
        ? this.chaseSpeed(car, player)
        : this.lightConstraint(car, this.desiredSpeed(car, player)).desired;
      car.atLight = false;
      car.update(dt, desired);

      // 🔕 v0.2.42 — گارد جدول: پرتاب به بیرون جاده → مثل کوبیدن به جدول می‌ایستد
      this.curbGuard(car);

      // بوق اعصاب وقتی گیر است — پشت چراغ صبر می‌کند (ایرانی‌ها پشت مانع بوق می‌زنند!)
      if (desired === 0 && car.speed < 25 && !car.atLight) {
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

  /** سرعت مطلوب بر اساس موانع جلویی (بازیکن + ترافیک هم‌لاین) */
  private desiredSpeed(car: TrafficCar, player: PlayerLike): number {
    const v = DIR_INFO[car.dir];
    let desired = car.cruise;

    const check = (ox: number, oy: number, ohw: number, ohh: number): void => {
      const dx = ox - car.x;
      const dy = oy - car.y;
      const forward = dx * v.x + dy * v.y;
      const lateral = Math.abs(dx * v.y - dy * v.x); // |ضرب خارجی|
      if (forward <= 0 || forward > TRAFFIC.lookAhead + Math.max(ohw, ohh)) return;
      // فقط هم‌لاین‌ها: لاین مجاور/خلاف جهت (فاصله 140+) ترمز نمی‌کند
      if (lateral > TRAFFIC.laneWidth + Math.min(ohw, ohh) * 0.25) return;
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

  // ============ v0.2.42 — سیستم تعقیب (پلیس/تاکسی عصبانی) ============

  /**
   * سرعت مطلوب حین تعقیب — روی شبکه جاده به سمت بازیکن:
   *  - نزدیک و هم‌راستا → رام (سریع‌تر از بازیکنِ فراری)
   *  - پشت ترافیک عادی گیر کند ولی پشت «بازیکن» ترمز نمی‌کند — می‌کوبد!
   */
  private chaseSpeed(car: TrafficCar, player: PlayerLike): number {
    const v = DIR_INFO[car.dir];
    const max: number = car.mode === 'pursuit' ? CHASE.policeSpeed : CHASE.taxiSpeed;
    let desired = max;

    // پشت ترافیک عادی: ترمز (ولی نزدیکِ مانع، تا حدی هُل می‌دهد — پلیس صبور نیست!)
    for (const other of this.cars) {
      if (other === car || other.isChasing) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const forward = dx * v.x + dy * v.y;
      const lateral = Math.abs(dx * v.y - dy * v.x);
      if (forward <= 0 || forward > TRAFFIC.lookAhead) continue;
      if (lateral > TRAFFIC.laneWidth) continue;
      const gap = forward - (car.hitH / 2 + other.hitH / 2);
      if (gap < TRAFFIC.safeGap * 0.4) desired = Math.min(desired, 55);
      else desired = Math.min(desired, Math.max(55, (gap - TRAFFIC.safeGap * 0.3) * 2.6));
    }

    // رام بازیکن: نزدیک + هم‌راستا → گاز تا آخِر
    const dxp = player.x - car.x;
    const dyp = player.y - car.y;
    const fwd = dxp * v.x + dyp * v.y;
    const lat = Math.abs(dxp * v.y - dyp * v.x);
    if (fwd > 0 && fwd < CHASE.ramRange && lat < TRAFFIC.laneWidth * 1.3) {
      desired = max + CHASE.ramBoost;
    }
    return desired;
  }

  /** گارد جدول: هر ماشین ترافیکی (مخصوصاً پرتاب‌شده) نباید از جاده بیرون برود
   *  برخورد با مرز = صفرشدن سرعتِ رو به بیرون + کمی چرخش (مثل کوبیدن به جدول) */
  private curbGuard(car: TrafficCar): void {
    const v = DIR_INFO[car.dir];
    // محور عرضی نسبت به جهت حرکت
    if (v.x === 0) {
      // حرکت N/S — عرضی X
      const bound = WORLD.roadW / 2 - 34; // ۲۴۶ — کمی داخل جدول
      const k = Math.round((car.x - WORLD.roadW / 2) / WORLD.pitch);
      const c = roadCenter(k);
      const off = car.x - c;
      if (Math.abs(off) > bound) {
        car.x = c + Math.sign(off) * bound;
        // مؤلفهٔ پرتاب رو به بیرون حذف + کمانهٔ کوچک
        const outward = Math.sign(off);
        if (Math.sign(this.knockComponent(car, 'x')) === outward) {
          car.knockVx *= -0.3;
          car.spinVel += (Math.random() - 0.5) * 1.6;
        }
        car.knockVx *= 0.4;
      }
    } else {
      const bound = WORLD.roadW / 2 - 34;
      const k = Math.round((car.y - WORLD.roadW / 2) / WORLD.pitch);
      const c = roadCenter(k);
      const off = car.y - c;
      if (Math.abs(off) > bound) {
        car.y = c + Math.sign(off) * bound;
        const outward = Math.sign(off);
        if (Math.sign(this.knockComponent(car, 'y')) === outward) {
          car.knockVy *= -0.3;
          car.spinVel += (Math.random() - 0.5) * 1.6;
        }
        car.knockVy *= 0.4;
      }
    }
  }

  /** مؤلفهٔ پرتاب روی یک محور (برای گارد جدول) */
  private knockComponent(car: TrafficCar, axis: 'x' | 'y'): number {
    return axis === 'x' ? car.knockVx : car.knockVy;
  }

  /** پایان مد تعقیب → برگشت به ترافیک عادی (کروز عادی + لاین/گره بازتنظیم) */
  demote(car: TrafficCar): void {
    car.mode = 'normal';
    car.modeTimer = 0;
    car.cruise = TRAFFIC.cruiseSpeed + (Math.random() * 2 - 1) * TRAFFIC.cruiseJitter;
  }

  /** تعقیب‌چیِ گم‌شده (خیلی دور) — روی گرهٔ نزدیک بازیکن برمی‌گردد (بیرون مه، بی‌پاپ) */
  private resyncChaser(car: TrafficCar, player: PlayerLike): void {
    const vertical = car.dir === 'N' || car.dir === 'S';
    const roadIdx = nearestRoadIndex(vertical ? player.x : player.y) + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2));
    const nodeIdx = nearestRoadIndex(vertical ? player.y : player.x) + (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 2));
    const laneOff = Math.random() < 0.5 ? WORLD.laneIn : WORLD.laneOut;
    car.roadIndex = roadIdx;
    car.nodeIndex = nodeIdx;
    car.laneOff = laneOff;
    car.lane = laneFor(car.dir, roadIdx, laneOff);
    if (vertical) {
      car.x = car.lane;
      car.y = roadCenter(nodeIdx) + (Math.random() < 0.5 ? -1 : 1) * WORLD.pitch * 0.6;
    } else {
      car.y = car.lane;
      car.x = roadCenter(nodeIdx) + (Math.random() < 0.5 ? -1 : 1) * WORLD.pitch * 0.6;
    }
    car.decided = false;
    car.pendingTrigger = Number.NaN;
    car.speed = Math.max(car.speed, 180);
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
