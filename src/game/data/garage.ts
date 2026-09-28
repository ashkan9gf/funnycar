/**
 * garage.ts — گاراژ عمو نقی: آپگریدها و رنگ‌ها (فاز ۶ — Data-Driven)
 * ============================================================
 * ⭐ همه اعداد قیمت/اثر اینجاست؛ هیچ عددی در منطق Hard-Code نمی‌شود.
 * - هر آپگرید ۵ سطح دارد؛ سطح ۰ = کارخانه (پیش‌فرض balance.ts)
 * - ضریب‌ها خطی per-level هستند و در upgradeTuning به ضریب خودرو تبدیل می‌شوند
 * - رنگ‌ها فقط ظاهری‌اند (بدنه سه‌بعدی بازیکن واقعاً عوض می‌شود)
 */

/** شناسه آپگریدها */
export type UpgradeId = 'engine' | 'brake' | 'tire' | 'armor';

/** ضرایب تیون خودرو — ۱ = حالت کارخانه */
export interface VehicleTuning {
  /** ضریب سرعت بیشینه */
  maxSpeedMul: number;
  /** ضریب شتاب */
  accelMul: number;
  /** ضریب قدرت ترمز */
  brakeMul: number;
  /** ضریب چسبندگی لاستیک (بیشتر = درفت کمتر) */
  gripMul: number;
  /** ضریب تیزی فرمان */
  steerMul: number;
  /** ضریب آسیب ورودی (کمتر = بدنه مقاوم‌تر) */
  armorMul: number;
}

export const NEUTRAL_TUNING: VehicleTuning = {
  maxSpeedMul: 1,
  accelMul: 1,
  brakeMul: 1,
  gripMul: 1,
  steerMul: 1,
  armorMul: 1,
};

export interface UpgradeDef {
  id: UpgradeId;
  title: string;
  /** توضیح فنی کوتاه — با عدد درصد سطح فعلی پر می‌شود */
  effectFmt: (pct: number) => string;
  /** درصد اثر هر سطح (مثلاً ۵ = +۵٪ در هر سطح) */
  perLevelPct: number;
  maxLevel: number;
  /** قیمت خرید سطح n+۱ (index = سطح فعلی) */
  prices: number[];
  /** جملات طنز عمو نقی بعد از خرید */
  flavor: string[];
}

export const MAX_UPGRADE_LEVEL = 5;

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'engine',
    title: 'موتور',
    effectFmt: (p) => `سرعت و شتاب +${p}٪`,
    perLevelPct: 5,
    maxLevel: MAX_UPGRADE_LEVEL,
    prices: [220, 420, 750, 1200, 1900],
    flavor: [
      'این کاربراتور رو با دستِ خودم باز و بسته کردم!',
      'حالا پرایدت از سمند جلو می‌زنه... بهم ربطی نداره!',
      'موتور دیگه خونه‌ی مادربزرگم رو هم تفت می‌ده!',
      'ایده‌ل... فقط موقع گاز دادن نذار بوقچی بمونه!',
      'دیگه سرعتت از افکارِ زن‌خاله‌ات هم سریع‌تره!',
    ],
  },
  {
    id: 'brake',
    title: 'ترمز',
    effectFmt: (p) => `قدرت ترمز +${p}٪`,
    perLevelPct: 9,
    maxLevel: MAX_UPGRADE_LEVEL,
    prices: [180, 360, 640, 1000, 1600],
    flavor: [
      'لنت نو گذاشتم — همینا رو از ماشین خودم کندم!',
      'دیگه جلوی منبر هم می‌ایستی!',
      'ترمزه دیگه، نه استپ... فرق داره!',
      'با این ترمز می‌شه تو چراغ قرمز دعوا کرد!',
      'حالا فقط مواظب باش مسافر از شیشه رد نشه!',
    ],
  },
  {
    id: 'tire',
    title: 'لاستیک و فرمان',
    effectFmt: (p) => `چسبندگی +${p}٪ و فرمان تیزتر`,
    perLevelPct: 7,
    maxLevel: MAX_UPGRADE_LEVEL,
    prices: [200, 400, 700, 1100, 1700],
    flavor: [
      'لاستیک‌ها پفکی نیستن، قول می‌دم!',
      'حالا تو پیچ‌های ولیعصر مثل قطار می‌چرخی!',
      'دیگه تو دوربرگردون در نمیری!',
      'فرمانم یه دلِ صدشده شد!',
      'با این لاستیکا می‌تونی روی دیوار هم پارک کنی!',
    ],
  },
  {
    id: 'armor',
    title: 'بدنه و سپر',
    effectFmt: (p) => `آسیب برخورد −${p}٪`,
    perLevelPct: 11,
    maxLevel: MAX_UPGRADE_LEVEL,
    prices: [240, 460, 800, 1250, 2000],
    flavor: [
      'این سپر رو از نیسانِ پس و پیش درآوردم!',
      'حالا می‌تونی با سطل زباله هم‌قهر شی!',
      'ضربه‌ها دیگه به دلت نمی‌خوره، به ماشینم نه!',
      'بدنه شد مثل تانکِ آب‌رسونی!',
      'دیگه ماشینت تو تصادف بیشتر از تو ناراحت نمی‌شه!',
    ],
  },
];

export function upgradeById(id: UpgradeId): UpgradeDef {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) throw new Error(`[garage] upgrade not found: ${id}`);
  return u;
}

/** قیمت خرید سطح بعد (null = حداکثر رسیده) */
export function nextUpgradePrice(id: UpgradeId, level: number): number | null {
  const u = upgradeById(id);
  if (level >= u.maxLevel) return null;
  return u.prices[Math.max(0, Math.min(u.maxLevel - 1, level))];
}

/**
 * تبدیل سطوح آپگرید به ضرایب تیون خودرو
 * - engine: maxSpeed +5٪/لول، accel +6٪/لول
 * - brake: +9٪/لول
 * - tire: grip +7٪/لول، steer +4٪/لول
 * - armor: آسیب ×(1−0.11)^لول (خطی مخرج نمی‌شود؛ ضریبیش طبیعی‌تر است)
 */
export function upgradeTuning(levels: Record<UpgradeId, number>): VehicleTuning {
  const lv = (id: UpgradeId): number => {
    const raw = levels[id];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
    return Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(raw)));
  };
  const e = lv('engine');
  const b = lv('brake');
  const t = lv('tire');
  const a = lv('armor');
  const armor = Math.pow(1 - 0.11, a);
  return {
    maxSpeedMul: 1 + 0.05 * e,
    accelMul: 1 + 0.06 * e,
    brakeMul: 1 + 0.09 * b,
    gripMul: 1 + 0.07 * t,
    steerMul: 1 + 0.04 * t,
    armorMul: armor,
  };
}

// ---------- رنگ‌ها ----------

export interface PaintDef {
  id: string;
  name: string;
  hex: string;
  price: number; // 0 = رایگان/پیش‌فرض
}

/** رنگ‌های گاراژ — اسم‌ها طنز ایرانی */
export const PAINTS: PaintDef[] = [
  { id: 'white', name: 'سفید شیری', hex: '#f4f4f0', price: 0 },
  { id: 'red', name: 'قرمز دوبل‌کوچه', hex: '#c0392b', price: 180 },
  { id: 'blue', name: 'آبی نیسانی', hex: '#2f6fae', price: 180 },
  { id: 'yellow', name: 'زرد تاکسی', hex: '#f2c230', price: 260 },
  { id: 'orange', name: 'نارنجی آناناسی', hex: '#e8772e', price: 260 },
  { id: 'green', name: 'سبز پلیسی', hex: '#2e8b57', price: 340 },
  { id: 'pink', name: 'صورتی پارتی', hex: '#e06598', price: 380 },
  { id: 'black', name: 'مشکی لیموزین', hex: '#23272b', price: 420 },
];

export const DEFAULT_PAINT_ID = 'white';

export function paintById(id: string): PaintDef | undefined {
  return PAINTS.find((p) => p.id === id);
}

/** توضیح طنز هر رنگ — زیر سواچ نمایش داده می‌شود */
export const PAINT_FLAVOR: Record<string, string> = {
  white: 'همون که از کارخانه اومد — راحتِ راحت',
  red: 'قرمز که باشه، همیشه جلو می‌زنه!',
  blue: 'همرنگ نیسان عمو غلام!',
  yellow: 'مردم فکر می‌کنن تاکسی‌ای — دستشون رو بلند نکن!',
  orange: 'آناناسی! خیسِ خیس...',
  green: 'پلیس که نیستی، ولی بذار فکر کنن!',
  pink: 'بابا اسفهان تأیید کرد!',
  black: 'لیموزین عمو! فقط گَر می‌گیره یه کم',
};

/** فهرست شناسه‌های مجاز رنگ (برای migrate سیو) */
export const PAINT_IDS = PAINTS.map((p) => p.id);

/** جملات عمو نقی وقتی پول کم میاری */
export const GARAGE_POOR_LINES = [
  'پول بیار بعد بیا! گاراژ خیریه نیست!',
  'با این سکه‌ها نون بربری هم نمی‌شه گرفت!',
  'برو دو تا مسافرکشی بزن، بعد بیا سراغ من!',
  'حساب کردنی ندارم... پول نقد حرف اول رو می‌زنه!',
];

/** جمله پیش‌فرض پاورقی گاراژ */
export const GARAGE_FOOTER = 'عمو نقی: «ماشینت رو بدِه این‌جا، خودت پیاده برو خونه!»';
