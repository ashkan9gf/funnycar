/**
 * missions.ts — تعریف مأموریت‌ها (Data-Driven — طبق GAME_DESIGN بخش ۵)
 * ============================================================
 * ⭐ محتوای مأموریت (متن/هدف/جایزه) اینجاست؛ منطق در MissionManager.
 * اعداد قابل تنظیم فیزیکی در balance.ts (MISSIONS/PARK/TAXI/CHALLENGE) هستند.
 *
 * دسته‌ها (فاز ۵ — منوی بازی):
 *  - story:     مأموریت‌های اصلی سند طراحی
 *  - park:      پارک دوبل — دنده‌عقب بین دو ماشین، تراز و ترمز!
 *  - taxi:      مسافرکشی — سوار کن، برسون، انعام بگیر
 *  - challenge: چالش‌ها — دور تهران، بدون خط، شکار سکه
 *
 * قواعد متن (بخش ۸ سند مادر): کوتاه، محترمانه، آشنا از کوچه و بازار.
 */

/** انواع هدف مأموریت */
export type MissionKind =
  | 'timed_reach'      // رسیدن به هدف قبل از پایان وقت (تصادف شدید = جریمه زمان)
  | 'fragile_reach'    // رسیدن به هدف — حتی یک تصادف = شکست (ماشین لَخت!)
  | 'tolerant_reach'   // بدون تایمر — حداکثر N تصادف شدید مجاز
  | 'pothole_run'      // مأموریت چاله‌ها — حداکثر N چاله + تایمر
  // ---------- فاز ۵: حالت‌های جدید منو ----------
  | 'parallel_park'    // پارک دوبل — دنده‌عقب داخل جای پارک + تراز + توقف
  | 'taxi_fare'        // مسافرکشی — توقف در سوارشدن، سپس رسیدن به مقصد
  | 'checkpoint_run'   // چالش چک‌پوینت — عبور از همه نقاط به‌ترتیب
  | 'coin_rush';       // چالش سکه — جمع‌آوری N سکه قبل از پایان وقت

export type MissionFailReason =
  | 'time_up' | 'engine_died' | 'too_many_crashes' | 'too_many_potholes'
  // ---------- فاز ۵ ----------
  | 'park_missed'; // وقت پارک تمام شد / خیلی بد پارک کردی

/** دسته مأموریت — برای منوهای جدا (فاز ۵) */
export type MissionCategory = 'story' | 'park' | 'taxi' | 'challenge';

export interface MissionDef {
  /** شناسه پایدار برای ذخیره (completedMissions) */
  id: string;
  title: string;
  /** توضیح بامزه کارت منو */
  intro: string;
  /** هدف کوتاه HUD */
  objective: string;
  kind: MissionKind;
  /** دسته منو — پیش‌فرض story (مأموریت‌های اصلی) */
  category?: MissionCategory;
  /** نقطه هدف — همیشه روی جاده (قابل رسیدن). برای taxi_fare = مقصد پیاده شدن */
  target: { x: number; y: number };
  /** فقط taxi_fare: نقطه سوار شدن مسافر */
  pickup?: { x: number; y: number };
  /** فقط parallel_park: زاویه جای پارک (0 = جاده عمودی، ±π/2 = افقی) */
  spotAngle?: number;
  /** فقط parallel_park: طول جای پارک (px) */
  spotLen?: number;
  /** فقط checkpoint_run: نقاط عبور به‌ترتیب */
  checkpoints?: Array<{ x: number; y: number }>;
  /** فقط coin_rush: تعداد سکه لازم */
  coinTarget?: number;
  /** 0 = بدون تایمر */
  timeLimitSec: number;
  /** حداکثر تصادف شدید مجاز (فقط tolerant_reach) */
  maxHardCrashes?: number;
  /** حداکثر چاله مجاز (فقط pothole_run) */
  maxPotholes?: number;
  /** جایزه سکه (سند: ۲۰ تا ۱۰۰) */
  rewardCoins: number;
  /** جایزه آبرو (سند: +۸ تا +۱۵) */
  rewardRep: number;
  // ---------- فاز ۷: زنجیره داستانی ----------
  /** فقط زنجیره: این مأموریت تا مأموریت با این id تمام نشود، قفل است (undefined = آزاد) */
  requires?: string;
  /** برچسب زنجیره داستانی (نمایش بج در منو) — مثلاً 'naghi' */
  chain?: string;
}

/*
 * مختصات روی شبکه جاده (roadCenter(k) = k*1400 + 280):
 *  مراکز جاده‌ها: 280 / 1680 / 3080 / 4480 / 5880 / 7280 / 8680
 *  وسط سگمنت‌ها:  980 / 2380 / 3780 / 5180 / 6580 / 7630
 *  لاین کنار جدول برای پارک: مرکز جاده ± 310 (نیمه عرض جاده 280 + 30)
 *  دوبله‌پارکی‌های موجود جاده ۱ عمودی:
 *    ضلع شرقی (x=1990): y = 1150 / 2550 / 3950 / 5350 / 6750 / 7800  (هر سگمنت)
 *    ضلع غربی (x=1370): فقط سگمنت‌های فرد (y = 2230 / 5030 / 7480)
 *  → جدول غربی سگمنت‌های زوج (y ≈ 3780 و 6580) کاملاً خالی است = جای پارک ایده‌آل
 *  اسپاون بازیکن: (1750, 6630) رو به شمال
 */
export const MISSION_LIST: MissionDef[] = [
  // ================= مأموریت‌های اصلی (سند طراحی) =================
  {
    id: 'm01_passenger',
    title: 'مسافر عجول',
    intro: 'خانم همسایه سرِحرصه! نون‌داغ داره سرد می‌شه، برسونش به مقصد!',
    objective: 'برس به علامت هدف، قبل از اینکه وقت تموم شه',
    kind: 'timed_reach',
    target: { x: 3080, y: 1680 },
    timeLimitSec: 75,
    rewardCoins: 40,
    rewardRep: 10,
  },
  {
    id: 'm02_smoking_car',
    title: 'ماشین دودکن',
    intro: 'ماشین دود می‌کنه مثل قلیون! فقط نذار خاموش شه...',
    objective: 'برس به تعمیرگاه — حتی یک تصادف یعنی خاموشی!',
    kind: 'fragile_reach',
    target: { x: 3250, y: 3780 },
    timeLimitSec: 65,
    rewardCoins: 60,
    rewardRep: 12,
  },
  {
    id: 'm03_refuel',
    title: 'سوخت‌گیری در ترافیک',
    intro: 'باک خالی، اعصاب خالی‌تر! تا پمپ بنزین فقط مواظب ماشین‌ها باش.',
    objective: 'برس به پمپ بنزین — حداکثر ۲ تصادف شدید مجازه',
    kind: 'tolerant_reach',
    target: { x: 5180, y: 4480 },
    timeLimitSec: 0,
    maxHardCrashes: 2,
    rewardCoins: 35,
    rewardRep: 8,
  },
  {
    id: 'm04_potholes',
    title: 'فرار از چاله‌ها',
    intro: 'شهردار قول داده چاله‌ها رو پُر کنه... سال بعد! مواظب باش.',
    objective: 'برس به مقصد — حداکثر ۳ چاله به گند بکشی!',
    kind: 'pothole_run',
    target: { x: 4480, y: 280 },
    timeLimitSec: 100,
    maxPotholes: 3,
    rewardCoins: 50,
    rewardRep: 10,
  },

  // ================= پارک دوبل (فاز ۵) =================
  {
    id: 'p01_park_valiasr',
    title: 'پارک دوبل ولیعصر',
    intro: 'یه جای خالی بین دو پراید! دنده‌عقب بیا، یه ذره هم تراز پارک کن.',
    objective: 'دنده‌عقب برو تو جای پارک، تراز وایسا، ترمز!',
    kind: 'parallel_park',
    category: 'park',
    target: { x: 1370, y: 3780 },
    spotAngle: 0,
    spotLen: 280,
    timeLimitSec: 90,
    rewardCoins: 45,
    rewardRep: 9,
  },
  {
    id: 'p02_park_enghelab',
    title: 'پارک کنار پیاده‌رو جنوبی',
    intro: 'آنتن فروشه می‌گه اینجا جای پارکه! الان باید ثابتش کنی.',
    objective: 'پارک دوبل کنار جدول — بدون بوق‌وار شدن ملت!',
    kind: 'parallel_park',
    category: 'park',
    target: { x: 1370, y: 6580 },
    spotAngle: 0,
    spotLen: 280,
    timeLimitSec: 75,
    rewardCoins: 55,
    rewardRep: 10,
  },

  // ================= مسافرکشی (فاز ۵) =================
  {
    id: 't01_taxi_short',
    title: 'مسافر تا پمپ بنزین',
    intro: 'آقا مسافر جلو در ایستاده! ببرش تا پمپ بنزین، کرایه رو نگیر از دستت.',
    objective: 'وایسا سر جای سوارشدن، بعد ببر به مقصد — انعام یادت نره!',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 1750, y: 5180 },
    target: { x: 5180, y: 4480 },
    timeLimitSec: 110,
    rewardCoins: 55,
    rewardRep: 10,
  },
  {
    id: 't02_taxi_market',
    title: 'مسافر تا بازار',
    intro: 'یه خانمی می‌خواد بره بازار، دمِ ساعت عروسیه... تصور کن!',
    objective: 'سوارش کن، ببر بازار — تصادف یعنی جریمه وقت!',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 3080, y: 3080 },
    target: { x: 280, y: 5180 },
    timeLimitSec: 120,
    rewardCoins: 65,
    rewardRep: 12,
  },

  // ================= چالش‌ها (فاز ۵) =================
  {
    id: 'c01_tehran_loop',
    title: 'چالش: دور تهران',
    intro: 'چهار گوشه شهر رو بگرد، قبل از اینکه چای‌مون سرد شه!',
    objective: 'از همه چک‌پوینت‌ها به‌ترتیب رد شو!',
    kind: 'checkpoint_run',
    category: 'challenge',
    target: { x: 1680, y: 1680 },
    checkpoints: [
      { x: 1680, y: 1680 },
      { x: 4480, y: 1680 },
      { x: 4480, y: 4480 },
      { x: 1680, y: 4480 },
    ],
    timeLimitSec: 150,
    rewardCoins: 70,
    rewardRep: 12,
  },
  {
    id: 'c02_azadi_flawless',
    title: 'چالش: بدون خط و خش',
    intro: 'ماشین تازه شسته‌شده! یه ذره گرد و خاک یعنی از اول.',
    objective: 'برس آزادی — حتی یک تصادف یعنی شکست!',
    kind: 'fragile_reach',
    category: 'challenge',
    target: { x: 280, y: 5180 },
    timeLimitSec: 80,
    rewardCoins: 65,
    rewardRep: 12,
  },
  {
    id: 'c03_coin_rush',
    title: 'چالش: شکار سکه',
    intro: 'پارکینگ پول شمار گفت ۸ سکه لازم دارم. وقت داری، نه بهونه!',
    objective: '۸ سکه جمع کن قبل از پایان وقت!',
    kind: 'coin_rush',
    category: 'challenge',
    target: { x: 1750, y: 6630 },
    coinTarget: 8,
    timeLimitSec: 85,
    rewardCoins: 55,
    rewardRep: 10,
  },

  // ================= زنجیره داستانی «شاگرد عمو نقی» (فاز ۷) =================
  // قاعده: هر مرحله با تمام‌شدن مرحله قبل باز می‌شود (requires)
  {
    id: 'nq01_first_fare',
    title: 'شاگردی ۱: اولین سفارش',
    intro: 'عمو نقی گفته «برو مسافر بگیر تا بنزری جور شه!» مسافر اول، افتخار اول!',
    objective: 'سوارش کن، برسون — زود برسی انعام هم داره!',
    kind: 'taxi_fare',
    category: 'story',
    chain: 'naghi',
    pickup: { x: 3080, y: 2380 },
    target: { x: 5180, y: 4480 },
    timeLimitSec: 110,
    rewardCoins: 55,
    rewardRep: 10,
  },
  {
    id: 'nq02_park_garage',
    title: 'شاگردی ۲: پارک جلوی گاراژ',
    intro: 'جلوی گاراژ عمو نقی جا تنگه! دنده‌عقب برو، آبرومند بیا بیرون!',
    objective: 'دنده‌عقب برو تو جای خالی، تراز وایسا، ترمز!',
    kind: 'parallel_park',
    category: 'story',
    chain: 'naghi',
    requires: 'nq01_first_fare',
    target: { x: 1370, y: 980 },
    spotAngle: 0,
    spotLen: 280,
    timeLimitSec: 90,
    rewardCoins: 50,
    rewardRep: 10,
  },
  {
    id: 'nq03_ash_delivery',
    title: 'شاگردی ۳: آش مامان‌بزرگ',
    intro: 'کوزه آش مامان‌بزرگ دم صندلیه! یه تصادف یعنی آش روی سقف ماشین!',
    objective: 'برس به مقصد — بدون حتی یک تصادف!',
    kind: 'fragile_reach',
    category: 'story',
    chain: 'naghi',
    requires: 'nq02_park_garage',
    target: { x: 5880, y: 1680 },
    timeLimitSec: 85,
    rewardCoins: 60,
    rewardRep: 12,
  },
  {
    id: 'nq04_parts_round',
    title: 'شاگردی ۴: قطعه‌های گم‌شده',
    intro: 'قطعه‌ی پژوی مشتری سه‌جا گم شده! بگرد پیدا کن قبل از اینکه مشتری قهر کنه!',
    objective: 'از هر ۳ چک‌پوینت به‌ترتیب رد شو!',
    kind: 'checkpoint_run',
    category: 'story',
    chain: 'naghi',
    requires: 'nq03_ash_delivery',
    target: { x: 5880, y: 4480 },
    checkpoints: [
      { x: 3080, y: 7280 },
      { x: 5880, y: 7280 },
      { x: 5880, y: 4480 },
    ],
    timeLimitSec: 150,
    rewardCoins: 70,
    rewardRep: 12,
  },
  {
    id: 'nq05_finale_race',
    title: 'شاگردی ۵: آخر خط!',
    intro: 'عمو نقی شرط بسته پژو سفید زودتر می‌رسه! ثابت کن پراید هم می‌تونه!',
    objective: 'برس گوشه شمال‌شرقی شهر قبل از اتمام وقت!',
    kind: 'timed_reach',
    category: 'story',
    chain: 'naghi',
    requires: 'nq04_parts_round',
    target: { x: 8680, y: 280 },
    timeLimitSec: 120,
    rewardCoins: 100,
    rewardRep: 15,
  },
];
