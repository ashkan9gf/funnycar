/**
 * World.ts — «تهران بی‌پایان» (فاز INFINITE-IR)
 * ============================================================
 * شهر بی‌پایان با جاده‌های پهن دوطرفه در هر دو محور بی‌نهایت:
 *  - pitch 1400 + جاده 560 → جاده‌ها روی k*1400 برای «هر» عدد صحیح k (مثبت و منفی)
 *  - شهر به «قطعه» (Chunk) 1400×1400 تقسیم می‌شود — هر قطعه: جاده عمودی لبه غربی
 *    + جاده افقی لبه جنوبی + بلوک 840px داخل آن
 *  - محتوای هر قطعه Deterministic با hash(i,j) ساخته می‌شود — بدون Random جهانی
 *  - updateStreaming: قطعه‌های دور بازیکن ساخته و دورها آزاد می‌شوند (ضد lag)
 *  - چیدمان تهران‌گونه: نوارهای شمالی = آپارتمان بلند، مرکزی = ترکیبی/پارک،
 *    جنوبی = خانه آجری — در کل جهان تکرار می‌شود (تنوع با hash)
 *  - لندمارک‌ها نزدیک مبدأ: برج آزادی، برج میلاد، پمپ بنزین، تعمیرگاه (زون ترمیم)
 *  - تابلوهای خیابان: اسم خیابان‌های معروف ایران روی همه تقاطع‌ها (فاز IR-SIGNS)
 *  - مغازه‌ها متنوع: بغالی، سوپر گوشت، پیرایش، دکان، حجره، قنادی و... (فاز IR-SIGNS)
 */

import type { Collider } from '../entities/Vehicle';

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
  /** شکستنی؟ (سطل/کیسه/جعبه/مخروط/موتور) */
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
  /** آفست لاین داخلی/بیرونی از مرکز جاده */
  laneIn: 70,
  laneOut: 190,
} as const;

/** ⚠️ قدیمی: اندازه نقشه ثابت — در شهر بی‌پایان فقط برای سازگاری قدیمی نگه داشته شده */
export const WORLD_SIZE = 8960;

/** مرکز جاده k-ام — برای «هر» عدد صحیح k (شهر بی‌پایان) */
export function roadCenter(k: number): number {
  return k * WORLD.pitch + WORLD.roadW / 2;
}

/** نزدیک‌ترین اندیس جاده به مختصات روی یک محور */
export function nearestRoadIndex(v: number): number {
  return Math.round((v - WORLD.roadW / 2) / WORLD.pitch);
}

const T = 280; // کاشی پایه — pitch و roadW دقیق بخش‌پذیرند (1400/280=5، 560/280=2)

// ============================================================
// فاز IR-SIGNS — اسم خیابان‌های معروف ایران + تنوع مغازه‌ها
// ============================================================

/** خیابان‌های معروف شمالی-جنوبی (جاده‌های عمودی — با اندیس k mod len) */
const V_STREETS: string[] = [
  'خیابان ولیعصر',
  'خیابان شریعتی',
  'خیابان آزادی',
  'خیابان نواب صفوی',
  'خیابان کارگر',
  'خیابان امیرکبیر',
  'خیابان حافظ',
  'خیابان فردوسی',
  'بلوار میرداماد',
  'خیابان مدنی',
  'بلوار آفریقا',
  'خیابان پاسداران',
  'خیابان شهید بهشتی',
  'خیابان کردستان',
  'خیابان رسالت',
  'خیابان یاخچی‌آباد',
];

/** خیابان‌های معروف شرقی-غربی (جاده‌های افقی) */
const H_STREETS: string[] = [
  'خیابان انقلاب',
  'خیابان آزادی',
  'بلوار جلال آل‌احمد',
  'بلوار همت',
  'خیابان حقانی',
  'خیابان دماوند',
  'خیابان پیروزی',
  'خیابان مختاری',
  'خیابان خزانه',
  'خیابان راه‌آهن',
  'بزرگراه آزادگان',
  'خیابان ۱۷ شهریور',
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

// ============================================================
// Hash قطعی — محتوای هر قطعه از (i,j) ساخته می‌شود
// ============================================================

function hash2(i: number, j: number, salt = 0): number {
  let h = (i | 0) * 374761393 + (j | 0) * 668265263 + salt * 2246822519;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return Math.abs(h | 0);
}

/** داده یک قطعه شهر (برای استریم رندر هم خوانده می‌شود) */
export interface ChunkData {
  i: number; j: number;
  props: WorldProp[];
  parkedCars: ParkedCar[];
  speedBumps: SpeedBump[];
  repairZones: RepairZone[];
  coins: Coin[];
  colliders: Collider[];
}

export class World {
  /** کاشی‌ها حالا تابع خالص‌اند — آرایه حذف شد (شهر بی‌پایان) */
  gridSize = Infinity;
  colliders: Collider[] = [];
  props: WorldProp[] = [];
  coins: Coin[] = [];
  /** خیابان ایرانی: دوبله‌پارک‌ها، سرعت‌گیرها، زون‌های تعمیر */
  parkedCars: ParkedCar[] = [];
  speedBumps: SpeedBump[] = [];
  repairZones: RepairZone[] = [];

  /** قطعه‌های فعال دور بازیکن — رندرر همین را استریم می‌کند */
  readonly chunks = new Map<string, ChunkData>();
  /** شعاع ساخت قطعه دور بازیکن (تعداد قطعه در هر جهت) */
  private readonly keepR = 3;
  private readonly pruneR = 4;

  constructor() {
    this.updateStreaming(0, 0, true);
  }

  // ---------- کاشی‌بندی بی‌پایان (تابع خالص) ----------
  /** جاده هر k شامل ۲ کاشی است (roadW=560 = 2×280): ستون‌های [k*5, k*5+1] — منفی هم درست */
  private isRoadCell(u: number): boolean {
    const per = WORLD.pitch / T; // 5
    const m = ((u % per) + per) % per;
    return m * T < WORLD.roadW;
  }
  /** kind کاشی (c,r) — بدون محدود مرز؛ بیرون فقط تابع است */
  tileAt(c: number, r: number): TileKind {
    const rc = this.isRoadCell(c);
    const rr = this.isRoadCell(r);
    if (rc && rr) return 'cross';
    if (rc) return 'road_v';
    if (rr) return 'road_h';
    // داخل بلوک: حلقه بیرونی پیاده‌رو، مرکز زمین
    const nextRoadC = this.isRoadCell(c - 1) || this.isRoadCell(c + 1);
    const nextRoadR = this.isRoadCell(r - 1) || this.isRoadCell(r + 1);
    return nextRoadC || nextRoadR ? 'sidewalk' : 'ground';
  }

  // ============ استریم قطعه‌ها ============

  /** هر فریم (یا هر چند متر) صدا زده می‌شود — قطعه‌های دور بازیکن را زنده نگه می‌دارد */
  updateStreaming(px: number, py: number, force = false): void {
    const ci = Math.floor(px / WORLD.pitch);
    const cj = Math.floor(py / WORLD.pitch);
    // اگر بازیکن هنوز در همان قطعه مرکزی قبلی است و همه قطعه‌ها هست — کاری نکن
    const centerKey = `${ci}_${cj}`;
    if (!force && this.centerKey === centerKey && this.chunks.size >= (2 * this.keepR + 1) ** 2) return;
    this.centerKey = centerKey;

    // فاز PERF-4: ساخت داده قطعه‌های گم‌شده تدریجی — حداکثر ۴ قطعه در هر فریم؛
    // قبلاً کل ردیف ۷تایی هم‌زمان ساخته می‌شد = spike در عبور از مرز قطعه
    const missing: Array<{ key: string; i: number; j: number; d: number }> = [];
    for (let dj = -this.keepR; dj <= this.keepR; dj++) {
      for (let di = -this.keepR; di <= this.keepR; di++) {
        const i = ci + di;
        const j = cj + dj;
        const key = `${i}_${j}`;
        if (!this.chunks.has(key)) missing.push({ key, i, j, d: di * di + dj * dj });
      }
    }
    if (missing.length > 0) {
      missing.sort((a, b) => a.d - b.d);
      const genN = Math.min(4, missing.length);
      for (let k = 0; k < genN; k++) {
        const m = missing[k];
        this.chunks.set(m.key, this.genChunk(m.i, m.j));
      }
    }
    // آزادسازی قطعه‌های دور
    for (const key of [...this.chunks.keys()]) {
      const [si, sj] = key.split('_');
      const i = Number(si);
      const j = Number(sj);
      if (Math.abs(i - ci) > this.pruneR || Math.abs(j - cj) > this.pruneR) this.chunks.delete(key);
    }
    this.rebuildAggregates();
  }

  private centerKey = '';

  /** آرایه‌های تخت = اجتماع قطعه‌های فعال (فقط وقتی مجموعه قطعه‌ها عوض شود) */
  private rebuildAggregates(): void {
    // فاز PERF-4: بدون تخصیص جدید — طول صفر می‌شود، ظرفیت حفظ می‌ماند (ضد GC در هر عبور مرز)
    this.props.length = 0;
    this.parkedCars.length = 0;
    this.speedBumps.length = 0;
    this.repairZones.length = 0;
    this.coins.length = 0;
    this.colliders.length = 0;
    for (const ch of this.chunks.values()) {
      for (const p of ch.props) this.props.push(p);
      for (const pc of ch.parkedCars) this.parkedCars.push(pc);
      for (const sb of ch.speedBumps) this.speedBumps.push(sb);
      for (const rz of ch.repairZones) this.repairZones.push(rz);
      for (const c of ch.coins) this.coins.push(c);
      for (const c of ch.colliders) this.colliders.push(c);
    }
  }

  // ============ تولید محتوای یک قطعه ============

  private addPropTo(ch: ChunkData, kind: WorldProp['kind'], x: number, y: number, w: number, h: number, solid: boolean, extra?: Partial<WorldProp>): void {
    const p: WorldProp = { id: `prop_${kind}_${x}_${y}`, x, y, w, h, solid, kind, ...extra };
    ch.props.push(p);
    if (solid) ch.colliders.push({ x, y, w, h });
  }

  private addBuildingTo(ch: ChunkData, bx: number, by: number, assetId: string, landmark = false, w?: number, h?: number, sign?: string): void {
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
    ch.props.push({ id: `building_${x}_${y}`, x, y, w: size, h: sizeH, solid: false, kind: 'building', assetId, landmark, label: sign });
    ch.colliders.push({ x, y, w: size, h: sizeH });
  }

  private genChunk(i: number, j: number): ChunkData {
    const ch: ChunkData = {
      i, j,
      props: [], parkedCars: [], speedBumps: [], repairZones: [], coins: [], colliders: [],
    };
    // بلوک داخل قطعه — مثل نقشه قبلی: bx = i*pitch + roadW
    const bx = i * WORLD.pitch + WORLD.roadW;
    const by = j * WORLD.pitch + WORLD.roadW;
    const cx = bx + 420;
    const cy = by + 420;
    const h = hash2(i, j);
    const seed = Math.abs(h) % 100000;

    // ---------- لندمارک‌های ثابت نزدیک مبدأ (همان نقشه قدیمی) ----------
    if (i === 4 && j === 0) { this.genMilad(ch, bx, by); this.genStreetLife(ch, i, j); return ch; }
    if (i === 0 && j === 3) { this.genAzadi(ch, bx, by); this.genStreetLife(ch, i, j); return ch; }
    if (i === 3 && j === 3) { this.genGas(ch, bx, by, cx, cy); this.genStreetLife(ch, i, j); return ch; }
    if (i === 1 && j === 2) { this.genGarage(ch, bx, by); this.genStreetLife(ch, i, j); return ch; }
    if ((i === 2 && j === 2) || (i === 4 && j === 2)) { this.genPark(ch, cx, cy); this.genStreetLife(ch, i, j); return ch; }

    // ---------- لندمارک‌های پراکنده در کل شهر ----------
    if (h % 11 === 3) { this.genGas(ch, bx, by, cx, cy); this.genStreetLife(ch, i, j); return ch; }
    if (h % 13 === 5) { this.genGarage(ch, bx, by); this.genStreetLife(ch, i, j); return ch; }
    if (h % 7 === 1) { this.genPark(ch, cx, cy); this.genStreetLife(ch, i, j); return ch; }

    // ---------- بلوک ساختمانی متراکم — نوارهای شهر (شمال بلند/مرکز ترکیبی/جنوب خانه‌ای) ----------
    const band = ((j % 6) + 6) % 6; // 0..5 — دو نوار شمالی بلند، دو مرکزی ترکیبی، دو جنوبی خانه‌ای
    const isNorth = band <= 1;
    const isSouth = band >= 4;
    const lay = ['twin', 'towerRow', 'quad', 'twin', 'bigCourt', 'towerRow', 'rowHouses', 'shopRow', 'quad', 'rowHouses', 'twin', 'shopRow'][h % 12];
    // نوع ساختمان در بلوک — با تابلو مغازه متنوع (فاز IR-SIGNS)
    const bCell = (k: number): { asset: string; sign?: string } => {
      const pick = hash2(i, j, 17 + k * 7) % 100;
      if (isNorth) return pick % 2 === 0
        ? { asset: 'env_building_apartment_01' }
        : { asset: 'env_building_shop_01', sign: SHOP_SIGNS[hash2(i, j, 31 + k) % SHOP_SIGNS.length] };
      if (isSouth) return pick % 2 === 0
        ? { asset: 'env_building_home_01' }
        : { asset: 'env_building_shop_01', sign: SHOP_SIGNS[hash2(i, j, 41 + k) % SHOP_SIGNS.length] };
      return pick % 3 === 0
        ? { asset: 'env_building_apartment_01' }
        : pick % 3 === 1
          ? { asset: 'env_building_shop_01', sign: SHOP_SIGNS[hash2(i, j, 51 + k) % SHOP_SIGNS.length] }
          : { asset: 'env_building_home_01' };
    };
    const shop = (): { asset: string; sign?: string } => ({ asset: 'env_building_shop_01', sign: SHOP_SIGNS[hash2(i, j, 61 + seed % 13) % SHOP_SIGNS.length] });
    const home = (): { asset: string } => ({ asset: 'env_building_home_01' });
    const A = 50;
    const midX = bx + 420;
    const midY = by + 420;

    if (lay === 'twin') {
      const b1 = bCell(0);
      const b2 = bCell(1);
      this.addBuildingTo(ch, bx + A, by + 120, b1.asset, false, 340, 600, b1.sign);
      this.addBuildingTo(ch, bx + 450, by + 120, b2.asset, false, 340, 600, b2.sign);
      this.addPropTo(ch, 'gtreeSmall', midX - 70, by + 90, 140, 134, false, { rot: 0 });
      this.addPropTo(ch, 'gtreeSmall', midX - 70, by + 610, 140, 134, false, { rot: 2 });
      if (seed % 2 === 0) this.addPropTo(ch, 'bench', midX - 60, midY - 17, 96, 34, true, { rot: 0 });
    } else if (lay === 'towerRow') {
      const b1 = bCell(0);
      const b2 = bCell(1);
      const b3 = bCell(2);
      this.addBuildingTo(ch, bx + 180, by + 60, b1.asset, false, 480, 420, b1.sign);
      this.addBuildingTo(ch, bx + 70, by + 520, b2.asset, false, 300, 260, b2.sign);
      this.addBuildingTo(ch, bx + 470, by + 520, b3.asset, false, 300, 260, b3.sign);
      this.addPropTo(ch, 'flowers', midX - 60, by + 450, 90, 90, false);
      this.addPropTo(ch, 'gtreeSmall', bx + 60, by + 400, 140, 134, false, { rot: 1 });
      this.addPropTo(ch, 'gtreeSmall', bx + 640, by + 400, 140, 134, false, { rot: 3 });
    } else if (lay === 'quad') {
      const b1 = bCell(0);
      const b2 = bCell(1);
      const b3 = bCell(2);
      const b4 = bCell(3);
      this.addBuildingTo(ch, bx + A, by + A, b1.asset, false, 320, 320, b1.sign);
      this.addBuildingTo(ch, bx + 470, by + A, b2.asset, false, 320, 320, b2.sign);
      this.addBuildingTo(ch, bx + A, by + 470, b3.asset, false, 320, 320, b3.sign);
      this.addBuildingTo(ch, bx + 470, by + 470, b4.asset, false, 320, 320, b4.sign);
      this.addPropTo(ch, 'gtree', midX - 65, midY - 61, 130, 122, false, { rot: 0 });
      if (seed % 2 === 0) this.addPropTo(ch, 'bench', midX + 60, midY - 17, 96, 34, true, { rot: 0 });
      if (seed % 3 === 0) this.addPropTo(ch, 'trash', midX - 200, midY + 40, 58, 58, false, { breakable: true });
    } else if (lay === 'rowHouses') {
      const s1 = shop();
      const b1 = bCell(1);
      this.addBuildingTo(ch, bx + A, by + 80, home().asset, false, 260, 280);
      this.addBuildingTo(ch, bx + 330, by + 80, home().asset, false, 260, 280);
      this.addBuildingTo(ch, bx + 590, by + 80, home().asset, false, 260, 280);
      this.addBuildingTo(ch, bx + A, by + 500, s1.asset, false, 300, 290, s1.sign);
      this.addBuildingTo(ch, bx + 460, by + 500, b1.asset, false, 330, 290, b1.sign);
      this.addPropTo(ch, 'flowers', bx + 340, by + 420, 90, 90, false);
      this.addPropTo(ch, 'gtreeSmall', bx + 130, by + 420, 140, 134, false, { rot: 2 });
      this.addPropTo(ch, 'gtreeSmall', bx + 620, by + 420, 140, 134, false, { rot: 0 });
    } else if (lay === 'shopRow') {
      // ردیف مغازه — هر مغازه تابلوی مخصوص خودش
      const s1 = shop();
      const s2 = shop();
      const b1 = bCell(3);
      this.addBuildingTo(ch, bx + A, by + 140, s1.asset, false, 220, 560, s1.sign);
      this.addBuildingTo(ch, bx + 310, by + 140, s2.asset, false, 220, 560, s2.sign);
      this.addBuildingTo(ch, bx + 570, by + 140, b1.asset, false, 220, 560, b1.sign);
      this.addPropTo(ch, 'bench', bx + 270, by + 60, 96, 34, true, { rot: 0 });
      this.addPropTo(ch, 'bench', bx + 530, by + 60, 96, 34, true, { rot: 0 });
      this.addPropTo(ch, 'gtreeSmall', bx + 30, by + 60, 140, 134, false, { rot: 1 });
      this.addPropTo(ch, 'gtreeSmall', bx + 660, by + 60, 140, 134, false, { rot: 3 });
      if (seed % 2 === 1) this.addPropTo(ch, 'bags', bx + 250, by + 730, 46, 40, false, { breakable: true });
    } else {
      // bigCourt
      const b1 = bCell(0);
      this.addBuildingTo(ch, bx + A, by + A, b1.asset, false, 460, 460, b1.sign);
      this.addPropTo(ch, 'gtree', bx + 580, by + 90, 130, 122, false, { rot: 1 });
      this.addPropTo(ch, 'gtree', bx + 580, by + 620, 130, 122, false, { rot: 3 });
      this.addPropTo(ch, 'gtreeSmall', bx + 90, by + 580, 140, 134, false, { rot: 0 });
      this.addPropTo(ch, 'flowers', bx + 590, by + 380, 90, 90, false);
      this.addPropTo(ch, 'flowers', bx + 300, by + 590, 90, 90, false);
      this.addPropTo(ch, 'bench', bx + 560, by + 300, 96, 34, true, { rot: Math.PI / 2 });
      if (seed % 4 === 0) this.addPropTo(ch, 'trash', bx + 540, by + 740, 58, 58, false, { breakable: true });
    }

    // پروپ‌های کنار خیابان — تنوع قطعی (همه چیدمان‌ها)
    if (seed % 3 === 0) this.addPropTo(ch, 'trash', bx + 60, by + 770, 58, 58, false, { breakable: true });
    if (seed % 4 === 1) this.addPropTo(ch, 'pole', bx + 780, by + 80, 46, 46, true);
    if (seed % 4 === 2) this.addPropTo(ch, 'cone', bx + 760, by + 760, 54, 54, false, { breakable: true });
    if (seed % 5 === 0) this.addPropTo(ch, 'crate', bx + 110, by + 90, 62, 62, false, { breakable: true });
    if (seed % 5 === 2) this.addPropTo(ch, 'bags', bx + 730, by + 640, 46, 40, false, { breakable: true });
    if (seed % 3 === 1) this.addPropTo(ch, 'gtreeSmall', bx + 34, by + 300 + (seed % 4) * 110, 152, 146, false, { rot: seed % 4 });
    if (seed % 7 === 5) this.addPropTo(ch, 'gtree', bx + 780 - (seed % 3) * 30, by + 180, 130, 122, false, { rot: (seed + 2) % 4 });

    this.genStreetLife(ch, i, j);
    return ch;
  }

  // ---------- لندمارک‌ها ----------
  private genMilad(ch: ChunkData, bx: number, by: number): void {
    this.addPropTo(ch, 'miladTower', bx + 220, by + 220, 400, 400, true, { landmark: true });
    this.addPropTo(ch, 'tree', bx + 690, by + 160, 110, 110, true);
    this.addPropTo(ch, 'tree', bx + 130, by + 660, 110, 110, true);
    this.addPropTo(ch, 'tree', bx + 60, by + 60, 115, 115, true);
    this.addPropTo(ch, 'tree', bx + 700, by + 700, 120, 120, true);
    this.addPropTo(ch, 'flowers', bx + 170, by + 300, 90, 90, false);
    this.addPropTo(ch, 'flowers', bx + 590, by + 420, 90, 90, false);
    this.addPropTo(ch, 'flowers', bx + 380, by + 150, 90, 90, false);
    this.addPropTo(ch, 'flowers', bx + 380, by + 610, 90, 90, false);
    this.addPropTo(ch, 'bench', bx + 150, by + 420, 96, 34, true, { rot: Math.PI / 2 });
    this.addPropTo(ch, 'bench', bx + 600, by + 300, 96, 34, true, { rot: Math.PI / 2 });
    this.addPropTo(ch, 'trash', bx + 640, by + 90, 58, 58, false, { breakable: true });
  }

  private genAzadi(ch: ChunkData, bx: number, by: number): void {
    this.addPropTo(ch, 'azadiTower', bx + 100, by + 180, 640, 440, true, { landmark: true });
    this.addPropTo(ch, 'tree', bx + 180, by + 680, 110, 110, true);
    this.addPropTo(ch, 'bags', bx + 700, by + 240, 46, 40, false, { breakable: true });
    this.addPropTo(ch, 'tree', bx + 690, by + 690, 120, 120, true);
    this.addPropTo(ch, 'tree', bx + 60, by + 60, 115, 115, true);
    this.addPropTo(ch, 'flowers', bx + 770, by + 420, 90, 90, false);
    this.addPropTo(ch, 'flowers', bx + 300, by + 700, 90, 90, false);
    this.addPropTo(ch, 'bench', bx + 620, by + 640, 96, 34, true, { rot: 0 });
    this.addPropTo(ch, 'bench', bx + 80, by + 740, 96, 34, true, { rot: 0 });
    this.addPropTo(ch, 'crate', bx + 740, by + 60, 62, 62, false, { breakable: true });
  }

  private genGas(ch: ChunkData, bx: number, by: number, cx: number, cy: number): void {
    this.addBuildingTo(ch, bx, by, 'gas', true);
    // زون ترمیم/سوخت روی جاده کنار پمپ
    ch.repairZones.push({ x: cx - 700, y: cy, r: 150, label: 'پمپ بنزین' });
  }

  private genGarage(ch: ChunkData, bx: number, by: number): void {
    this.addBuildingTo(ch, bx, by, 'env_building_garage_01');
    this.addPropTo(ch, 'crate', bx + 680, by + 100, 62, 62, false, { breakable: true });
    this.addPropTo(ch, 'crate', bx + 750, by + 170, 62, 62, false, { breakable: true });
    this.addPropTo(ch, 'cone', bx + 60, by + 740, 54, 54, false, { breakable: true });
    ch.repairZones.push({ x: bx + 420 - 700, y: by + 420, r: 150, label: 'تعمیرگاه' });
  }

  private genPark(ch: ChunkData, cx: number, cy: number): void {
    this.addPropTo(ch, 'fountain', cx - 55, cy - 55, 110, 110, true);
    this.addPropTo(ch, 'bench', cx - 240, cy + 30, 96, 34, true, { rot: 0 });
    this.addPropTo(ch, 'bench', cx + 150, cy + 30, 96, 34, true, { rot: 0 });
    this.addPropTo(ch, 'bench', cx - 45, cy - 260, 96, 34, true, { rot: Math.PI / 2 });
    this.addPropTo(ch, 'bench', cx - 45, cy + 240, 96, 34, true, { rot: Math.PI / 2 });
    this.addPropTo(ch, 'flowers', cx - 190, cy - 190, 90, 90, false);
    this.addPropTo(ch, 'flowers', cx + 110, cy - 200, 90, 90, false);
    this.addPropTo(ch, 'flowers', cx - 200, cy + 120, 90, 90, false);
    this.addPropTo(ch, 'flowers', cx + 190, cy + 150, 90, 90, false);
    this.addPropTo(ch, 'tree', cx - 280, cy + 10, 120, 120, true);
    this.addPropTo(ch, 'tree', cx + 250, cy - 80, 140, 140, true);
    this.addPropTo(ch, 'tree', cx + 90, cy + 290, 125, 125, true);
    this.addPropTo(ch, 'trash', cx + 40, cy - 160, 60, 60, false, { breakable: true });
    this.addPropTo(ch, 'cone', cx - 160, cy + 40, 54, 54, false, { breakable: true });
  }

  // ---------- زندگی خیابانی هر قطعه ----------
  private genStreetLife(ch: ChunkData, i: number, j: number): void {
    const h = hash2(i, j, 7);
    const seed = Math.abs(h);
    const kinds: ParkedCar['kind'][] = ['peugeot405', 'samand', 'renault4', 'vintage', 'peugeot405', 'samand'];
    let pk = 0;
    const addParked = (x: number, y: number, angle: number) => {
      ch.parkedCars.push({ x, y, angle, kind: kinds[pk++ % kinds.length] });
    };

    const vcx = roadCenter(i); // جاده عمودی لبه غربی قطعه
    const hcy = roadCenter(j); // جاده افقی لبه جنوبی قطعه
    const edge = WORLD.roadW / 2 + 30; // کنار جدول
    const y0 = j * WORLD.pitch + WORLD.roadW; // ابتدای سگمنت عمودی (بعد از تقاطع)
    const x0 = i * WORLD.pitch + WORLD.roadW;

    // دوبله‌پارکی کنار جاده عمودی (دو طرف)
    if (seed % 4 !== 3) {
      addParked(vcx - edge, y0 + 420, Math.PI);
      addParked(vcx + edge, y0 + 760, 0);
    }
    // کنار جاده افقی
    if (seed % 4 !== 1) {
      addParked(x0 + 250, hcy - edge, -Math.PI / 2);
      addParked(x0 + 640, hcy + edge, Math.PI / 2);
    }

    // سرعت‌گیر — بعضی سگمنت‌ها
    if (seed % 3 === 0) ch.speedBumps.push({ x: vcx, y: y0 + 700, horiz: false });
    if (seed % 4 === 2) ch.speedBumps.push({ x: x0 + 620, y: hcy, horiz: true });

    // تابلوی اسم خیابان در تقاطع (فاز IR-SIGNS — اسم خیابان‌های معروف ایران)
    // هر قطعه یک تقاطع دارد: (vcx, hcy) — دو تابلو: یکی اسم عمودی، یکی افقی
    ch.props.push({
      id: `sign_v_${vcx}_${hcy}`, x: vcx + 320, y: hcy + 320, w: 40, h: 30, solid: false,
      kind: 'streetSign', label: vStreetName(i),
    });
    ch.props.push({
      id: `sign_h_${vcx}_${hcy}`, x: vcx - 350, y: hcy - 350, w: 40, h: 30, solid: false,
      kind: 'streetSign', label: hStreetName(j),
    });

    // ایستگاه اتوبوس / دست‌فروش — بعضی قطعه‌ها
    if (seed % 5 === 0) ch.props.push({ id: `busstop_${vcx}_${y0}`, x: vcx + 330, y: y0 + 380, w: 120, h: 44, solid: true, kind: 'busstop' });
    if (seed % 7 === 3) ch.props.push({ id: `vendor_${x0}_${hcy}`, x: x0 + 520, y: hcy + 360, w: 110, h: 90, solid: true, kind: 'vendor' });

    // بیلبورد طنز — بعضی قطعه‌ها
    const BBS: Array<[string, string]> = [
      ['فانی‌کار', 'بوق بزن، راه باز شه!'],
      ['احتیاط!', 'چاله جلوئه'],
      ['تهران', 'پایتخت ترافیک!'],
      ['بنزین تمام', 'دست خودم نیست :)'],
      ['کمربند ببند', 'یارو با کلاهه!'],
    ];
    if (seed % 9 === 2) {
      const bb = BBS[seed % BBS.length];
      ch.props.push({ id: `bb_${vcx}_${y0}`, x: vcx + 350, y: y0 + 140, w: 220, h: 40, solid: false, kind: 'billboard', label: `${bb[0]}|${bb[1]}`, rot: (seed % 5) * 0.04 - 0.08 });
    }

    // بنر خیابانی رنگی — بعضی قطعه‌ها (روی جاده عمودی)
    const BANNERS: Array<[string, string]> = [
      ['جشنواره فروش فانی‌کار', '#E63946'],
      ['چهارشنبه‌سوق محله', '#2D7DD2'],
      ['جشن نان تازه — نانوایی سعید', '#F2B705'],
      ['افتتاحیه کافه ساعت ۵', '#8AC926'],
      ['چشم شما نقطه نظر شهر', '#7B5EA7'],
    ];
    if (seed % 11 === 4) {
      const bn = BANNERS[seed % BANNERS.length];
      ch.props.push({ id: `banner_${vcx}_${y0}`, x: vcx, y: y0 + 300, w: 620, h: 40, solid: false, kind: 'banner', label: bn[0], rot: 0, tint: bn[1] });
    } else if (seed % 11 === 8) {
      const bn = BANNERS[(seed + 3) % BANNERS.length];
      ch.props.push({ id: `banner_h_${x0}_${hcy}`, x: x0 + 300, y: hcy, w: 40, h: 620, solid: false, kind: 'banner', label: bn[0], rot: Math.PI / 2, tint: bn[1] });
    }

    // موتور پارک‌شده + کیسه زباله + مخروط (شکستنی)
    if (seed % 3 === 1) ch.props.push({ id: `moto_${vcx}_${y0}`, x: vcx + 330, y: y0 + 620, w: 60, h: 26, solid: false, kind: 'moto', breakable: true });
    if (seed % 3 === 2) ch.props.push({ id: `bags_${x0}_${hcy}`, x: x0 + 210, y: hcy - 320, w: 46, h: 40, solid: false, kind: 'bags', breakable: true });
    if (seed % 5 === 4) {
      ch.props.push({ id: `cone1_${vcx}_${y0}`, x: vcx - 250, y: y0 + 300, w: 54, h: 54, solid: false, kind: 'cone', breakable: true });
      ch.props.push({ id: `cone2_${vcx}_${y0}`, x: vcx - 214, y: y0 + 420, w: 54, h: 54, solid: false, kind: 'cone', breakable: true });
    }

    // درخت GLB کنار سگمنت‌ها
    if (seed % 2 === 0) ch.props.push({ id: `gtree_${vcx}_${y0}`, x: vcx - (edge + 74), y: y0 + 520, w: 130, h: 122, solid: false, kind: 'gtree', rot: seed % 4 });
    if (seed % 3 !== 2) ch.props.push({ id: `gtrees_${x0}_${hcy}`, x: x0 + 830, y: hcy - (edge + 74), w: 152, h: 146, solid: false, kind: 'gtreeSmall', rot: (seed + 1) % 4 });

    // سکه‌ها روی لاین داخلی — الگوی قطعی
    if ((i + j) % 2 === 0) {
      for (let n = 0; n < 3; n++) {
        ch.coins.push({ x: vcx + WORLD.laneIn, y: y0 + 320 + n * 460, taken: false, seed: ((i * 7 + j * 13 + n) * 0.7) % (Math.PI * 2) });
      }
    }
    if ((i * 3 + j) % 2 === 1) {
      for (let n = 0; n < 3; n++) {
        ch.coins.push({ x: x0 + 340 + n * 500, y: hcy - WORLD.laneIn, taken: false, seed: ((i * 11 + j * 5 + n) * 0.7) % (Math.PI * 2) });
      }
    }
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
