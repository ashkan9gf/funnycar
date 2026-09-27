/**
 * World.ts — شهر کوچک بازی (Phase 1)
 * ============================================================
 * ساختار: شبکه‌ای از جاده‌های 256px با بلوک‌های 768px بین‌شان.
 *  - کاشی‌ها فقط «نوع» دارند (نمایش در WorldRenderer)
 *  - موانع برخوردی: ساختمان‌ها + دیوار محدوده + پروپ‌های سخت
 *  - سکه‌ها: قابل جمع‌آوری
 * نقشه قطعی (Deterministic) است — بدون Random تا تست‌ها تکرارپذیر باشند.
 */

import type { Collider } from '../entities/Vehicle';
import { RENDER } from '../data/balance';

export type TileKind = 'road_v' | 'road_h' | 'cross' | 'sidewalk' | 'ground';

export interface WorldProp {
  id: string;         // شناسه Asset (در manifest) یا نوع برنامه‌ای
  x: number; y: number; w: number; h: number;
  solid: boolean;     // برخورد دارد؟
  kind: 'tree' | 'trash' | 'pole' | 'cone' | 'building'
    | 'busstop' | 'vendor' | 'billboard' | 'streetSign' | 'moto' | 'bags';
  /** برای ساختمان‌ها: شناسه Asset ساختمان (فاز 3) */
  assetId?: string;
  tint?: string;      // رنگ placeholder ساختمان
  /** لندمارک = ساختمان ویژه (مثل پمپ بنزین) — کمی بزرگ‌تر رسم می‌شود */
  landmark?: boolean;
  /** متن تابلو (streetSign/billboard) یا چرخش (رادیان) برای پراپ‌های جهت‌دار */
  label?: string;
  rot?: number;
}

/** ماشین دوبله‌پارک کنار جدول (فاز GTA-IR) */
export interface ParkedCar {
  x: number; y: number;
  angle: number;
  kind: 'pride' | 'peugeot405' | 'tiba' | 'nissan' | 'samand';
}

/** سرعت‌گیر روی جاده — horiz = جاده افقی (خودرو در راستای X از رویش رد می‌شود) */
export interface SpeedBump { x: number; y: number; horiz: boolean }

export interface Coin {
  x: number; y: number;
  taken: boolean;
  /** فاز انیمیشن برای بونس */
  seed: number;
}

export const WORLD = {
  /** فاصله تکرار جاده‌ها (بلوک 768 + جاده 256) */
  pitch: 1024,
  roadW: 256,
  /** تعداد جاده در هر محور = 4 (شامل لبه‌ها) → دنیای 3328px */
  roadCount: 4,
} as const;

export const WORLD_SIZE = WORLD.roadCount * WORLD.pitch + WORLD.roadW;

const T = RENDER.tileSize;

export class World {
  /** نقشه کاشی‌ها (13×13) */
  tiles: TileKind[] = [];
  gridSize = WORLD_SIZE / T; // 13
  colliders: Collider[] = [];
  props: WorldProp[] = [];
  coins: Coin[] = [];
  /** خیابان ایرانی: دوبله‌پارک‌ها و سرعت‌گیرها */
  parkedCars: ParkedCar[] = [];
  speedBumps: SpeedBump[] = [];

  constructor() {
    this.buildTiles();
    this.buildBlocks();
    this.buildStreetLife();
    this.buildCoins();
  }

  // ---------- کاشی‌بندی ----------
  private isRoadCol(c: number): boolean {
    return c * T < WORLD_SIZE && c % (WORLD.pitch / T) === 0;
  }
  private isRoadRow(r: number): boolean {
    return r % (WORLD.pitch / T) === 0;
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
  /**
   * ساختمان واقعی با Asset (فاز 2: ENV-005..008)
   * اگر assetId داده نشود، ساختمان برنامه‌ای برچسب‌دار رسم می‌شود (fallback)
   */
  private addBuilding(bx: number, by: number, assetId: string, landmark = false): void {
    // بلوک 768px: پیاده‌رو 64 → جای ساختمان 640
    const w = landmark ? 620 : 560;
    const h = landmark ? 620 : 620;
    const x = bx + (768 - w) / 2;
    const y = by + (768 - h) / 2;
    this.props.push({ id: `building_${x}_${y}`, x, y, w, h, solid: false, kind: 'building', assetId, landmark });
    this.colliders.push({ x, y, w, h });
  }

  private addProp(kind: WorldProp['kind'], x: number, y: number, w: number, h: number, solid: boolean): void {
    this.props.push({ id: `prop_${kind}_${x}_${y}`, x, y, w, h, solid, kind });
    if (solid) this.colliders.push({ x, y, w, h });
  }

  private buildBlocks(): void {
    const blockPos: Array<[number, number]> = [];
    for (let i = 0; i < WORLD.roadCount - 1; i++) {
      for (let j = 0; j < WORLD.roadCount - 1; j++) {
        blockPos.push([i * WORLD.pitch + WORLD.roadW, j * WORLD.pitch + WORLD.roadW]);
      }
    }

    // 9 بلوک — فاز 2: ساختمان‌های واقعی ENV-005/006/007 + لندمارک ENV-008 (پمپ بنزین)
    // چیدمان قطعی (Deterministic): تنوع بصری در هر بلوک، پارک در مرکز (idx=4)
    const layout: string[] = [
      'env_building_home_01',   // idx 0 (شمال‌غرب)
      'env_building_shop_01',   // idx 1 (شمال)
      'env_building_home_01',   // idx 2 (شمال‌شرق)
      'env_building_garage_01', // idx 3 (غرب)
      'park',                   // idx 4 (مرکز = پارک)
      'env_gas_station_01',     // idx 5 (شرق — لندمارک)
      'env_building_shop_01',   // idx 6 (جنوب‌غرب)
      'env_building_home_01',   // idx 7 (جنوب)
      'env_building_garage_01', // idx 8 (جنوب‌شرق)
    ];
    blockPos.forEach(([bx, by], idx) => {
      const cx = bx + 384;
      const cy = by + 384;
      const cell = layout[idx] ?? 'env_building_home_01';
      if (cell === 'park') {
        // پارک محله — درخت‌ها با برخورد + چند مخروط بازیگوش
        this.addProp('tree', cx - 220, cy - 180, 110, 110, true);
        this.addProp('tree', cx + 120, cy - 200, 130, 130, true);
        this.addProp('tree', cx - 60, cy + 120, 120, 120, true);
        this.addProp('tree', cx + 190, cy + 150, 100, 100, true);
        this.addProp('trash', cx - 230, cy + 40, 70, 70, true);
        this.addProp('cone', cx + 40, cy - 20, 54, 54, false);
        return;
      }
      const isLandmark = cell === 'env_gas_station_01';
      this.addBuilding(bx, by, cell, isLandmark);
      // پروپ کنار ساختمان‌ها
      if (idx % 2 === 0) this.addProp('trash', bx + 60, by + 700, 64, 64, true);
      if (idx % 3 === 0) this.addProp('pole', bx + 690, by + 90, 46, 46, true);
      if (idx % 3 === 1) this.addProp('cone', bx + 700, by + 690, 54, 54, false);
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
   * زندگی خیابانی ایران (فاز GTA-IR) — قطعی و بدون Random:
   * دوبله‌پارکی نیمه‌روی جدول، سرعت‌گیر، ایستگاه اتوبوس، دست‌فروش،
   * تابلو خیابان‌های معروف، موتور پارک‌شده، پلاستیک زباله، بیلبورد طنز
   */
  private buildStreetLife(): void {
    // ---------- دوبله‌پارکی‌ها (نیمه روی جدول — خیلی ایرانی!) ----------
    const roadCenters = [128, 1152, 2176, 3200, 4224];
    // مراکز سگمنت‌ها بین تقاطع‌ها (گره‌ها در ۱۲۸/۱۱۵۲/۲۱۷۶/۳۲۰۰)
    const segMids = [640, 1664, 2688];
    const kinds: ParkedCar['kind'][] = ['pride', 'peugeot405', 'tiba', 'nissan', 'samand'];
    let k = 0;
    const addParked = (x: number, y: number, angle: number) => {
      // فقط داخل مرز دنیا (جدول‌های لبه جای پارک ندارند!)
      if (x < 60 || x > WORLD_SIZE - 60 || y < 60 || y > WORLD_SIZE - 60) return;
      this.parkedCars.push({ x, y, angle, kind: kinds[k++ % kinds.length] });
    };
    // جاده‌های عمودی: دو ماشین در هر سگمنت، طرف‌های متناوب
    roadCenters.forEach((cx, i) => {
      segMids.forEach((my, j) => {
        if ((i + j) % 2 === 0) addParked(cx - 170, my - 110, Math.PI); // سمت غربی (رو به جنوب)
        addParked(cx + 170, my + 130, 0);                              // سمت شرقی (رو به شمال)
      });
    });
    // جاده‌های افقی: یک ماشین در هر سگمنت
    roadCenters.forEach((cy, i) => {
      segMids.forEach((mx, j) => {
        if ((i + j) % 2 === 0) addParked(mx + 90, cy - 170, Math.PI / 2);   // رو به شرق
        else addParked(mx - 110, cy + 170, -Math.PI / 2);                    // رو به غرب
      });
    });

    // ---------- سرعت‌گیرها (۶ عدد — شامل مسیر اسپاون بازیکن) ----------
    this.speedBumps.push(
      { x: 1152, y: 1664, horiz: false },
      { x: 1152, y: 2688, horiz: false },
      { x: 2176, y: 640, horiz: false },
      { x: 640, y: 1152, horiz: true },
      { x: 2688, y: 2176, horiz: true },
      { x: 1664, y: 3200, horiz: true },
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

    // ایستگاه اتوبوس کنار پارک مرکزی (رو به جاده شمالی)
    addLife('busstop', 1740, 1300, 120, 44, true);
    // دست‌فروش میوه‌فروش جنوب پارک
    addLife('vendor', 1480, 1970, 110, 90, true);
    // بیلبوردهای طنز روی بلوک‌های شمالی
    addLife('billboard', 660, 300, 220, 40, false, { label: 'فانی‌کار|بوق بزن، راه باز شه!' });
    addLife('billboard', 2740, 320, 220, 40, false, { label: 'احتیاط!|چاله جلوئه', rot: 0.12 });
    // تابلوهای خیابان‌های معروف در گوشه تقاطع‌ها
    addLife('streetSign', 1310, 1310, 40, 30, false, { label: 'خیابان ولیعصر' });
    addLife('streetSign', 2290, 1310, 40, 30, false, { label: 'خیابان انقلاب' });
    addLife('streetSign', 320, 980, 40, 30, false, { label: 'خیابان آزادی' });
    addLife('streetSign', 2340, 2340, 40, 30, false, { label: 'بلوار شریعتی' });
    // موتورهای پارک‌شده روی پیاده‌رو
    addLife('moto', 1300, 1520, 60, 26, false);
    addLife('moto', 2330, 1620, 60, 26, false);
    addLife('moto', 320, 1720, 60, 26, false);
    // پلاستیک‌های زباله کنار جدول
    addLife('bags', 360, 980, 46, 40, false);
    addLife('bags', 2040, 360, 46, 40, false);
    addLife('bags', 2330, 2610, 46, 40, false);
    addLife('bags', 1000, 2350, 46, 40, false);
  }

  // ---------- سکه‌ها (روی جاده‌ها و پارک) ----------
  private buildCoins(): void {
    const positions: Array<[number, number]> = [];
    // جاده عمودی دوم — روی لاین راست (مسیر اسپاون)
    const mid = 1216;
    for (let y = 320; y < WORLD_SIZE - 300; y += 420) positions.push([mid, y]);
    // جاده افقی وسط
    for (let x = 340; x < WORLD_SIZE - 300; x += 480) positions.push([x, mid]);
    // دور پارک مرکزی
    positions.push([1280 - 190, 1280 + 120], [1280 + 190, 1280 + 120], [1280, 1280 - 230]);

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

  /** نقطه شروع بازیکن: لاین راست جاده عمودی دوم (هم‌راستا با ترافیک شمال‌رو) */
  playerSpawn(): { x: number; y: number; angle: number } {
    return { x: 1152 + 64, y: WORLD_SIZE * 0.72, angle: 0 };
  }
}
