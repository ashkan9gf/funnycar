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

export type TileKind = 'road_v' | 'road_h' | 'cross' | 'sidewalk' | 'ground';

export interface WorldProp {
  id: string;         // شناسه Asset (در manifest) یا نوع برنامه‌ای
  x: number; y: number; w: number; h: number;
  solid: boolean;     // برخورد دارد؟
  kind: 'tree' | 'trash' | 'pole' | 'cone' | 'building' | 'crate'
    | 'busstop' | 'vendor' | 'billboard' | 'streetSign' | 'moto' | 'bags'
    | 'azadiTower' | 'miladTower';
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

/** ماشین دوبله‌پارک کنار جدول */
export interface ParkedCar {
  x: number; y: number;
  angle: number;
  kind: 'pride' | 'peugeot405' | 'tiba' | 'nissan' | 'samand';
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

const T = 280; // کاشی پایه — pitch و roadW دقیق بخش‌پذیرند (1400/280=5، 560/280=2)

export class World {
  /** نقشه کاشی‌ها (32×32) */
  tiles: TileKind[] = [];
  gridSize = WORLD_SIZE / T; // 32
  colliders: Collider[] = [];
  props: WorldProp[] = [];
  coins: Coin[] = [];
  /** خیابان ایرانی: دوبله‌پارک‌ها، سرعت‌گیرها، زون‌های تعمیر */
  parkedCars: ParkedCar[] = [];
  speedBumps: SpeedBump[] = [];
  repairZones: RepairZone[] = [];

  constructor() {
    this.buildTiles();
    this.buildBlocks();
    this.buildStreetLife();
    this.buildCoins();
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
  /** بلوک 840px: پیاده‌رو ~100 → جای ساختمان تا 640 */
  private addBuilding(bx: number, by: number, assetId: string, landmark = false): void {
    const size = landmark ? 660 : 640;
    const x = bx + (840 - size) / 2;
    const y = by + (840 - size) / 2;
    this.props.push({ id: `building_${x}_${y}`, x, y, w: size, h: size, solid: false, kind: 'building', assetId, landmark });
    this.colliders.push({ x, y, w: size, h: size });
  }

  private addProp(kind: WorldProp['kind'], x: number, y: number, w: number, h: number, solid: boolean, extra?: Partial<WorldProp>): void {
    this.props.push({ id: `prop_${kind}_${x}_${y}`, x, y, w, h, solid, kind, ...extra });
    if (solid) this.colliders.push({ x, y, w, h });
  }

  private buildBlocks(): void {
    const N = WORLD.roadCount; // 6×6 = 36 بلوک
    /**
     * چیدمان تهران‌گونه — قطعی:
     *  شمال (j=0..1): آپارتمان‌های بلند + برج میلاد (4,0)
     *  مرکز (j=2..3): پارک‌ها + تعمیرگاه + پمپ بنزین + برج آزادی (0,3)
     *  جنوب (j=4..5): خانه‌های آجری و مغازه‌ها
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

    layout.forEach((cell, idx) => {
      const i = idx % N;
      const j = Math.floor(idx / N);
      const bx = i * WORLD.pitch + WORLD.roadW;
      const by = j * WORLD.pitch + WORLD.roadW;
      const cx = bx + 420;
      const cy = by + 420;
      const seed = i * 7 + j * 13;

      if (cell === 'park') {
        // پارک محله — درخت‌های برخوردی + زباله/مخروط شکستنی
        this.addProp('tree', cx - 230, cy - 190, 120, 120, true);
        this.addProp('tree', cx + 120, cy - 220, 140, 140, true);
        this.addProp('tree', cx - 60, cy + 110, 125, 125, true);
        this.addProp('tree', cx + 200, cy + 150, 105, 105, true);
        this.addProp('tree', cx - 220, cy + 10, 110, 110, true);
        this.addProp('trash', cx + 40, cy - 40, 60, 60, false, { breakable: true });
        this.addProp('cone', cx - 120, cy + 40, 54, 54, false, { breakable: true });
        return;
      }
      if (cell === 'milad') {
        // برج میلاد — پایه روی بلوک، غول‌پیکر (دیده از همه‌جا)
        this.addProp('miladTower', bx + 220, by + 220, 400, 400, true, { landmark: true });
        this.addProp('tree', bx + 690, by + 160, 110, 110, true);
        this.addProp('tree', bx + 130, by + 660, 110, 110, true);
        return;
      }
      if (cell === 'azadi') {
        // برج آزادی در میدان
        this.addProp('azadiTower', bx + 100, by + 180, 640, 440, true, { landmark: true });
        this.addProp('tree', bx + 180, by + 680, 110, 110, true);
        this.addProp('bags', bx + 700, by + 240, 46, 40, false, { breakable: true });
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
      this.addBuilding(bx, by, cell, isLandmark);
      // پروپ‌های کنار ساختمان — با تنوع قطعی
      if (seed % 3 === 0) this.addProp('trash', bx + 60, by + 770, 58, 58, false, { breakable: true });
      if (seed % 4 === 1) this.addProp('pole', bx + 780, by + 80, 46, 46, true);
      if (seed % 4 === 2) this.addProp('cone', bx + 760, by + 760, 54, 54, false, { breakable: true });
      if (seed % 5 === 0) this.addProp('crate', bx + 110, by + 90, 62, 62, false, { breakable: true });
      if (seed % 5 === 2) this.addProp('bags', bx + 730, by + 640, 46, 40, false, { breakable: true });
    });

    // دیوارهای محدوده دنیا (نگه‌داشتن بازیکن داخل شهر)
    const m = 4;
    this.colliders.push(
      { x: -m, y: -m, w: WORLD_SIZE + 2 * m, h: m },
      { x: -m, y: WORLD_SIZE, w: WORLD_SIZE + 2 * m, h: m },
      { x: -m, y: -m, w: m, h: WORLD_SIZE + 2 * m },
      { x: WORLD_SIZE, y: -m, w: m, h: WORLD_SIZE + 2 * m },
    );
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
    const kinds: ParkedCar['kind'][] = ['pride', 'peugeot405', 'tiba', 'nissan', 'samand'];
    let k = 0;
    const addParked = (x: number, y: number, angle: number) => {
      if (x < 60 || x > WORLD_SIZE - 60 || y < 60 || y > WORLD_SIZE - 60) return;
      this.parkedCars.push({ x, y, angle, kind: kinds[k++ % kinds.length] });
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
    this.speedBumps.push(
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
    this.repairZones.push(
      { x: roadCenter(2) + WORLD.laneOut, y: 2 * WORLD.pitch + WORLD.roadW + 420, r: 150, label: 'تعمیرگاه' },
      { x: 3 * WORLD.pitch + WORLD.roadW + 420, y: roadCenter(3), r: 150, label: 'پمپ بنزین' },
    );

    // ---------- پراپ‌های خیابانی ----------
    const addLife = (
      kind: WorldProp['kind'], x: number, y: number, w: number, h: number,
      solid: boolean, extra?: Partial<WorldProp>,
    ) => {
      const p: WorldProp = { id: `life_${kind}_${x}_${y}`, x, y, w, h, solid, kind, ...extra };
      this.props.push(p);
      if (solid) this.colliders.push({ x, y, w, h });
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
    // تابلوهای خیابان‌های معروف در تقاطع‌ها
    addLife('streetSign', roadCenter(1) + 320, roadCenter(1) + 320, 40, 30, false, { label: 'خیابان ولیعصر' });
    addLife('streetSign', roadCenter(2) - 350, roadCenter(1) + 320, 40, 30, false, { label: 'خیابان انقلاب' });
    addLife('streetSign', roadCenter(0) + 320, roadCenter(2) - 350, 40, 30, false, { label: 'خیابان آزادی' });
    addLife('streetSign', roadCenter(3) - 350, roadCenter(3) - 350, 40, 30, false, { label: 'بلوار شریعتی' });
    addLife('streetSign', roadCenter(4) + 320, roadCenter(0) + 320, 40, 30, false, { label: 'خیابان تجریش' });
    addLife('streetSign', roadCenter(5) - 350, roadCenter(5) + 320, 40, 30, false, { label: 'بازار تهران' });
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
      this.coins.push({ x, y, taken: false, seed: (i * 0.7) % (Math.PI * 2) });
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
