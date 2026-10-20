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

/** دسته مأموریت — برای منوهای جدا (فاز ۵) + بی‌پایان (v0.2.40) */
export type MissionCategory = 'story' | 'park' | 'taxi' | 'challenge' | 'endless';

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

  // ================= مسیرهای بیشتر و درجه سختی (فاز ۸) =================
  {
    id: 'p03_park_tight',
    title: 'پارک دوبل: جای تنگ بازار',
    intro: 'دو طرفت ماشین گرونه؛ یه خط بندازی، عمو نقی از حقوقت کم می‌کنه!',
    objective: 'در جای باریک پارک کن و حداقل ۲ ثانیه کامل توقف کن',
    kind: 'parallel_park',
    category: 'park',
    target: { x: 1990, y: 1150 },
    spotAngle: 0,
    spotLen: 250,
    timeLimitSec: 65,
    rewardCoins: 70,
    rewardRep: 12,
  },
  {
    id: 'p04_park_rush',
    title: 'پارک دوبل: مشتری عجول',
    intro: 'مسافر می‌گه پنج ثانیه‌ای پارک کن؛ انگار ماشین کنترل از راه دوره!',
    objective: 'قبل از تمام شدن وقت، صاف و کامل پارک کن',
    kind: 'parallel_park',
    category: 'park',
    target: { x: 1990, y: 3950 },
    spotAngle: 0,
    spotLen: 250,
    timeLimitSec: 55,
    rewardCoins: 80,
    rewardRep: 14,
  },
  {
    id: 't03_taxi_airport',
    title: 'مسافر تا ترمینال دوردست',
    intro: 'مسافر چمدونش از خودش سنگین‌تره؛ سالم و به‌موقع برسونش!',
    objective: 'اول کامل توقف کن تا مسافر سوار شود، بعد به مقصد برس',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 4480, y: 3080 },
    target: { x: 7280, y: 5180 },
    timeLimitSec: 105,
    rewardCoins: 75,
    rewardRep: 13,
  },
  {
    id: 't04_taxi_fragile',
    title: 'مسافر با چای داغ',
    intro: 'سه تا چای روی داشبورده؛ ترمز ناگهانی و تصادف، انعام رو می‌پرونه!',
    objective: 'مسافر را سوار کن و بدون تصادف شدید به مقصد برسان',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 5880, y: 3080 },
    target: { x: 3080, y: 5180 },
    timeLimitSec: 95,
    rewardCoins: 85,
    rewardRep: 14,
  },
  {
    id: 't05_taxi_long',
    title: 'مسافرکشی شبانه',
    intro: 'کرایه خوبه، مسیر دوره؛ پات رو از گاز برداری مسافر خوابش می‌بره!',
    objective: 'مسافر را از شمال شهر به جنوب برسان و وقت را مدیریت کن',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 5880, y: 1680 },
    target: { x: 1680, y: 7280 },
    timeLimitSec: 145,
    rewardCoins: 100,
    rewardRep: 16,
  },
  {
    id: 'c04_checkpoint_sprint',
    title: 'چالش: اسپرینت چهارراه‌ها',
    intro: 'چراغ سبز رو دیدی؟ این بار واقعاً حرکت کن، نه اینکه بوق بزنی!',
    objective: 'از ۵ چک‌پوینت به‌ترتیب عبور کن؛ هر ثانیه مهمه',
    kind: 'checkpoint_run',
    category: 'challenge',
    target: { x: 5880, y: 4480 },
    checkpoints: [
      { x: 3080, y: 4480 },
      { x: 4480, y: 4480 },
      { x: 4480, y: 5880 },
      { x: 5880, y: 5880 },
      { x: 5880, y: 4480 },
    ],
    timeLimitSec: 95,
    rewardCoins: 90,
    rewardRep: 15,
  },
  {
    id: 'c05_coin_mania',
    title: 'چالش: دیوونه‌بازی سکه‌ای',
    intro: 'عمو نقی گفته ۱۲ سکه جمع کن؛ حسابدارش از خود ماشین ترسناک‌تره!',
    objective: '۱۲ سکه جمع کن؛ وقت کم و مسیر شلوغ است',
    kind: 'coin_rush',
    category: 'challenge',
    target: { x: 1750, y: 6630 },
    coinTarget: 12,
    timeLimitSec: 65,
    rewardCoins: 95,
    rewardRep: 15,
  },
  {
    id: 'c06_no_crash_delivery',
    title: 'چالش: راننده نمونه',
    intro: 'ماشین امانتیه؛ صاحبش گفته حتی یه بوسه به سپر هم نه!',
    objective: 'به مقصد دور برس؛ یک تصادف هم یعنی شکست',
    kind: 'fragile_reach',
    category: 'challenge',
    target: { x: 8680, y: 5880 },
    timeLimitSec: 105,
    rewardCoins: 110,
    rewardRep: 17,
  },

  // ================= بسته چالش‌های حرفه‌ای (فاز ۹) =================
  {
    id: 'p05_park_night_shift',
    title: 'پارک دوبل: شیفت آخر شب',
    intro: 'چراغ کوچه سو سو می‌زنه و همسایه هم از پنجره قضاوت می‌کنه!',
    objective: 'در جای مشخص دنده‌عقب برو، ماشین را تراز و کامل متوقف کن',
    kind: 'parallel_park',
    category: 'park',
    target: { x: 3080, y: 2380 },
    spotAngle: 0,
    spotLen: 235,
    timeLimitSec: 60,
    rewardCoins: 85,
    rewardRep: 14,
  },
  {
    id: 'p06_park_precision',
    title: 'پارک دوبل: میلی‌متری',
    intro: 'عمو نقی خط‌کش آورده؛ این یکی جای اشتباه نداره!',
    objective: 'در فضای محدود با دقت پارک کن و ترمز بگیر',
    kind: 'parallel_park',
    category: 'park',
    target: { x: 4480, y: 3080 },
    spotAngle: 0,
    spotLen: 220,
    timeLimitSec: 52,
    rewardCoins: 100,
    rewardRep: 16,
  },
  {
    id: 't06_taxi_vip',
    title: 'مسافر ویژه و حساس',
    intro: 'مسافر می‌گه ماشین رو نشور، فقط با دستمال ابریشمی لمس کن!',
    objective: 'مسافر را سوار کن و با رانندگی نرم به مقصد برسان',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 1680, y: 3080 },
    target: { x: 5880, y: 4480 },
    timeLimitSec: 115,
    rewardCoins: 95,
    rewardRep: 16,
  },
  {
    id: 't07_taxi_school_run',
    title: 'سرویس مدرسه',
    intro: 'زنگ خورده؛ ولی بچه‌ها هنوز دنبال کفش دوم‌شون می‌گردن!',
    objective: 'سرویس را از نقطه سوارشدن تا مدرسه به‌موقع برسان',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 3080, y: 5880 },
    target: { x: 7280, y: 3080 },
    timeLimitSec: 125,
    rewardCoins: 90,
    rewardRep: 15,
  },
  {
    id: 't08_taxi_cross_city',
    title: 'کرایه آن‌طرف شهر',
    intro: 'مسافر گفته مسیر کوتاه بلدی؟ حالا ثابت کن بلد هستی!',
    objective: 'مسافر را از جنوب شهر به مقصد شمالی برسان',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 280, y: 5880 },
    target: { x: 7280, y: 1680 },
    timeLimitSec: 155,
    rewardCoins: 120,
    rewardRep: 18,
  },
  {
    id: 'c07_pothole_expert',
    title: 'چالش: استاد چاله‌گریز',
    intro: 'شهرداری گفته چاله نیست؛ پس اینا گودال‌های تزئینی‌ان!',
    objective: 'به مقصد برس و حداکثر از ۲ چاله عبور کن',
    kind: 'pothole_run',
    category: 'challenge',
    target: { x: 5880, y: 7280 },
    timeLimitSec: 115,
    maxPotholes: 2,
    rewardCoins: 95,
    rewardRep: 16,
  },
  {
    id: 'c08_checkpoint_marathon',
    title: 'چالش: ماراتن چهارراه‌ها',
    intro: 'چهارراه‌ها تموم نمی‌شن؛ فقط بنزین و صبر راننده تموم می‌شه!',
    objective: 'از ۶ چک‌پوینت به‌ترتیب عبور کن',
    kind: 'checkpoint_run',
    category: 'challenge',
    target: { x: 8680, y: 5880 },
    checkpoints: [
      { x: 1680, y: 5880 },
      { x: 3080, y: 4480 },
      { x: 4480, y: 5880 },
      { x: 5880, y: 7280 },
      { x: 7280, y: 5880 },
      { x: 8680, y: 5880 },
    ],
    timeLimitSec: 135,
    rewardCoins: 125,
    rewardRep: 18,
  },
  {
    id: 'c09_coin_hunt_hard',
    title: 'چالش: حسابدار عمو نقی',
    intro: 'این بار ۱۵ سکه می‌خواد؛ ماشین‌حسابش از بوق ماشین بلندتره!',
    objective: '۱۵ سکه را قبل از تمام شدن زمان جمع کن',
    kind: 'coin_rush',
    category: 'challenge',
    target: { x: 5880, y: 1680 },
    coinTarget: 15,
    timeLimitSec: 75,
    rewardCoins: 120,
    rewardRep: 18,
  },
  {
    id: 'c10_fragile_cargo',
    title: 'چالش: بار شکستنی',
    intro: 'پشت ماشین یک آینه عتیقه‌ست؛ حتی دست‌انداز هم با اجازه!',
    objective: 'بار شکستنی را بدون تصادف به مقصد دور برسان',
    kind: 'fragile_reach',
    category: 'challenge',
    target: { x: 8680, y: 3080 },
    timeLimitSec: 125,
    rewardCoins: 130,
    rewardRep: 20,
  },
  {
    id: 'c11_speed_delivery',
    title: 'چالش: تحویل دقیقه نودی',
    intro: 'مشتری نوشته «همین الان»؛ ظاهراً ساعت برایش معنی نداره!',
    objective: 'قبل از پایان زمان به مقصد برس؛ مراقب ترافیک باش',
    kind: 'timed_reach',
    category: 'challenge',
    target: { x: 7280, y: 7280 },
    timeLimitSec: 100,
    rewardCoins: 110,
    rewardRep: 17,
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
  // ================= مأموریت‌های تکمیلی (v0.2.39) =================

  {
    id: 't09_taxi_terminal',
    title: 'مسافر تا ترمینال جنوب',
    intro: 'چمدونش از تو بزرگه! دیر برسه اتوبوس می‌ره، گریه‌ش تو گرفتته!',
    objective: 'سوارش کن، برسون ترمینال — تصادف یعنی جریمه وقت!',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 5880, y: 2380 },
    target: { x: 280, y: 8680 },
    timeLimitSec: 135,
    rewardCoins: 75,
    rewardRep: 12,
  },

  {
    id: 't10_taxi_doctor',
    title: 'پزشک شیفت شب',
    intro: 'خانم دکتر شیفتشه شروع شده! بیمارستان منتظره، زنده زنده برسون!',
    objective: 'سوارش کن، ببر بیمارستان — انعام شیفت شب حلاله!',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 1680, y: 6580 },
    target: { x: 5880, y: 7280 },
    timeLimitSec: 110,
    rewardCoins: 70,
    rewardRep: 12,
  },

  {
    id: 't11_taxi_engineer',
    title: 'مهندس دیرکردی',
    intro: 'آقای مهندس سر کارش دیر کرده! می‌گه «آقا ترمز نزن، فقط نکش!»',
    objective: 'سوارش کن، ببر سمت پل — دیرتر از این‌ها نکن!',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 5180, y: 5880 },
    target: { x: 7280, y: 2380 },
    timeLimitSec: 100,
    rewardCoins: 65,
    rewardRep: 10,
  },

  {
    id: 't12_taxi_student',
    title: 'دانشجوی کلاس اول',
    intro: 'دانشجو می‌گه «استاد غیبت می‌زنه!» ببرش دانشگاه، نون‌وپنیرش هم جا نمونه!',
    objective: 'سوارش کن، برسون دانشگاه — سر کلاس برسه!',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 4480, y: 980 },
    target: { x: 1680, y: 3780 },
    timeLimitSec: 105,
    rewardCoins: 60,
    rewardRep: 10,
  },

  {
    id: 't13_taxi_bride',
    title: 'عروس دیرکردی!',
    intro: 'عروس توی ماشینت داره دیوار می‌زنه! سالن رفتنت که دید، آبروت با توئه!',
    objective: 'سوارش کن، ببر سالن — تصادف یعنی ته‌تاک نیست!',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 280, y: 2380 },
    target: { x: 8680, y: 5880 },
    timeLimitSec: 150,
    rewardCoins: 90,
    rewardRep: 14,
  },

  {
    id: 't14_taxi_grandma',
    title: 'مادربزرگ و سبزی‌ها',
    intro: 'مادربزرگ سبزی‌خریده و خسته‌ست! آروم برسون؛ نه پیچ، نه ترمز ناگهانی!',
    objective: 'سوارش کن، آروم ببر خونه — سبزی‌ها نباید بریزه!',
    kind: 'taxi_fare',
    category: 'taxi',
    pickup: { x: 7280, y: 4480 },
    target: { x: 3080, y: 6580 },
    timeLimitSec: 130,
    rewardCoins: 70,
    rewardRep: 12,
  },

  {
    id: 'c12_rush_hour',
    title: 'چالش: ساعت پیک',
    intro: 'همه شهر پشت فرمونن! از اون سر تا اون سر، قبل از اینکه چای صبحانه سرده!',
    objective: 'برس سمت شمال‌غرب — ترافیک حواست باشه!',
    kind: 'timed_reach',
    category: 'challenge',
    target: { x: 280, y: 8680 },
    timeLimitSec: 100,
    rewardCoins: 80,
    rewardRep: 12,
  },

  {
    id: 'c13_coin_hunt_12',
    title: 'چالش: سکه‌کاوی',
    intro: '۱۲ سکه پخش زمین! عمو نقی می‌گه «این دفعه شمارش یادت نره!»',
    objective: '۱۲ سکه جمع کن قبل از پایان وقت!',
    kind: 'coin_rush',
    category: 'challenge',
    target: { x: 1750, y: 6630 },
    coinTarget: 12,
    timeLimitSec: 110,
    rewardCoins: 70,
    rewardRep: 12,
  },

  {
    id: 'c14_north_south_flawless',
    title: 'چالش: شمال تا جنوب بی‌خش',
    intro: 'از بالای شهر تا پایینش، بدون حتی یک خش! ماشین تازه واکس خورده!',
    objective: 'برس ته جنوب — حتی یک تصادف یعنی شکست!',
    kind: 'fragile_reach',
    category: 'challenge',
    target: { x: 5880, y: 8680 },
    timeLimitSec: 130,
    rewardCoins: 85,
    rewardRep: 14,
  },

  {
    id: 'c15_five_checkpoints',
    title: 'چالش: پنج‌گانه شهر',
    intro: 'پنج ایستگاه، یه دور کامل! نقشه رو بلد باش، وگرنه عمو نقی می‌خنده!',
    objective: 'از هر ۵ چک‌پوینت به‌ترتیب رد شو!',
    kind: 'checkpoint_run',
    category: 'challenge',
    target: { x: 4480, y: 4480 },
    checkpoints: [
      { x: 1680, y: 1680 },
      { x: 5880, y: 1680 },
      { x: 5880, y: 7280 },
      { x: 1680, y: 7280 },
      { x: 4480, y: 4480 },
    ],
    timeLimitSec: 180,
    rewardCoins: 90,
    rewardRep: 14,
  },

  {
    id: 'c16_pothole_strict',
    title: 'چالش: چاله ممنوع!',
    intro: 'شهردار همین امروز آسفالت نو ریخته! یک چاله هم بری، جریمه‌ای!',
    objective: 'برس مقصد — حداکثر ۱ چاله به گند بکشی!',
    kind: 'pothole_run',
    category: 'challenge',
    target: { x: 3080, y: 7280 },
    timeLimitSec: 110,
    maxPotholes: 1,
    rewardCoins: 75,
    rewardRep: 12,
  },

  {
    id: 'c17_one_hit_wonder',
    title: 'چالش: تک‌تصادفی',
    intro: 'یه تصادف حق داری، بیشتر نه! بقیه‌ش با آبروی خودت!',
    objective: 'برس مقصد — حداکثر ۱ تصادف شدید مجازه!',
    kind: 'tolerant_reach',
    category: 'challenge',
    target: { x: 7280, y: 5880 },
    timeLimitSec: 0,
    maxHardCrashes: 1,
    rewardCoins: 70,
    rewardRep: 12,
  },

  {
    id: 'c18_coin_master',
    title: 'چالش: استاد سکه',
    intro: 'رکورد شهر ۱۵ سکه‌ست! نشون بده پادشاه خیابونی کیه!',
    objective: '۱۵ سکه جمع کن — رکورد بزن!',
    kind: 'coin_rush',
    category: 'challenge',
    target: { x: 1750, y: 6630 },
    coinTarget: 15,
    timeLimitSec: 130,
    rewardCoins: 95,
    rewardRep: 15,
  },

  {
    id: 'c19_east_loop',
    title: 'چالش: دور شرق شهر',
    intro: 'شرقی‌بازها این طرفا رو مثل کف دستشون می‌شناسن! تو هم نشون بده!',
    objective: 'از هر ۴ چک‌پوینت شرق شهر رد شو!',
    kind: 'checkpoint_run',
    category: 'challenge',
    target: { x: 8680, y: 1680 },
    checkpoints: [
      { x: 8680, y: 1680 },
      { x: 7280, y: 4480 },
      { x: 8680, y: 7280 },
      { x: 5880, y: 5880 },
    ],
    timeLimitSec: 160,
    rewardCoins: 85,
    rewardRep: 13,
  },

];
