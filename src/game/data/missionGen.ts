/**
 * missionGen.ts — مولد مأموریت‌های بی‌پایان (v0.2.40)
 * ============================================================
 * هدف کاربر: «مأموریت‌ها تموم نشن و تکراری هم نباشن»
 *  - بی‌نهایت مأموریت: هر سطح (level) یک مأموریت تازه با id پایدار «gen_N»
 *  - قطعی (Deterministic): همان id همیشه همان مأموریت → ذخیره/تکرار درست کار می‌کند
 *  - غیرتکراری: نوع مأموریت در هر «اپک» ۸تایی شافل می‌شود + استخر محتوا (مسافر/مقصد/داستان)
 *    به‌صورت قطعی چرخان است → هیچ دو مأموریت پشت‌سرهم شکل و متن یکسان ندارند
 *  - سختی پله‌ای: با بالا رفتن سطح، وقت کمتر/سکه بیشتر/چک‌پوینت بیشتر/جای پارک تنگ‌تر
 *  - مختصات فقط روی شبکه جاده معتبر (مراکز ۱۴۰۰ + وسط سگمنت‌ها) — قابل رسیدن همیشه
 */

import type { MissionDef } from './missions';

/** تعداد مأموریت بی‌پایانِ هم‌زمانِ قابل‌دید در منو */
export const ENDLESS_WINDOW = 6;

/** شناسه پیشوند مأموریت‌های مولد */
export const GEN_PREFIX = 'gen_';

/** «gen_7» → 7 ؛ غیر gen → null */
export function endlessLevel(id: string): number | null {
  if (!id.startsWith(GEN_PREFIX)) return null;
  const n = Number(id.slice(GEN_PREFIX.length));
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

// ============ RNG قطعی (xmur3 + mulberry32) ============

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** شافل قطعی Fisher–Yates */
function shuffled<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pick = <T,>(arr: readonly T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

// ============ استخر مختصات معتبر روی جاده ============

/** مراکز جاده‌ها: roadCenter(k) = k*1400 + 280 */
const CENTERS = [280, 1680, 3080, 4480, 5880, 7280, 8680] as const;
/** وسط سگمنت‌ها */
const MIDS = [980, 2380, 3780, 5180, 6580, 7630] as const;
/** اسپاون بازیکن */
const SPAWN = { x: 1750, y: 6630 };
/** جای پارک دوبل معتبر (جدول شرقی همه سگمنت‌ها + جدول غربی سگمنت‌های فرد) */
const PARK_EAST_Y = [1150, 2550, 3950, 5350, 6750, 7800] as const;
const PARK_WEST_Y = [2230, 5030, 7480] as const;

type Pt = { x: number; y: number };

/** نقطهٔ تصادفی روی جاده (عمودی یا افقی) — همیشه روی شبکه معتبر */
function roadPoint(rng: () => number): Pt {
  const along = (): number => (rng() < 0.55 ? pick(CENTERS, rng) : pick(MIDS, rng));
  if (rng() < 0.5) {
    // جاده عمودی: x = مرکز، y = طول جاده
    return { x: pick(CENTERS, rng), y: along() };
  }
  // جاده افقی: y = مرکز، x = طول جاده
  return { y: pick(CENTERS, rng), x: along() };
}

const manhattan = (a: Pt, b: Pt): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** نقطهٔ جاده با حداقل فاصله از مبدأ (حلقه محدود — همیشه جواب دارد) */
function roadPointFarFrom(rng: () => number, from: Pt, minDist: number): Pt {
  let best = roadPoint(rng);
  let bestD = manhattan(best, from);
  for (let i = 0; i < 8 && bestD < minDist; i++) {
    const p = roadPoint(rng);
    const d = manhattan(p, from);
    if (d > bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

// ============ استخر محتوا (کوچه و بازار — طبق قواعد متن سند مادر) ============

/** مسافرها: نام + همراهی‌شان */
const PASSENGERS: ReadonlyArray<{ name: string; item: string }> = [
  { name: 'آقا مرتضی', item: 'یه جعبه ترشی خانمگی' },
  { name: 'خانم احمدی', item: 'کیک عروسی' },
  { name: 'عمو هادی', item: 'گلدان گل تازه' },
  { name: 'دایی رضا', item: 'یه گوسفند کم‌جان' },
  { name: 'خانم دکتر سحر', item: 'کیف پزشکی' },
  { name: 'آقا بهزاد', item: 'سه تا کارتن سوشی' },
  { name: 'مامان‌بزرگ', item: 'یه سبد تخم‌مرغ' },
  { name: 'استاد کاظمی', item: 'یه دسته برگه امتحان' },
  { name: 'خانم زیورآلات', item: 'جعبه طلا' },
  { name: 'آقا شاکی', item: 'یه پروندهٔ مهم' },
  { name: 'عمو نانوا', item: 'یه سینی نون داغ' },
  { name: 'خانم عروس', item: 'گل دسته‌دسته' },
  { name: 'آقا تعمیرکار', item: 'جعبه‌ابزار زنگ‌زده' },
  { name: 'دکتر قناری', item: 'قفس پرنده' },
  { name: 'آقا کیوسک‌چی', item: 'یه دستهٔ روزنامه' },
  { name: 'خانم خیاط', item: 'یه دسته پارچه' },
  { name: 'آقا فوتسال', item: 'کفش‌های تیم' },
  { name: 'عمو آشپز', item: 'یه قابلمه قرمه‌سبزی' },
  { name: 'خانم معلم', item: 'دفترهای تصحیح‌شده' },
  { name: 'آقا خبرنگار', item: 'میکروفون و دوربین' },
  { name: 'دایی شکلات‌فروش', item: 'یه کارتن شکلات' },
  { name: 'خانم نقاش', item: 'یه تابلو تازه‌کشیده' },
  { name: 'آقا سنگ‌وزن', item: 'یه ترازوی قدیمی' },
  { name: 'بابابزرگ قهوه‌چی', item: 'سموار قهوه' },
];

/** مقصدهای اسم‌دار — مختصات روی جادهٔ معتبر */
const DESTS: ReadonlyArray<{ label: string; pt: Pt }> = [
  { label: 'پمپ بنزین', pt: { x: 5180, y: 4480 } },
  { label: 'بازار تهران', pt: { x: 280, y: 5180 } },
  { label: 'ترمینال شرق', pt: { x: 7280, y: 5180 } },
  { label: 'بیمارستان', pt: { x: 3250, y: 3780 } },
  { label: 'دانشگاه', pt: { x: 1680, y: 1680 } },
  { label: 'ورزشگاه', pt: { x: 4480, y: 1680 } },
  { label: 'پارک بزرگ', pt: { x: 1680, y: 4480 } },
  { label: 'دفتر پستی', pt: { x: 5880, y: 3080 } },
  { label: 'سالن عروسی', pt: { x: 3080, y: 5180 } },
  { label: 'شهرک غرب', pt: { x: 7280, y: 3080 } },
  { label: 'میدان اصلی', pt: { x: 4480, y: 4480 } },
  { label: 'شهرک جنوب', pt: { x: 3080, y: 7280 } },
  { label: 'چای‌خانه قدیمی', pt: { x: 8680, y: 6580 } },
  { label: 'کارگاه عمو نقی', pt: { x: 3250, y: 3780 } },
];

/** شروع داستان تاکسی — با {name} {item} {dest} */
const TAXI_HOOKS: ReadonlyArray<string> = [
  '{name} با {item} دمِ در ایستاده؛ می‌گه عجله داره!',
  '{name} تلفنی گفت: «{item} رو نذار صندلی عقب بپره!» مقصدش {dest} است.',
  '{name} ساعت ۷ صبح با {item} سوار شد؛ هنوز چشمش باز نیست!',
  '{name} می‌گه دیرش شده؛ {item} هم که به کیفش نمی‌ره!',
  '{name} با {item} پلو پلو با تو از راه می‌رسه؛ مقصد: {dest}!',
  '{name} می‌گه: «برادرم گفته این تاکسیه؛ تو که رانندگی‌ات قشنگه!» — {item} هم آورده.',
  '{name} عصر جمعه با {item} می‌خواد بره {dest}؛ ترافیک هم که تعطیل نیست!',
  '{name} می‌گه کرایه‌ی اضافه می‌ده، فقط زود برسون به {dest}!',
  '{name} با {item} و یه خمیازهٔ بزرگ سوار شد؛ ببرش {dest}.',
  '{name} می‌گه {item} شکسته‌نشدنی نیست… ولی حسابی مراقب باش!',
  '{name} دم در وایساده؛ می‌گه «{dest}، و اگه زود برسی بنزین مهمون من!»',
  '{name} با {item} سوار می‌شه و از قیمت بنزین غر می‌زنه!',
];

/** داستان مأموریت‌های رسیدن (timed/fragile/tolerant) */
const REACH_HOOKS: ReadonlyArray<{ title: string; intro: string }> = [
  { title: 'ارسال فوری', intro: 'بسته‌ی مهم‌تر از زندگیشه! سالم برسون.' },
  { title: 'دیر رسیدم دیر رسیدم!', intro: 'قرار مهمی داری؛ عقربه‌ها دارن مسابقه می‌دن!' },
  { title: 'پیک روز بد', intro: 'موتورت خراب شد، با ماشین داری پیک می‌ری!' },
  { title: 'کیف گم‌شده', intro: 'کیف یه مسافر جا مونده؛ باید برگرده صاحبش!' },
  { title: 'چای دم‌کشیده', intro: 'یه قوری چای برای دوستت فرستادن؛ نریزد!' },
  { title: 'کبریت و شمع', intro: 'آتش‌بازی نصفه‌مونده؛ بقیه‌اش تو صندلی عقب است!' },
  { title: 'شیرینی عیدی', intro: 'یه جعبه شیرینی که کم‌ترین ضربه هم توش ریز می‌شه!' },
  { title: 'ماشین دودکن ۲', intro: 'باز هم دود می‌کنه مثل قلیون؛ فقط نذار خاموش شه…' },
  { title: 'کارت دعوت', intro: 'دعوت‌نامه‌ها باید قبل از عروسی برسند!' },
  { title: 'دارو مهمه', intro: 'بسته‌ی دارو برای یکی که منتظره — بدون توقف!' },
  { title: 'سبد میوه', intro: 'هندونه‌ی ته سبد هم حق داره سالم برسه!' },
  { title: 'قرارداد امضا', intro: 'یه قرارداد که ساعت ۵ باید امضا بشه!' },
  { title: 'گربهٔ همسایه', intro: 'گربهٔ همسایه تو جعبه است و اعتراض می‌کنه؛ نلرزون!' },
  { title: 'تخم‌مرغ‌ها', intro: 'دو سینی تخم‌مرغ؛ تصادف یعنی املت!' },
  { title: 'گلدون بزرگ', intro: 'گلدون مامان‌بزرگ؛ یه ترمز سخت یعنی خاک رو فرش!' },
  { title: 'عروسک گمشده', intro: 'عروسک بچه‌ی همسایه گم شده؛ برگردونش قبل گریهٔ بزرگ!' },
];

/** هوک چالش‌ها */
const COIN_HOOKS: ReadonlyArray<string> = [
  'صندوق قرضی خالی شده؛ {n} سکه لازم دارم. نه بهونه!',
  'پارکینگ‌چی می‌گه {n} سکه برای تعویض لاستیک جمع کن!',
  'قرعه‌کشی کوچه: هر چی سکه باشه سهم توئه — {n} تا!',
  '{n} سکه بچین تا عمو نقی باور کنه راننده‌ی حرفه‌ای هستی!',
];
const CHECK_HOOKS: ReadonlyArray<string> = [
  'شهر پر از ایستگاهه؛ همه رو به‌ترتیب بزن!',
  'مسابقهٔ محله‌ای: از همه نقاط به‌ترتیب رد شو!',
  'پیک سرعتی: مسیر چندایستگاهه بدون جای خالی!',
  'گشت شهری: همهٔ ایستگاه‌ها باید چک بشن!',
];
const POTHOLE_HOOKS: ReadonlyArray<string> = [
  'شهرداری گفته چاله‌ها رو زدی، ما دیدیم! حداکثر {n} تا!',
  'لاستیک‌ت نداره حق خوردن! بیشتر از {n} چاله ممنوع!',
  'چاله‌ی تازه آسفالت! بیشتر از {n} تا نرو توش!',
];
const PARK_HOOKS: ReadonlyArray<string> = [
  'جای تنگ بین دو ماشین؛ یه خط یعنی فحشِ نرم عمو نقی!',
  'مشتری وایساده؛ صاف و کامل پارک کن!',
  'دنده‌عقب هنر راننده‌ی واقعیه؛ نشون بده!',
  'همسایه از پنجره تماشا می‌کنه؛ آبرو بره وسط!',
];

/** مقصدهای متنِ هدف برای reach */
const REACH_OBJECTIVES: ReadonlyArray<string> = [
  'برس به علامت هدف قبل از پایان وقت',
  'سالم و به‌موقع به علامت برس',
  'مقصد روی نقشه مشخصه — برو که دیر می‌شه!',
];

// ============ انواع مأموریت و پارامترها ============

type KindSpec = {
  kind: MissionDef['kind'];
  baseCoins: number;
  baseRep: number;
};

/** همهٔ انواع — در هر اپک ۸تایی با ترتیب شافل‌شده چرخان می‌شوند */
const KIND_SPECS: ReadonlyArray<KindSpec> = [
  { kind: 'taxi_fare', baseCoins: 55, baseRep: 10 },
  { kind: 'timed_reach', baseCoins: 40, baseRep: 9 },
  { kind: 'coin_rush', baseCoins: 55, baseRep: 10 },
  { kind: 'fragile_reach', baseCoins: 60, baseRep: 11 },
  { kind: 'checkpoint_run', baseCoins: 70, baseRep: 12 },
  { kind: 'parallel_park', baseCoins: 70, baseRep: 12 },
  { kind: 'tolerant_reach', baseCoins: 35, baseRep: 8 },
  { kind: 'pothole_run', baseCoins: 45, baseRep: 10 },
];

const faNum = (n: number): string => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/**
 * تولید مأموریت بی‌پایانِ سطح N — قطعی؛ همان N همیشه همان مأموریت.
 * سختی: وقت × max(0.7, 1-(N-1)*0.02) — سکه += min(60, N*3)
 */
export function generateMission(level: number): MissionDef {
  const L = Math.max(1, Math.floor(level));
  const rng = mulberry32(hashSeed(`${GEN_PREFIX}${L}`));

  // انتخاب نوع: شافل در اپک‌های ۸تایی → پشت‌سرهم تکراری نمی‌شود
  const epoch = Math.floor((L - 1) / KIND_SPECS.length);
  const order = shuffled(KIND_SPECS, mulberry32(hashSeed(`epoch_${epoch}_${GEN_PREFIX}`)));
  const spec = order[(L - 1) % KIND_SPECS.length];
  const diff = Math.max(0.7, 1 - (L - 1) * 0.02);
  const coins = spec.baseCoins + Math.min(60, L * 3) + Math.floor(rng() * 8);
  const rep = spec.baseRep + Math.min(6, Math.floor(L / 4));

  const passenger = pick(PASSENGERS, rng);
  const dest = pick(DESTS, rng);
  const fill = (s: string, num: number = 0): string =>
    s.replace(/\{name\}/g, passenger.name).replace(/\{item\}/g, passenger.item).replace(/\{dest\}/g, dest.label).replace(/\{n\}/g, () => faNum(num));

  const id = `${GEN_PREFIX}${L}`;
  const chainTitle = (t: string): string => `${t} — سطح ${faNum(L)}`;

  switch (spec.kind) {
    // ---------- تاکسی: سوارشدن → مقصد ----------
    case 'taxi_fare': {
      const pickup = roadPointFarFrom(rng, SPAWN, 900);
      let target = roadPoint(rng);
      for (let i = 0; i < 10 && manhattan(pickup, target) < 2600; i++) target = roadPoint(rng);
      const d = manhattan(pickup, target);
      const time = Math.max(55, Math.round((d / 45 + 35) * diff * (0.92 + rng() * 0.16)));
      return {
        id,
        title: chainTitle(`مسافر تا ${dest.label}`),
        intro: fill(pick(TAXI_HOOKS, rng)),
        objective: 'وایسا سر جای سوارشدن، بعد ببر به مقصد — سریع برسی انعام داره!',
        kind: 'taxi_fare',
        category: 'endless',
        pickup,
        target,
        timeLimitSec: time,
        rewardCoins: coins,
        rewardRep: rep,
      };
    }
    // ---------- رسیدن با تایمر ----------
    case 'timed_reach': {
      const target = roadPointFarFrom(rng, SPAWN, 2400);
      const d = manhattan(SPAWN, target);
      const time = Math.max(40, Math.round((d / 70 + 12) * diff * (0.9 + rng() * 0.18)));
      const story = pick(REACH_HOOKS, rng);
      return {
        id,
        title: chainTitle(story.title),
        intro: `${story.intro} مقصد: ${dest.label}!`,
        objective: fill(pick(REACH_OBJECTIVES, rng)),
        kind: 'timed_reach',
        category: 'endless',
        target,
        timeLimitSec: time,
        rewardCoins: coins,
        rewardRep: rep,
      };
    }
    // ---------- رسیدن بدون تصادف ----------
    case 'fragile_reach': {
      const target = roadPointFarFrom(rng, SPAWN, 2000);
      const d = manhattan(SPAWN, target);
      const time = Math.max(45, Math.round((d / 62 + 14) * diff * (0.9 + rng() * 0.18)));
      const story = pick(REACH_HOOKS, rng);
      return {
        id,
        title: chainTitle(story.title),
        intro: `${story.intro} حتی یک تصادف = تمام!`,
        objective: 'حتی یک تصادف شدید نزن — ماشین لَخته!',
        kind: 'fragile_reach',
        category: 'endless',
        target,
        timeLimitSec: time,
        rewardCoins: coins,
        rewardRep: rep,
      };
    }
    // ---------- رسیدن با سقف تصادف ----------
    case 'tolerant_reach': {
      const target = roadPointFarFrom(rng, SPAWN, 1800);
      const story = pick(REACH_HOOKS, rng);
      const maxHard = L >= 12 ? 1 : 2;
      return {
        id,
        title: chainTitle(story.title),
        intro: `${story.intro} عجله‌ای نیست؛ فقط ماشین!`,
        objective: `برس به مقصد — حداکثر ${faNum(maxHard)} تصادف شدید مجازه`,
        kind: 'tolerant_reach',
        category: 'endless',
        target,
        timeLimitSec: 0,
        maxHardCrashes: maxHard,
        rewardCoins: coins,
        rewardRep: rep,
      };
    }
    // ---------- شکار سکه ----------
    case 'coin_rush': {
      const n = 8 + Math.min(8, Math.floor(L / 2));
      const time = Math.max(50, Math.round((n * 11 + 25) * diff));
      return {
        id,
        title: chainTitle('شکار سکه'),
        intro: fill(pick(COIN_HOOKS, rng), n),
        objective: `${faNum(n)} سکه جمع کن قبل از پایان وقت!`,
        kind: 'coin_rush',
        category: 'endless',
        target: roadPoint(rng),
        coinTarget: n,
        timeLimitSec: time,
        rewardCoins: coins,
        rewardRep: rep,
      };
    }
    // ---------- چک‌پوینت ----------
    case 'checkpoint_run': {
      const n = 4 + (L > 4 ? 1 : 0) + (L > 9 ? 1 : 0);
      const cps: Pt[] = [];
      while (cps.length < n) {
        const p = roadPoint(rng);
        if (!cps.some((q) => manhattan(p, q) < 1400)) cps.push(p);
      }
      const time = Math.max(n * 26, Math.round(n * 38 * diff));
      return {
        id,
        title: chainTitle('دور محله'),
        intro: fill(pick(CHECK_HOOKS, rng)),
        objective: `از ${faNum(n)} چک‌پوینت به‌ترتیب رد شو!`,
        kind: 'checkpoint_run',
        category: 'endless',
        target: cps[0],
        checkpoints: cps,
        timeLimitSec: time,
        rewardCoins: coins,
        rewardRep: rep,
      };
    }
    // ---------- پارک دوبل ----------
    case 'parallel_park': {
      const west = rng() < 0.3;
      const spot: Pt = west
        ? { x: 1370, y: pick(PARK_WEST_Y, rng) }
        : { x: 1990, y: pick(PARK_EAST_Y, rng) };
      const spotLen = Math.max(215, 250 - Math.min(35, L * 2));
      const time = Math.max(42, Math.round((62 - Math.min(14, L)) * (0.95 + rng() * 0.1)));
      return {
        id,
        title: chainTitle('پارک دوبل'),
        intro: fill(pick(PARK_HOOKS, rng)),
        objective: 'دنده‌عقب برو تو جای پارک، تراز وایسا، ترمز!',
        kind: 'parallel_park',
        category: 'endless',
        target: spot,
        spotAngle: 0,
        spotLen,
        timeLimitSec: time,
        rewardCoins: coins,
        rewardRep: rep,
      };
    }
    // ---------- چاله‌ها ----------
    default: {
      const maxPotholes = L >= 6 ? 2 : 3;
      const target = roadPointFarFrom(rng, SPAWN, 2000);
      const d = manhattan(SPAWN, target);
      const time = Math.max(45, Math.round((d / 55 + 20) * diff));
      return {
        id,
        title: chainTitle('مسیر چاله‌ها'),
        intro: fill(pick(POTHOLE_HOOKS, rng), maxPotholes),
        objective: `برس به مقصد — حداکثر ${faNum(maxPotholes)} چاله!`,
        kind: 'pothole_run',
        category: 'endless',
        target,
        maxPotholes,
        timeLimitSec: time,
        rewardCoins: coins,
        rewardRep: rep,
      };
    }
  }
}

/**
 * پنجرهٔ بی‌پایان برای منو: اولین ENDLESS_WINDOW مأموریت gen_N انجام‌نشده
 * (همیشه پر است — تموم‌شدنی نیست!)
 */
export function listEndlessMissions(completed: readonly string[]): MissionDef[] {
  const done = new Set(completed);
  const out: MissionDef[] = [];
  let n = 1;
  while (out.length < ENDLESS_WINDOW && n < 9999) {
    const id = `${GEN_PREFIX}${n}`;
    if (!done.has(id)) out.push(generateMission(n));
    n++;
  }
  return out;
}

/** id اولین مأموریت بی‌پایان انجام‌نشده — برای دکمهٔ «مأموریت بعدی» */
export function nextEndlessId(completed: readonly string[]): string {
  const done = new Set(completed);
  let n = 1;
  while (n < 9999 && done.has(`${GEN_PREFIX}${n}`)) n++;
  return `${GEN_PREFIX}${n}`;
}
