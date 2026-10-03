/**
 * World.ts — «تهران بزرگ» (فاز BIG-IR)
 * ============================================================
 * نقشه خیلی بزرگ‌تر با جاده‌های پهن دوطرفه (۲ لاین در هر جهت):
 *  - pitch 1400 + جاده 560 → ۷ جاده در هر محور → دنیای 8960px (۷× مساحت قبل)
 *  - لاین‌ها: داخلی ±70 و بیرونی ±210 از مرکز جاده (دست‌راست)
 *  - کاشی 280 → pitch/roadW دقیق بخش‌پذیر (کاشی‌بندی تمیز)
 *  - چیدمان تهران‌گونه: شمال = آپارتمان‌های بلند، جنوب = خانه‌های آجری
 *  - لندمارک‌ها: برج آزادی، برج میلاد، پمپ بنزین، تعمیرگاه (زون ترمیم)
 *  - شکستنی‌ها: سطل/کیسه/جعبه/مخروط/موتور — با سرعت می‌شکنند
 * نقشه قطعی (Deterministic) است — بدون Random تا تست‌ها تکرارپذیر باشند.
 */

import type { Collider } from '../entities/Vehicle';
import { ENDLESS } from '../data/balance';

export type TileKind = 'road_v' | 'road_h' | 'cross' | 'sidewalk' | 'ground';

export interface WorldProp {
  id: string;         // شناسه Asset (در manifest) یا نوع برنامه‌ای
  x: number; y: number; w: number; h: number;
  solid: boolean;     // برخورد دارد؟
  kind: 'tree' | 'trash' | 'pole' | 'cone' | 'building' | 'crate'
    | 'busstop' | 'vendor' | 'billboard' | 'streetSign' | 'moto' | 'bags'
    // کیت شهری GLB (فاز CITY-KIT) — درخت GLB + قطعات خیابانی
    | 'gtree' | 'gconeA' | 'gconeB' | 'gdrum' | 'gbarricadeA' | 'gbarricadeB'
    | 'gbarrier' | 'gdelineator' | 'gtreeSmall'
    | 'azadiTower' | 'miladTower'
    // فاز CITY-BEAUTY — پارک و زندگی رنگی
    | 'fountain' | 'bench' | 'flowers' | 'banner';
  /** برای ساختمان‌ها: شناسه Asset ساختمان */
  assetId?: string;
  /** رنگ placeholder ساختمان */
  tint?: string;
  /** لندمارک = ساختمان ویژه (پمپ بنزین / برج‌ها) */
  landmark?: boolean;
  /** متن تابلو (streetSign/billboard) یا چرخش (رادیان) برای پراپ‌های جهت‌دار */
  label?: string;
  rot?: number;
  /** شکستنی: با برخورد ماشین با سرعت می‌شکند (فاز BIG-IR) */
  breakable?: boolean;
  /** وضعیت فعلی شکستن (منطق در GameManager) */
  broken?: boolean;
  brokenTimer?: number;
}

/** ماشین دوبله‌پارک کنار جدول — فقط مدل‌های با GLB تکسچردار (فیکس خودروی سفیدِ بی‌متریال) */
export interface ParkedCar {
  x: number; y: number;
  angle: number;
  kind: 'peugeot405' | 'samand' | 'renault4' | 'vintage';
}

/** سرعت‌گیر روی جاده — horiz = جاده افقی (خودرو در راستای X از رویش رد می‌شود) */
export interface SpeedBump { x: number; y: number; horiz: boolean }

/** زون تعمیرگاه — ماشین داخل آن خودش را ترمیم می‌کند (فاز BIG-IR) */
export interface RepairZone { x: number; y: number; r: number; label: string }

export interface Coin {
  x: number; y: number;
  taken: boolean;
  /** فاز انیمیشن برای بونس */
  seed: number;
}

export const WORLD = {
  /** فاصله تکرار جاده‌ها (بلوک 840 + جاده 560) */
  pitch: 1400,
  /** عرض جاده دوطرفه: ۲ لاین هر جهت (لاین ±70 و ±190) */
  roadW: 560,
  /** تعداد جاده در هر محور = 6 → ۷ جاده (0..6) → دنیای 8960px */
  roadCount: 6,
  /** آفست لاین داخلی/بیرونی از مرکز جاده */
  laneIn: 70,
  laneOut: 190,
} as const;

export const WORLD_SIZE = WORLD.roadCount * WORLD.pitch + WORLD.roadW; // 8960

/** مرکز جاده k-ام (k = 0..roadCount) */
export function roadCenter(k: number): number {
  return k * WORLD.pitch + WORLD.roadW / 2;
}

// ============================================================
// فاز IR-SIGNS (پورت سبک از backup-v0.2.22) — اسم خیابان‌های معروف ایران
// و تنوع تابلوهای مغازه‌ها. فقط محتواست: هیچ هزینه رندر اضافه‌ای ندارد.
// ============================================================

/** اسم خیابان‌های عمودی — مرتب غرب→شرق (i=0..6 دیده می‌شوند؛ ادامه برای رشد آینده شهر) */
const V_STREETS: string[] = [
  'خیابان آزادی',
  'خیابان ولیعصر',
  'خیابان شریعتی',
  'خیابان شهید بهشتی',
  'خیابان پاسداران',
  'خیابان رسالت',
  'خیابان مدنی',
  'خیابان نواب صفوی',
  'خیابان کارگر',
  'خیابان امیرکبیر',
  'خیابان حافظ',
  'خیابان فردوسی',
  'بلوار آفریقا',
  'خیابان کردستان',
  'خیابان یاخچی‌آباد',
];

/** اسم خیابان‌های افقی — مرتب شمال→جنوب (j=0..6 دیده می‌شوند) */
const H_STREETS: string[] = [
  'خیابان تجریش',
  'بلوار میرداماد',
  'خیابان انقلاب',
  'خیابان جمهوری',
  'خیابان دماوند',
  'خیابان پیروزی',
  'بزرگراه آزادگان',
  'خیابان مختاری',
  'خیابان خزانه',
  'خیابان راه‌آهن',
  'خیابان ۱۷ شهریور',
  'خیابان ولنجک',
  'بلوار کشاورز',
];

/** نام خیابان عمودی k-ام (برای هر عدد صحیح — منفی هم درست) */
export function vStreetName(k: number): string {
  const n = V_STREETS.length;
  return V_STREETS[((k % n) + n) % n];
}

/** نام خیابان افقی k-ام */
export function hStreetName(k: number): string {
  const n = H_STREETS.length;
  return H_STREETS[((k % n) + n) % n];
}

/** تابلوهای مغازه‌ها — تنوع ایرانی (درخواست کاربر: نه همه سوپرمارکت!) */
const SHOP_SIGNS: string[] = [
  'بغالی',
  'سوپر گوشت',
  'پیرایش مردانه',
  'پیرایش زنانه',
  'دکان',
  'حجره',
  'قنادی',
  'میوه‌فروشی',
  'لبنیات',
  'نانوایی',
  'عطاری',
  'خیاطی',
  'کفاشی',
  'لوازم یدکی',
  'رنگ و ساختمان',
  'تعمیرگاه تلفن',
  'پرده و موکت',
  'کافه',
];

/** هش قطعی قوی (از کد قبلی) — پخش یکنواخت تابلوها بین مغازه‌ها */
function hash2(i: number, j: number, salt = 0): number {
  let h = (i | 0) * 374761393 + (j | 0) * 668265263 + salt * 2246822519;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return h >>> 0;
}

/** انتخاب قطعی تابلو از مختصات — بدون Random تا تست‌ها تکرارپذیر بمانند */
export function shopSignAt(x: number, y: number): string {
  return SHOP_SIGNS[hash2(Math.round(x), Math.round(y), 61) % SHOP_SIGNS.length];
}

const T = 280; // کاشی پایه — pitch و roadW دقیق بخش‌پذیرند (1400/280=5، 560/280=2)

// ============================================================
// فاز ENDLESS-1 — شهر بی‌پایان با بودجه فریمی سخت‌گیرانه
// ============================================================
// شهر = شبکه بی‌نهایت قطعهٔ ۱۴۰۰×۱۴۰۰. هر قطعه (i,j):
//   - جاده عمودی i (محلی x=0..560) + جاده افقی j (محلی y=0..560) + تقاطع (i,j)
//   - بلوک (i,j) در محلی [560..1400)² — ساختمان‌ها و پراپ‌ها
// قطعه‌های مبدأ (0..5)² = «تهرانِ» همیشه‌حاضر با برج میلاد/آزادی و چیدمان قدیمی —
// مو‌به‌مو همان دادهٔ نسخهٔ قبل (تقسیم‌شده بین قطعه‌ها). بقیهٔ دنیا با همان DNA
// به‌صورت قطعی از hash(i,j) تولید می‌شود. قطعهٔ دیده‌شده در کش می‌ماند →
// شکستنی‌ها/سکه‌های جمع‌شده بعد از برگشت هم به همان وضعیت‌اند (پایداری رایگان).
// ============================================================

/** کلید قطعه */
export function chunkKey(i: number, j: number): string {
  return `${i}_${j}`;
}

/** محدوده قطعه‌های «تهران مبدأ» — چیدمان قدیمی مو‌به‌مو حفظ می‌شود */
export const ORIGIN_MIN = 0;
export const ORIGIN_MAX = 5;

/** داده یک قطعه از شهر */
export interface WorldChunk {
  i: number;
  j: number;
  props: WorldProp[];
  colliders: Collider[];
  coins: Coin[];
  parkedCars: ParkedCar[];
  speedBumps: SpeedBump[];
  repairZones: RepairZone[];
  /** مبدأ تهران؟ (چیدمان قدیمی) */
  origin: boolean;
}

function emptyChunk(i: number, j: number, origin: boolean): WorldChunk {
  return { i, j, props: [], colliders: [], coins: [], parkedCars: [], speedBumps: [], repairZones: [], origin };
}

export class World {
  /** نقشه کاشی‌های مبدأ (۳۲×۳۲) — فقط برای رندر ۲بعدی fallback */
  tiles: TileKind[] = [];
  gridSize = WORLD_SIZE / T; // 32

  // ---------- سینک‌های ساخت مبدأ (فقط در constructor پر می‌شوند) ----------
  private _p: WorldProp[] = [];
  private _c: Collider[] = [];
  private _co: Coin[] = [];
  private _pc: ParkedCar[] = [];
  private _sb: SpeedBump[] = [];
  private _rz: RepairZone[] = [];

  // ---------- ماشین‌کاری قطعه‌ها ----------
  /** همه قطعه‌های تولیدشده (فعال + بازدیدشده — کش پایداری) */
  readonly chunks = new Map<string, WorldChunk>();
  /** قطعه‌های فعال دور بازیکن (داده منطقی) */
  private activeKeys = new Set<string>();
  /** لیست فعال — برای رندرر (بعد از هر تغییر بازسازی) */
  activeChunks: WorldChunk[] = [];
  private curCi = Number.NaN;
  private curCj = Number.NaN;
  /** تجمیع فعال‌ها — گترهای props/colliders/... همان را برمی‌گردانند */
  private aggProps: WorldProp[] = [];
  private aggColliders: Collider[] = [];
  private aggCoins: Coin[] = [];
  private aggParked: ParkedCar[] = [];
  private aggBumps: SpeedBump[] = [];
  private aggZones: RepairZone[] = [];

  constructor() {
    this.buildTiles();
    this.buildBlocks();
    this.buildStreetLife();
    this.buildCoins();
    this.partitionOrigin();
    // جریان اولیه دور اسپاون
    const s = this.playerSpawn();
    this.updateStreaming(s.x, s.y);
  }

  // ---------- گترهای تجمیعی (API قدیمی بدون تغییر برای مصرف‌کننده‌ها) ----------
  get props(): WorldProp[] { return this.aggProps; }
  get colliders(): Collider[] { return this.aggColliders; }
  get coins(): Coin[] { return this.aggCoins; }
  get parkedCars(): ParkedCar[] { return this.aggParked; }
  get speedBumps(): SpeedBump[] { return this.aggBumps; }
  get repairZones(): RepairZone[] { return this.aggZones; }

  /** تقسیم دادهٔ مبدأ بین قطعه‌های (0..5)² — آیتم بیرون محدوده (بلوار شهرک/مرز) حذف */
  private partitionOrigin(): void {
    const put = <A extends { x: number; y: number }>(arr: A[], pick: (ch: WorldChunk) => A[]): void => {
      for (const item of arr) {
        const ci = Math.floor(item.x / WORLD.pitch);
        const cj = Math.floor(item.y / WORLD.pitch);
        if (ci < ORIGIN_MIN || ci > ORIGIN_MAX || cj < ORIGIN_MIN || cj > ORIGIN_MAX) continue;
        let ch = this.chunks.get(chunkKey(ci, cj));
        if (!ch) { ch = emptyChunk(ci, cj, true); this.chunks.set(chunkKey(ci, cj), ch); }
        pick(ch).push(item);
      }
    };
    put(this._p, (ch) => ch.props);
    put(this._c, (ch) => ch.colliders);
    put(this._co, (ch) => ch.coins);
    put(this._pc, (ch) => ch.parkedCars);
    put(this._sb, (ch) => ch.speedBumps);
    put(this._rz, (ch) => ch.repairZones);
    // سینک‌های ساخت آزاد می‌شوند
    this._p = []; this._c = []; this._co = []; this._pc = []; this._sb = []; this._rz = [];
  }

  // ---------- جریان شهر (از GameManager.step هر فریم — ارزان) ----------
  /** قطعهٔ محل نقطه */
  chunkIndexAt(x: number, y: number): { ci: number; cj: number } {
    return { ci: Math.floor(x / WORLD.pitch), cj: Math.floor(y / WORLD.pitch) };
  }

  /**
   * به‌روزرسانی قطعه‌های فعال دور بازیکن — فقط داده منطقی (ارزان، بدون بودجه).
   * رندرر بصری را با بودجهٔ فریمی خودش می‌سازد (streamVisuals).
   */
  updateStreaming(px: number, py: number): void {
    const { ci, cj } = this.chunkIndexAt(px, py);
    if (ci === this.curCi && cj === this.curCj && this.activeKeys.size > 0) return;
    this.curCi = ci; this.curCj = cj;
    const R = ENDLESS.dataRadius;
    const need = new Set<string>();
    for (let di = -R; di <= R; di++) {
      for (let dj = -R; dj <= R; dj++) need.add(chunkKey(ci + di, cj + dj));
    }
    let dirty = false;
    for (const k of [...this.activeKeys]) {
      if (!need.has(k)) { this.activeKeys.delete(k); dirty = true; }
    }
    for (const k of need) {
      if (!this.activeKeys.has(k)) { this.activeKeys.add(k); dirty = true; }
    }
    if (dirty || this.activeChunks.length === 0) {
      this.activeChunks = [...this.activeKeys]
        .map((k) => this.ensureChunkByKey(k))
        .sort((a, b) => (Math.abs(a.i - ci) + Math.abs(a.j - cj)) - (Math.abs(b.i - ci) + Math.abs(b.j - cj)));
      this.rebuildAggregates();
      this.trimChunkCache();
    }
  }

  /** قطعه با کلید — تولید/بازیابی (تک‌نمونه: وضعیت شکستن/سکه حفظ می‌ماند) */
  private ensureChunkByKey(key: string): WorldChunk {
    let ch = this.chunks.get(key);
    if (!ch) {
      const [i, j] = key.split('_').map(Number);
      ch = this.generateChunk(i, j);
      this.chunks.set(key, ch);
    }
    return ch;
  }

  /** قطعه در مختصات دلخواه (برای رندرر — اگر فعال نبود تولید و کش می‌شود) */
  chunkFor(i: number, j: number): WorldChunk {
    return this.ensureChunkByKey(chunkKey(i, j));
  }

  private rebuildAggregates(): void {
    this.aggProps = []; this.aggColliders = []; this.aggCoins = [];
    this.aggParked = []; this.aggBumps = []; this.aggZones = [];
    for (const ch of this.activeChunks) {
      if (ch.props.length) this.aggProps.push(...ch.props);
      if (ch.colliders.length) this.aggColliders.push(...ch.colliders);
      if (ch.coins.length) this.aggCoins.push(...ch.coins);
      if (ch.parkedCars.length) this.aggParked.push(...ch.parkedCars);
      if (ch.speedBumps.length) this.aggBumps.push(...ch.speedBumps);
      if (ch.repairZones.length) this.aggZones.push(...ch.repairZones);
    }
    if (this.dynColliders.length) this.aggColliders.push(...this.dynColliders);
  }

  /** کولایدرهای پویای بیرونِ قطعه‌ها (نگهبان مأموریت) — تا حذف، همیشه فعال */
  private dynColliders: Collider[] = [];

  addDynamicCollider(c: Collider): void {
    this.dynColliders.push(c);
    this.aggColliders.push(c);
  }

  /** حذف هویتی مجموعه‌ای از کولایدرهای پویا */
  removeDynamicColliders(list: Collider[]): void {
    if (list.length === 0) return;
    const set = new Set(list);
    this.dynColliders = this.dynColliders.filter((c) => !set.has(c));
    this.rebuildAggregates();
  }

  /** سقف کش قطعه‌ها — قطعه‌های غیرفعال قدیمی حذف (وضعیت شکستن از نو می‌رسد — طبیعی) */
  private trimChunkCache(): void {
    const CAP = 260;
    if (this.chunks.size <= CAP) return;
    for (const [k, ch] of this.chunks) {
      if (this.chunks.size <= CAP) break;
      if (!this.activeKeys.has(k)) this.chunks.delete(k);
      void ch;
    }
  }

  // ---------- تولید قطعهٔ بی‌پایان (قطعی) ----------
  private generateChunk(i: number, j: number): WorldChunk {
    const ch = emptyChunk(i, j, false);
    const h = hash2(i, j, 9);
    const bx = i * WORLD.pitch + WORLD.roadW;
    const by = j * WORLD.pitch + WORLD.roadW;
    const cx = bx + 420;
    const cy = by + 420;
    const A = 50;

    const addB = (x: number, y: number, assetId: string, w: number, h2: number, landmark = false): void => {
      const label = assetId === 'env_building_shop_01' ? shopSignAt(x, y) : undefined;
      ch.props.push({ id: `building_${x}_${y}`, x, y, w, h: h2, solid: false, kind: 'building', assetId, landmark, label });
      ch.colliders.push({ x, y, w, h: h2 });
    };
    const addPr = (kind: WorldProp['kind'], x: number, y: number, w: number, h2: number, solid: boolean, extra?: Partial<WorldProp>): void => {
      ch.props.push({ id: `prop_${kind}_${x}_${y}`, x, y, w, h: h2, solid, kind, ...extra });
      if (solid) ch.colliders.push({ x, y, w, h: h2 });
    };
    const apt = 'env_building_apartment_01';
    const shop = 'env_building_shop_01';
    const home = 'env_building_home_01';
    const bCell = (k: number): string => {
      const m = k % 6;
      if (m <= 1) return m === 0 ? apt : shop;
      if (m <= 3) return m === 2 ? shop : home;
      return m === 4 ? apt : shop;
    };

    // ---------- سلول ویژه: پمپ بنزین (هر ~۸ قطعه — ترمیم همه‌جا در دسترس) ----------
    if (h % 8 === 3) {
      addB(bx, by, 'env_building_shop_01', 660, 660, true);
      ch.repairZones.push({ x: bx + 330, y: by + 330, r: 150, label: 'پمپ بنزین' });
    } else if (h % 13 === 5) {
      // ---------- پارک محله ----------
      addPr('fountain', cx - 55, cy - 55, 110, 110, true);
      addPr('bench', cx - 240, cy + 30, 96, 34, true, { rot: 0 });
      addPr('bench', cx + 150, cy + 30, 96, 34, true, { rot: 0 });
      addPr('flowers', cx - 190, cy - 190, 90, 90, false);
      addPr('flowers', cx + 190, cy + 150, 90, 90, false);
      addPr('tree', cx - 280, cy + 10, 120, 120, true);
      addPr('tree', cx + 250, cy - 80, 140, 140, true);
      addPr('trash', cx + 40, cy - 160, 58, 58, false, { breakable: true });
    } else {
      // ---------- بلوک مسکونی/مغازه‌ای — همان ۶ آرکتایپ با seed قطعی ----------
      const lay = ['twin', 'towerRow', 'quad', 'rowHouses', 'shopRow', 'bigCourt'][h % 6];
      const seed = h >> 4;
      if (lay === 'twin') {
        addB(bx + A, by + 120, bCell(seed), 340, 600);
        addB(bx + 450, by + 120, bCell(seed + 1), 340, 600);
        addPr('gtreeSmall', cx - 70, by + 90, 140, 134, false, { rot: 0 });
        addPr('gtreeSmall', cx - 70, by + 610, 140, 134, false, { rot: 2 });
      } else if (lay === 'towerRow') {
        addB(bx + 180, by + 60, bCell(seed), 480, 420);
        addB(bx + 70, by + 520, bCell(seed + 1), 300, 260);
        addB(bx + 470, by + 520, bCell(seed + 2), 300, 260);
        addPr('flowers', cx - 60, by + 450, 90, 90, false);
      } else if (lay === 'quad') {
        addB(bx + A, by + A, bCell(seed), 320, 320);
        addB(bx + 470, by + A, bCell(seed + 1), 320, 320);
        addB(bx + A, by + 470, bCell(seed + 2), 320, 320);
        addB(bx + 470, by + 470, bCell(seed + 3), 320, 320);
        addPr('gtree', cx - 65, cy - 61, 130, 122, false, { rot: 0 });
        if (seed % 2 === 0) addPr('bench', cx + 60, cy - 17, 96, 34, true, { rot: 0 });
      } else if (lay === 'rowHouses') {
        addB(bx + A, by + 80, home, 260, 280);
        addB(bx + 330, by + 80, home, 260, 280);
        addB(bx + 590, by + 80, home, 260, 280);
        addB(bx + A, by + 500, shop, 300, 290);
        addB(bx + 460, by + 500, bCell(seed), 330, 290);
        addPr('gtreeSmall', bx + 130, by + 420, 140, 134, false, { rot: 2 });
        addPr('gtreeSmall', bx + 620, by + 420, 140, 134, false, { rot: 0 });
      } else if (lay === 'shopRow') {
        addB(bx + A, by + 140, shop, 220, 560);
        addB(bx + 310, by + 140, shop, 220, 560);
        addB(bx + 570, by + 140, bCell(seed + 1), 220, 560);
        addPr('bench', bx + 270, by + 60, 96, 34, true, { rot: 0 });
        addPr('gtreeSmall', bx + 30, by + 60, 140, 134, false, { rot: 1 });
        addPr('gtreeSmall', bx + 660, by + 60, 140, 134, false, { rot: 3 });
      } else {
        addB(bx + A, by + A, bCell(seed), 460, 460);
        addPr('gtree', bx + 580, by + 90, 130, 122, false, { rot: 1 });
        addPr('gtree', bx + 580, by + 620, 130, 122, false, { rot: 3 });
        addPr('flowers', bx + 590, by + 380, 90, 90, false);
        addPr('bench', bx + 560, by + 300, 96, 34, true, { rot: Math.PI / 2 });
      }
      // پراپ کنار خیابان (قطعی)
      if (h % 3 === 0) addPr('trash', bx + 60, by + 770, 58, 58, false, { breakable: true });
      if (h % 4 === 1) addPr('pole', bx + 780, by + 80, 46, 46, true);
      if (h % 5 === 2) addPr('bags', bx + 730, by + 640, 46, 40, false, { breakable: true });
      if (h % 7 === 5) addPr('gtree', bx + 780 - (h % 3) * 30, by + 180, 130, 122, false, { rot: (h + 2) % 4 });
    }

    // ---------- تابلوی اسم خیابان در تقاطع (بی‌پایان — بدون گیره) ----------
    ch.props.push({ id: `sign_v_${i}_${j}`, x: roadCenter(i) + 320, y: roadCenter(j) + 320, w: 40, h: 30, solid: false, kind: 'streetSign', label: vStreetName(i) });
    ch.props.push({ id: `sign_h_${i}_${j}`, x: roadCenter(i) - 350, y: roadCenter(j) - 350, w: 40, h: 30, solid: false, kind: 'streetSign', label: hStreetName(j) });

    // ---------- دوبله‌پارکی (فرمول‌های همان خیابان زندگی مبدأ) ----------
    const edge = WORLD.roadW / 2 + 30; // 310
    const kinds: ParkedCar['kind'][] = ['peugeot405', 'samand', 'renault4', 'vintage', 'peugeot405', 'samand'];
    const pk = (x: number, y: number, angle: number, slot: number): void => {
      ch.parkedCars.push({ x, y, angle, kind: kinds[hash2(i, j, slot) % kinds.length] });
    };
    if ((i + j) % 2 === 0) pk(roadCenter(i) - edge, roadCenter(j) + 830, Math.PI, 1);
    pk(roadCenter(i) + edge, roadCenter(j) + 1150, 0, 2);
    if ((i + j) % 2 === 0) pk(roadCenter(i) + 1110, roadCenter(j) - edge, Math.PI / 2, 3);
    else pk(roadCenter(i) + 820, roadCenter(j) + edge, -Math.PI / 2, 3);

    // ---------- سرعت‌گیر (هر ۴ قطعه) ----------
    if (h % 4 === 0) ch.speedBumps.push({ x: roadCenter(i), y: roadCenter(j) + 980, horiz: false });
    else if (h % 4 === 2) ch.speedBumps.push({ x: roadCenter(i) + 980, y: roadCenter(j), horiz: true });

    // ---------- ایستگاه اتوبوس (هر ۷ قطعه) ----------
    if (h % 7 === 2) addPr('busstop', roadCenter(i) + 330, roadCenter(j) + 860, 120, 44, true);

    // ---------- سکه‌ها روی جاده عمودی قطعه ----------
    for (let k = 0; k < 3; k++) {
      ch.coins.push({ x: roadCenter(i) + WORLD.laneIn, y: roadCenter(j) + 700 + k * 300, taken: false, seed: (h % 628) / 100 });
    }
    return ch;
  }

  // ---------- کاشی‌بندی ----------
  /** جاده هر k شامل ۲ کاشی است (roadW=560 = 2×280): ستون‌های [k*5, k*5+1] */
  private isRoadCol(c: number): boolean {
    if (c < 0 || c >= this.gridSize) return false;
    const per = WORLD.pitch / T; // 5
    const k = Math.floor(c / per);
    return k <= WORLD.roadCount && (c - k * per) * T < WORLD.roadW;
  }
  private isRoadRow(r: number): boolean {
    if (r < 0 || r >= this.gridSize) return false;
    const per = WORLD.pitch / T;
    const k = Math.floor(r / per);
    return k <= WORLD.roadCount && (r - k * per) * T < WORLD.roadW;
  }

  private buildTiles(): void {
    const g = this.gridSize;
    for (let r = 0; r < g; r++) {
      for (let c = 0; c < g; c++) {
        let kind: TileKind;
        const rc = this.isRoadCol(c);
        const rr = this.isRoadRow(r);
        if (rc && rr) kind = 'cross';
        else if (rc) kind = 'road_v';
        else if (rr) kind = 'road_h';
        else {
          // داخل بلوک: حلقه بیرونی پیاده‌رو، مرکز زمین
          const nextRoadC = this.isRoadCol(c - 1) || this.isRoadCol(c + 1);
          const nextRoadR = this.isRoadRow(r - 1) || this.isRoadRow(r + 1);
          kind = nextRoadC || nextRoadR ? 'sidewalk' : 'ground';
        }
        this.tiles.push(kind);
      }
    }
  }

  tileAt(c: number, r: number): TileKind {
    if (c < 0 || r < 0 || c >= this.gridSize || r >= this.gridSize) return 'ground';
    return this.tiles[r * this.gridSize + c];
  }

  // ---------- بلوک‌ها: ساختمان‌ها و پروپ‌ها ----------
  /** بلوک 840px: پیاده‌رو ~100 → جای ساختمان تا 640
   *  فاز CITY-FULL: w/h صریح = جای‌گذاری دقیق در همان مختصات (چند ساختمان در بلوک) */
  private addBuilding(bx: number, by: number, assetId: string, landmark = false, w?: number, h?: number): void {
    let x: number, y: number, size: number, sizeH: number;
    if (landmark || w === undefined || h === undefined) {
      size = landmark ? 660 : 640;
      sizeH = size;
      x = bx + (840 - size) / 2;
      y = by + (840 - sizeH) / 2;
    } else {
      size = w;
      sizeH = h;
      x = bx;
      y = by;
    }
    // فاز IR-SIGNS: هر مغازه تابلوی خودش را دارد (انتخاب قطعی از مختصات)
    const label = assetId === 'env_building_shop_01' ? shopSignAt(x, y) : undefined;
    this._p.push({ id: `building_${x}_${y}`, x, y, w: size, h: sizeH, solid: false, kind: 'building', assetId, landmark, label });
    this._c.push({ x, y, w: size, h: sizeH });
  }

  private addProp(kind: WorldProp['kind'], x: number, y: number, w: number, h: number, solid: boolean, extra?: Partial<WorldProp>): void {
    this._p.push({ id: `prop_${kind}_${x}_${y}`, x, y, w, h, solid, kind, ...extra });
    if (solid) this._c.push({ x, y, w, h });
  }

  private buildBlocks(): void {
    const N = WORLD.roadCount; // 6×6 = 36 بلوک
    /**
     * چیدمان تهران‌گونه — قطعی:
     *  شمال (j=0..1): آپارتمان‌های بلند + برج میلاد (4,0)
     *  مرکز (j=2..3): پارک‌ها + تعمیرگاه + پمپ بنزین + برج آزادی (0,3)
     *  جنوب (j=4..5): خانه‌های آجری و مغازه‌ها
     * فاز CITY-FULL: هر بلوک ۲ تا ۴ ساختمان + حیاط پر — شهر نباید خالی بماند!
     */
    const layout: string[] = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        let cell: string;
        if (i === 4 && j === 0) cell = 'milad';
        else if (i === 0 && j === 3) cell = 'azadi';
        else if (i === 3 && j === 3) cell = 'gas';
        else if (i === 1 && j === 2) cell = 'garage';
        else if ((i === 2 && j === 2) || (i === 4 && j === 2)) cell = 'park';
        else if (j <= 1) cell = i % 2 === 0 ? 'env_building_apartment_01' : 'env_building_shop_01';
        else if (j === 2 || j === 3) cell = i % 3 === 0 ? 'env_building_apartment_01' : i % 3 === 1 ? 'env_building_shop_01' : 'env_building_home_01';
        else cell = i % 3 === 0 ? 'env_building_home_01' : i % 3 === 1 ? 'env_building_shop_01' : 'env_building_home_01';
        layout.push(cell);
      }
    }

    // چیدمان‌های متراکم بلوک — قطعی با seed بلوک
    // (بلوک 840: حاشیه پیاده‌رو ~60 → ناحیه ساختمان 60..780)
    const layoutOf = (i: number, j: number): string => {
      const r = (i * 31 + j * 57) % 6;
      if (j <= 1) return ['twin', 'towerRow', 'quad', 'twin', 'bigCourt', 'towerRow'][r]; // شمال بلند
      if (j === 2 || j === 3) return ['shopRow', 'quad', 'twin', 'rowHouses', 'bigCourt', 'quad'][r]; // مرکز ترکیبی
      return ['rowHouses', 'shopRow', 'quad', 'rowHouses', 'twin', 'shopRow'][r]; // جنوب خانه‌ای
    };

    layout.forEach((cell, idx) => {
      const i = idx % N;
      const j = Math.floor(idx / N);
      const bx = i * WORLD.pitch + WORLD.roadW;
      const by = j * WORLD.pitch + WORLD.roadW;
      const cx = bx + 420;
      const cy = by + 420;
      const seed = i * 7 + j * 13;
      const lay = layoutOf(i, j);

      if (cell === 'park') {
        // پارک محله — حوض وسط + نیمکت + گلکاری + درخت‌های رنگی
        this.addProp('fountain', cx - 55, cy - 55, 110, 110, true, { landmark: false });
        this.addProp('bench', cx - 240, cy + 30, 96, 34, true, { rot: 0 });
        this.addProp('bench', cx + 150, cy + 30, 96, 34, true, { rot: 0 });
        this.addProp('bench', cx - 45, cy - 260, 96, 34, true, { rot: Math.PI / 2 });
        this.addProp('bench', cx - 45, cy + 240, 96, 34, true, { rot: Math.PI / 2 });
        this.addProp('flowers', cx - 190, cy - 190, 90, 90, false);
        this.addProp('flowers', cx + 110, cy - 200, 90, 90, false);
        this.addProp('flowers', cx - 200, cy + 120, 90, 90, false);
        this.addProp('flowers', cx + 190, cy + 150, 90, 90, false);
        this.addProp('tree', cx - 280, cy + 10, 120, 120, true);
        this.addProp('tree', cx + 250, cy - 80, 140, 140, true);
        this.addProp('tree', cx + 90, cy + 290, 125, 125, true);
        this.addProp('trash', cx + 40, cy - 160, 60, 60, false, { breakable: true });
        this.addProp('cone', cx - 160, cy + 40, 54, 54, false, { breakable: true });
        return;
      }
      if (cell === 'milad') {
        // برج میلاد — پایه روی بلوک، غول‌پیکر (دیده از همه‌جا)
        this.addProp('miladTower', bx + 220, by + 220, 400, 400, true, { landmark: true });
        // فاز CITY-FULL: پلازای دور برج — خالی نماند!
        this.addProp('tree', bx + 690, by + 160, 110, 110, true);
        this.addProp('tree', bx + 130, by + 660, 110, 110, true);
        this.addProp('tree', bx + 60, by + 60, 115, 115, true);
        this.addProp('tree', bx + 700, by + 700, 120, 120, true);
        this.addProp('flowers', bx + 170, by + 300, 90, 90, false);
        this.addProp('flowers', bx + 590, by + 420, 90, 90, false);
        this.addProp('flowers', bx + 380, by + 150, 90, 90, false);
        this.addProp('flowers', bx + 380, by + 610, 90, 90, false);
        this.addProp('bench', bx + 150, by + 420, 96, 34, true, { rot: Math.PI / 2 });
        this.addProp('bench', bx + 600, by + 300, 96, 34, true, { rot: Math.PI / 2 });
        this.addProp('trash', bx + 640, by + 90, 58, 58, false, { breakable: true });
        return;
      }
      if (cell === 'azadi') {
        // برج آزادی در میدان — دور میدان هم پُر است (فاز CITY-FULL)
        this.addProp('azadiTower', bx + 100, by + 180, 640, 440, true, { landmark: true });
        this.addProp('tree', bx + 180, by + 680, 110, 110, true);
        this.addProp('bags', bx + 700, by + 240, 46, 40, false, { breakable: true });
        this.addProp('tree', bx + 690, by + 690, 120, 120, true);
        this.addProp('tree', bx + 60, by + 60, 115, 115, true);
        this.addProp('flowers', bx + 770, by + 420, 90, 90, false);
        this.addProp('flowers', bx + 300, by + 700, 90, 90, false);
        this.addProp('bench', bx + 620, by + 640, 96, 34, true, { rot: 0 });
        this.addProp('bench', bx + 80, by + 740, 96, 34, true, { rot: 0 });
        this.addProp('crate', bx + 740, by + 60, 62, 62, false, { breakable: true });
        return;
      }
      if (cell === 'garage') {
        this.addBuilding(bx, by, 'env_building_garage_01');
        // جعبه‌ها و مخروط دور تعمیرگاه
        this.addProp('crate', bx + 680, by + 100, 62, 62, false, { breakable: true });
        this.addProp('crate', bx + 750, by + 170, 62, 62, false, { breakable: true });
        this.addProp('cone', bx + 60, by + 740, 54, 54, false, { breakable: true });
        return;
      }
      const isLandmark = cell === 'gas';
      if (isLandmark) {
        // پمپ بنزین — تک‌ساختمانه لندمارک (سایبان دارد)
        this.addBuilding(bx, by, cell, true);
        return;
      }

      // ---------- فاز CITY-FULL: بلوک متراکم — ۲ تا ۴ ساختمان + حیاط پر ----------
      // ناحیه ساختمان: 50..790 در هر دو محور
      const A = 50;
      const midX = bx + 420;
      const midY = by + 420;
      const isNorth = j <= 1;
      const isSouth = j >= 4;
      // آپارتمان/مغازه/خانه — تنوع بر اساس cell اصلی بلوک
      const apt = 'env_building_apartment_01';
      const shop = 'env_building_shop_01';
      const home = 'env_building_home_01';
      const bCell = (k: number): string => {
        // در بلوک شمالی همه آپارتمان/مغازه، جنوبی همه خانه/مغازه، مرکز ترکیبی
        if (isNorth) return k % 2 === 0 ? apt : shop;
        if (isSouth) return k % 2 === 0 ? home : shop;
        return k % 3 === 0 ? apt : k % 3 === 1 ? shop : home;
      };

      if (lay === 'twin') {
        // دو برج دوقلو با کوچه میانی + درخت‌های کوچه
        this.addBuilding(bx + A, by + 120, bCell(seed), false, 340, 600);
        this.addBuilding(bx + 450, by + 120, bCell(seed + 1), false, 340, 600);
        this.addProp('gtreeSmall', midX - 70, by + 90, 140, 134, false, { rot: 0 });
        this.addProp('gtreeSmall', midX - 70, by + 610, 140, 134, false, { rot: 2 });
        if (seed % 2 === 0) this.addProp('bench', midX - 60, midY - 17, 96, 34, true, { rot: 0 });
      } else if (lay === 'towerRow') {
        // یک برج بلند + دو خانه کوتاه جلو — آسمان‌خط لایه‌ای
        this.addBuilding(bx + 180, by + 60, bCell(seed), false, 480, 420);
        this.addBuilding(bx + 70, by + 520, bCell(seed + 1), false, 300, 260);
        this.addBuilding(bx + 470, by + 520, bCell(seed + 2), false, 300, 260);
        this.addProp('flowers', midX - 60, by + 450, 90, 90, false);
        this.addProp('gtreeSmall', bx + 60, by + 400, 140, 134, false, { rot: 1 });
        this.addProp('gtreeSmall', bx + 640, by + 400, 140, 134, false, { rot: 3 });
      } else if (lay === 'quad') {
        // چهار ساختمان گوشه‌ای با کوچه ضربدری — سبک محله قدیمی
        this.addBuilding(bx + A, by + A, bCell(seed), false, 320, 320);
        this.addBuilding(bx + 470, by + A, bCell(seed + 1), false, 320, 320);
        this.addBuilding(bx + A, by + 470, bCell(seed + 2), false, 320, 320);
        this.addBuilding(bx + 470, by + 470, bCell(seed + 3), false, 320, 320);
        // وسط کوچه‌ها: درخت + نیمکت
        this.addProp('gtree', midX - 65, midY - 61, 130, 122, false, { rot: 0 });
        if (seed % 2 === 0) this.addProp('bench', midX + 60, midY - 17, 96, 34, true, { rot: 0 });
        if (seed % 3 === 0) this.addProp('trash', midX - 200, midY + 40, 58, 58, false, { breakable: true });
      } else if (lay === 'rowHouses') {
        // سه خانه حیاط‌دار ردیفی + باغچه — سبک جنوب تهران
        this.addBuilding(bx + A, by + 80, home, false, 260, 280);
        this.addBuilding(bx + 330, by + 80, home, false, 260, 280);
        this.addBuilding(bx + 590, by + 80, home, false, 260, 280);
        this.addBuilding(bx + A, by + 500, shop, false, 300, 290);
        this.addBuilding(bx + 460, by + 500, bCell(seed), false, 330, 290);
        this.addProp('flowers', bx + 340, by + 420, 90, 90, false);
        this.addProp('gtreeSmall', bx + 130, by + 420, 140, 134, false, { rot: 2 });
        this.addProp('gtreeSmall', bx + 620, by + 420, 140, 134, false, { rot: 0 });
      } else if (lay === 'shopRow') {
        // ردیف مغازه + پلازا کوچک با نیمکت — خیابان کسایی
        this.addBuilding(bx + A, by + 140, shop, false, 220, 560);
        this.addBuilding(bx + 310, by + 140, shop, false, 220, 560);
        this.addBuilding(bx + 570, by + 140, bCell(seed + 1), false, 220, 560);
        this.addProp('bench', bx + 270, by + 60, 96, 34, true, { rot: 0 });
        this.addProp('bench', bx + 530, by + 60, 96, 34, true, { rot: 0 });
        this.addProp('gtreeSmall', bx + 30, by + 60, 140, 134, false, { rot: 1 });
        this.addProp('gtreeSmall', bx + 660, by + 60, 140, 134, false, { rot: 3 });
        if (seed % 2 === 1) this.addProp('bags', bx + 250, by + 730, 46, 40, false, { breakable: true });
      } else {
        // bigCourt — ساختمان بزرگ + حیاط سبز پر از detail
        this.addBuilding(bx + A, by + A, bCell(seed), false, 460, 460);
        this.addProp('gtree', bx + 580, by + 90, 130, 122, false, { rot: 1 });
        this.addProp('gtree', bx + 580, by + 620, 130, 122, false, { rot: 3 });
        this.addProp('gtreeSmall', bx + 90, by + 580, 140, 134, false, { rot: 0 });
        this.addProp('flowers', bx + 590, by + 380, 90, 90, false);
        this.addProp('flowers', bx + 300, by + 590, 90, 90, false);
        this.addProp('bench', bx + 560, by + 300, 96, 34, true, { rot: Math.PI / 2 });
        if (seed % 4 === 0) this.addProp('trash', bx + 540, by + 740, 58, 58, false, { breakable: true });
      }

      // پروپ‌های کنار خیابان — با تنوع قطعی (همه چیدمان‌ها)
      if (seed % 3 === 0) this.addProp('trash', bx + 60, by + 770, 58, 58, false, { breakable: true });
      if (seed % 4 === 1) this.addProp('pole', bx + 780, by + 80, 46, 46, true);
      if (seed % 4 === 2) this.addProp('cone', bx + 760, by + 760, 54, 54, false, { breakable: true });
      if (seed % 5 === 0) this.addProp('crate', bx + 110, by + 90, 62, 62, false, { breakable: true });
      if (seed % 5 === 2) this.addProp('bags', bx + 730, by + 640, 46, 40, false, { breakable: true });
      // کیت شهری: درخت کوچک GLB روی پیاده‌رو غربی/شرقی + درخت بزرگ در پارک جنوبی بلوک
      if (seed % 3 === 1) this.addProp('gtreeSmall', bx + 34, by + 300 + (seed % 4) * 110, 152, 146, false, { rot: seed % 4 });
      if (seed % 7 === 5) this.addProp('gtree', bx + 780 - (seed % 3) * 30, by + 180, 130, 122, false, { rot: (seed + 2) % 4 });
    });

    // ---------- فاز ENDLESS-1: مرز حذف شد — شهر در هر چهار جهت ادامه دارد ----------
  }

  /**
   * زندگی خیابانی تهران بزرگ — قطعی:
   * دوبله‌پارکی روی جدول در هر دو جهت، سرعت‌گیر، ایستگاه اتوبوس، دست‌فروش،
   * تابلوهای خیابان‌های معروف تهران، موتور، زباله، جعبه، بیلبورد طنز
   */
  private buildStreetLife(): void {
    const roadCount = WORLD.roadCount + 1; // ۷ جاده
    const centers: number[] = [];
    for (let k = 0; k < roadCount; k++) centers.push(roadCenter(k));
    // مراکز سگمنت‌ها بین تقاطع‌ها
    const segMids: number[] = [];
    for (let k = 0; k < centers.length - 1; k++) segMids.push((centers[k] + centers[k + 1]) / 2);
    const edge = WORLD.roadW / 2 + 30; // کنار جدول، بدون تداخل با لاین بیرونی (310)

    // ---------- دوبله‌پارکی‌ها ----------
    // 🔑 فیکس «خودروی سفید تک‌رنگ»: pride/tiba/nissan GLB بدون تکسچر با متریال سفید خالص دارند
    // (bc=[1,1,1,1] بدون baseColorTexture) — در merge پارکی متریال GLB حفظ می‌شود → سفیدِ کدر!
    // درخواست کاربر: «مدل‌های جدید را جای ماشین سفید بگذار» → رنو۴ و قدیمیِ تکسچردار جایگزین شدند
    // 🔑 سهم قدیمیِ زنگ‌زده کم شد (۱ از ۶) — درخواست کاربر: «زیاد نزار ازش توی خیابون‌ها»
    const kinds: ParkedCar['kind'][] = ['peugeot405', 'samand', 'renault4', 'vintage', 'peugeot405', 'samand'];
    let k = 0;
    const addParked = (x: number, y: number, angle: number) => {
      if (x < 60 || x > WORLD_SIZE - 60 || y < 60 || y > WORLD_SIZE - 60) return;
      this._pc.push({ x, y, angle, kind: kinds[k++ % kinds.length] });
    };
    centers.forEach((cx, i) => {
      segMids.forEach((my, j) => {
        if ((i + j) % 2 === 0) addParked(cx - edge, my - 150, Math.PI);
        addParked(cx + edge, my + 170, 0);
      });
    });
    centers.forEach((cy, i) => {
      segMids.forEach((mx, j) => {
        if ((i + j) % 2 === 0) addParked(mx + 130, cy - edge, Math.PI / 2);
        else addParked(mx - 160, cy + edge, -Math.PI / 2);
      });
    });

    // ---------- سرعت‌گیرها (هر دو جهت) ----------
    this._sb.push(
      { x: roadCenter(1), y: segMids[0], horiz: false },
      { x: roadCenter(1), y: segMids[3], horiz: false },
      { x: roadCenter(2), y: segMids[2], horiz: false },
      { x: roadCenter(4), y: segMids[1], horiz: false },
      { x: segMids[1], y: roadCenter(2), horiz: true },
      { x: segMids[3], y: roadCenter(4), horiz: true },
      { x: segMids[0], y: roadCenter(5), horiz: true },
      { x: segMids[4], y: roadCenter(3), horiz: true },
    );

    // ---------- زون‌های تعمیرگاه (روی جاده، کنار تعمیرگاه و پمپ بنزین) ----------
    this._rz.push(
      { x: roadCenter(2) + WORLD.laneOut, y: 2 * WORLD.pitch + WORLD.roadW + 420, r: 150, label: 'تعمیرگاه' },
      { x: 3 * WORLD.pitch + WORLD.roadW + 420, y: roadCenter(3), r: 150, label: 'پمپ بنزین' },
    );

    // ---------- پراپ‌های خیابانی ----------
    const addLife = (
      kind: WorldProp['kind'], x: number, y: number, w: number, h: number,
      solid: boolean, extra?: Partial<WorldProp>,
    ) => {
      const p: WorldProp = { id: `life_${kind}_${x}_${y}`, x, y, w, h, solid, kind, ...extra };
      this._p.push(p);
      if (solid) this._c.push({ x, y, w, h });
    };

    // ایستگاه‌های اتوبوس (۴ عدد)
    addLife('busstop', roadCenter(1) + 330, segMids[1] - 120, 120, 44, true);
    addLife('busstop', segMids[2] + 80, roadCenter(3) - 350, 120, 44, true);
    addLife('busstop', roadCenter(4) + 330, segMids[4] - 120, 120, 44, true);
    addLife('busstop', segMids[0] + 80, roadCenter(5) - 350, 120, 44, true);
    // دست‌فروش میوه‌فروش (۲ عدد)
    addLife('vendor', roadCenter(2) - 360, segMids[1] + 180, 110, 90, true);
    addLife('vendor', segMids[3] - 60, roadCenter(4) + 360, 110, 90, true);
    // بیلبوردهای طنز
    addLife('billboard', roadCenter(1) - 360, segMids[0] - 330, 220, 40, false, { label: 'فانی‌کار|بوق بزن، راه باز شه!' });
    addLife('billboard', roadCenter(3) + 220, segMids[2] + 330, 220, 40, false, { label: 'احتیاط!|چاله جلوئه', rot: 0.12 });
    addLife('billboard', roadCenter(5) - 360, segMids[3] + 330, 220, 40, false, { label: 'تهران|پایتخت ترافیک!', rot: -0.08 });
    // خوش‌آمد به تهران — کنار مسیر اسپاون
    addLife('billboard', roadCenter(1) + 350, segMids[3] - 310, 220, 40, false, { label: 'خوش آمدید به|تهران!' });
    // تابلوهای اسم خیابان در تقاطع‌ها (فاز IR-SIGNS — اسم خیابان‌های معروف ایران)
    // هر تقاطع دو تابلو: یکی اسم خیابان عمودی، یکی افقی — قطعی با شماره جاده
    // (مختصات به داخل دنیا گیره می‌شود تا تابلوی لبه‌های نقشه بیرون نیفتد)
    const clamp = (v: number): number => Math.min(Math.max(v, 60), WORLD_SIZE - 60);
    for (let i = 0; i <= WORLD.roadCount; i++) {
      for (let j = 0; j <= WORLD.roadCount; j++) {
        addLife('streetSign', clamp(roadCenter(i) + 320), clamp(roadCenter(j) + 320), 40, 30, false, { label: vStreetName(i) });
        addLife('streetSign', clamp(roadCenter(i) - 350), clamp(roadCenter(j) - 350), 40, 30, false, { label: hStreetName(j) });
      }
    }
    // موتورهای پارک‌شده روی پیاده‌رو (شکستنی!)
    addLife('moto', roadCenter(1) + 330, segMids[2], 60, 26, false, { breakable: true });
    addLife('moto', roadCenter(2) - 330, segMids[0] + 100, 60, 26, false, { breakable: true });
    addLife('moto', roadCenter(4) + 330, segMids[3] - 100, 60, 26, false, { breakable: true });
    addLife('moto', roadCenter(3) - 330, segMids[4], 60, 26, false, { breakable: true });
    // پلاستیک‌های زباله کنار جدول (شکستنی!)
    const bagSpots: Array<[number, number]> = [
      [roadCenter(0) + 320, roadCenter(2) + 210], [roadCenter(2) + 320, roadCenter(0) + 210],
      [roadCenter(3) + 320, roadCenter(2) + 250], [roadCenter(1) - 320, roadCenter(4) - 230],
      [roadCenter(5) + 320, roadCenter(3) - 250], [roadCenter(4) - 320, roadCenter(5) + 210],
      [segMids[1] + 110, roadCenter(3) + 320], [segMids[4] - 110, roadCenter(2) - 320],
    ];
    for (const [x, y] of bagSpots) addLife('bags', x, y, 46, 40, false, { breakable: true });

    // ---------- کیت شهری GLB (فاز CITY-KIT) — درخت‌های GLB + خوشه راهسازی پروسیجرال ----------
    // فقط پراپ‌های تمیزِ کیت (درخت) استفاده می‌شوند؛ بقیه قطعات کیت هنوز ایراد رندر دارند
    const edge2 = WORLD.roadW / 2 + 40; // کمی عقب‌تر از دوبله‌پارک‌ها (310)
    centers.forEach((cx, i) => {
      segMids.forEach((my, j) => {
        if ((i * 7 + j * 3) % 4 !== 0) return;
        const side = (i + j) % 2 === 0 ? 1 : -1;
        const x = cx + side * edge2;
        // خوشه راهسازی کنار جاده عمودی — مخروط پروسیجرال (شکستنی)
        this.addProp('cone', x - 24, my - 170, 54, 54, false, { breakable: true });
        this.addProp('cone', x + 12, my + 70, 54, 54, false, { breakable: true });
        this.addProp('trash', x - 10, my + 190, 58, 58, false, { breakable: true });
      });
    });
    // درخت بزرگ GLB کنار بعضی سگمنت‌های جاده (پیاده‌رو)
    centers.forEach((cx, i) => {
      segMids.forEach((my, j) => {
        if ((i * 11 + j * 5) % 3 !== 0) return;
        const side = (i * 3 + j) % 2 === 0 ? 1 : -1;
        this.addProp('gtree', cx + side * (edge2 + 34), my + 120, 130, 122, false, { rot: (i * 3 + j) % 4 });
      });
    });

    // ---------- بنرهای خیابانی رنگی (فاز CITY-BEAUTY) — روی جاده، ماشین زیرش رد می‌شود ----------
    const BANNERS: Array<[string, string, number, number]> = [
      ['جشنواره فروش فانی‌کار', '#E63946', 1, 0],
      ['چهارشنبه‌سوق محله', '#2D7DD2', 2, 1],
      ['جشن نان تازه — نانوایی سعید', '#F2B705', 3, 2],
      ['افتتاحیه کافه ساعت ۵', '#8AC926', 4, 3],
      ['خوش آمدید به تهران بزرگ', '#E07A5F', 5, 4],
      ['چشم شما نقطه نظر شهر', '#7B5EA7', 2, 3],
    ];
    for (const [text, color, ri, si] of BANNERS) {
      const overV = ri % 2 === 0; // بنر روی جاده عمودی — پارچه در راستای X
      if (overV) this.addProp('banner', roadCenter(ri), segMids[si % segMids.length], 620, 40, false, { label: text, rot: 0, tint: color });
      else this.addProp('banner', segMids[si % segMids.length], roadCenter(ri), 40, 620, false, { label: text, rot: Math.PI / 2, tint: color });
    }

    // ---------- فاز ENDLESS-1: بلوار شهرک غرب حذف — شرقِ مبدأ هم مثل بقیهٔ شهر جاری می‌شود ----------
  }

  // ---------- سکه‌ها (روی همه جاده‌های اصلی) ----------
  private buildCoins(): void {
    const positions: Array<[number, number]> = [];
    // جاده عمودی ۱ (ولیعصر — مسیر اسپاون) و ۴ — لاین داخلی
    for (const rx of [1, 4]) {
      const mid = roadCenter(rx) + WORLD.laneIn;
      for (let y = 320; y < WORLD_SIZE - 300; y += 460) positions.push([mid, y]);
    }
    // جاده افقی ۲ و ۵ — لاین داخلی
    for (const ry of [2, 5]) {
      const mid = roadCenter(ry) - WORLD.laneIn;
      for (let x = 340; x < WORLD_SIZE - 300; x += 500) positions.push([x, mid]);
    }
    // دور پارک مرکزی (2,2)
    const pcx = 2 * WORLD.pitch + WORLD.roadW + 420;
    const pcy = pcx;
    positions.push([pcx - 190, pcy + 120], [pcx + 190, pcy + 120], [pcx, pcy - 230]);

    positions.forEach(([x, y], i) => {
      this._co.push({ x, y, taken: false, seed: (i * 0.7) % (Math.PI * 2) });
    });
  }

  /** جمع‌آوری سکه نزدیک ماشین — تعداد جمع‌شده را برمی‌گرداند */
  collectCoins(x: number, y: number, radius: number): number {
    let got = 0;
    for (const c of this.coins) {
      if (c.taken) continue;
      const dx = c.x - x;
      const dy = c.y - y;
      if (dx * dx + dy * dy < radius * radius) {
        c.taken = true;
        got++;
      }
    }
    return got;
  }

  /** نقطه شروع بازیکن: لاین داخلی دست‌راست جاده ۱ (ولیعصر) رو به شمال */
  playerSpawn(): { x: number; y: number; angle: number } {
    return {
      x: roadCenter(1) + WORLD.laneIn,
      y: WORLD_SIZE * 0.74,
      angle: 0,
    };
  }
}
