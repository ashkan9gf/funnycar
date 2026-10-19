/**
 * balance.ts — همه اعداد قابل تنظیم بازی (Data-Driven)
 * ============================================================
 * ⭐ هیچ عدد گیم‌پلی نباید داخل منطق Hard-Code شود؛ اینجا تنظیم می‌شود
 * تا تست و بالانس بدون ریسک شکستن کد انجام شود.
 * (قانون بخش ۱۹ و ۲۴ سند مادر: سیستم‌ها قابل تنظیم باشند)
 */

/** فیزیک خودرو (واحد: پیکسل و ثانیه — رزولوشن منطقی بازی) */
export const VEHICLE_PHYSICS = {
  maxSpeed: 380,        // بیشترین سرعت جلو (px/s)
  maxReverse: 120,      // دنده عقب
  accel: 300,           // شتاب گاز
  brake: 560,           // قدرت ترمز
  engineBrake: 90,      // اصطکاک موتور وقتی گاز رهاست
  reverseAccel: 150,
  /** ضریب چرخش: هرچه بیشتر = فرمان تیزتر */
  steerStrength: 2.6,
  /** کمترین سرعت نسبی برای اینکه فرمان اثر کند (واقع‌گرایی آرکید) */
  minSteerSpeedRatio: 0.06,
  wheelBase: 64,
} as const;

/** درفت ملایم (فاز 2) — سرخوردن جانبی در فرمان تندِ سرعت بالا */
export const DRIFT = {
  /** ضریب تبدیل فرمان+سرعت به سرعت جانبی */
  slipGain: 2.2,
  /** نسبت سرعت شروع درفت محسوس */
  minSpeedRatio: 0.45,
  /** چسبندگی لاستیک: میرایی سرعت جانبی (بزرگ‌تر = سریع‌تر برمی‌گردد) */
  gripDecay: 3.2,
  /** سقف سرعت جانبی (px/s) */
  maxLateral: 130,
  /** آستانه سرعت جانبی برای «در حال درفت» (صدای سایش + رد لاستیک) */
  skidThreshold: 55,
  /** فاصله صدای سایش (ثانیه) */
  skidSoundInterval: 0.28,
} as const;

/** ترافیک (فاز 2 + دوطرفه فاز BIG-IR) — خودروهای AI روی لاین درست */
export const TRAFFIC = {
  /** تعداد خودروی ترافیک فعال — نقشه بزرگ، دوطرفه */
  count: 16,
  /** سرعت کروز (px/s) و محدوده تفاوت بین ماشین‌ها */
  cruiseSpeed: 150,
  cruiseJitter: 40,
  accel: 170,
  brakePower: 360,
  /** فاصله امن پشت مانع جلویی (px) */
  safeGap: 100,
  /** برد دید جلو برای ترمز (px) */
  lookAhead: 190,
  /** احتمال ادامه مسیر مستقیم در تقاطع (بقیه: نصف راست/نصف چپ) */
  straightChance: 0.55,
  /** وقتی جلوی‌شان بسته شد، بعد از این مدت بوق می‌زنند (ثانیه) */
  honkAfterBlockedSec: 2.5,
  /** برد واکنش به بوق بازیکن (px) */
  honkReactionRadius: 340,
  /** احتمال بوق جواب دادن */
  honkBackChance: 0.45,
  /** پس از برخورد با بازیکن، چند ثانیه مکث می‌کنند */
  stunnedSec: 2.2,
  // ---------- پرتاب برخوردی (فاز APK-FIX) ----------
  /** سرعت پایه پرتاب ماشین ترافیک هنگام ضربه (px/s) */
  knockBase: 60,
  /** ضریب شدت ضربه → سرعت پرتاب (هرچه محکم‌تر بزنی، دورتر پرت می‌شود) */
  knockScale: 2.1,
  /** سقف سرعت پرتاب (px/s) */
  knockMax: 620,
  /** میرایی نمایی پرتاب (1/s) — ماشینک کم‌کم می‌ایستد */
  knockDecay: 2.6,
  /** چرخش تصادفی بدنه بر اثر ضربه محکم (rad/s بر px/s ضربه) */
  spinScale: 0.0022,
  /** ابعاد رسم ترافیک (نسبت 4:7 مثل بازیکن) */
  drawW: 104,
  /** آستانه عرضی دید جلو — فقط هم‌لاین‌ها ترمز می‌کنند (لاین‌ها ۱۲۰px فاصله) */
  laneWidth: 110,
} as const;

/**
 * آسیب خودرو (فاز BIG-IR) — برخورد با موانع بزرگ ماشین را خراب می‌کند
 * سلامت 100..0؛ زیر آستانه‌ها دود، صفر = خاموشی (اسکران به تعمیرگاه)
 */
export const DAMAGE = {
  maxHealth: 100,
  /** آسیب برخورد با موانع ثابت: base + impact × scale (سقف max) */
  worldHitBase: 3,
  worldHitScale: 0.05,
  worldHitMax: 26,
  /** آسیب برخورد با خودروی ترافیک */
  trafficHitBase: 2,
  trafficHitScale: 0.04,
  trafficHitMax: 16,
  /** زیر این سلامتی دود می‌کند */
  smokeBelow: 45,
  heavySmokeBelow: 20,
  /** حداکثر افت سرعت در بدترین وضعیت */
  maxSpeedPenalty: 0.35,
  /** شعاع زون تعمیرگاه + نرخ ترمیم (سلامت/ثانیه) */
  repairRadius: 150,
  repairRate: 30,
  /** هزینه اسکران وقتی ماشین خاموش شد (سکه) */
  towCost: 30,
  /** آسیب تجمعی جلو برای جدا شدن سپر */
  bumperBreakDamage: 30,
} as const;

/** شکستنی‌ها (فاز BIG-IR) — مانع‌های کوچک با سرعت می‌شکنند */
export const BREAKABLE = {
  /** کمترین سرعت برای شکستن */
  breakSpeed: 70,
  /** بعد از چند ثانیه دوباره ظاهر شوند */
  respawnSec: 40,
  /** احتمال افتادن سکه از وسط شکسته‌شده */
  coinChance: 0.35,
  /** افت جزئی سرعت ماشین هنگام شکستن */
  speedLoss: 0.965,
  /** سردشدن بین دو شکستن (ثانیه) */
  breakCooldownSec: 0.25,
} as const;

/** عابرهای پیاده (فاز BIG-IR) — زندگی خیابان سبک GTA */
export const PEDESTRIANS = {
  count: 20,
  walkSpeed: 46,
  /** شعاع ترس از ماشین */
  scareRadius: 100,
  /** کمترین سرعت ماشین برای ترساندن */
  scareSpeed: 110,
  /** احتمال حباب طنز موقع ترسیدن */
  bubbleChance: 0.45,
  /** سردشدن ترس هر عابر (ثانیه) */
  scareCooldownSec: 8,
  /** پرش ترس (ارتفاع px و مدت) */
  hopHeight: 26,
  hopSec: 0.5,
  // ---------- برخورد واقعی با ماشین (فاز SMASH) ----------
  /** کمترین سرعت برای به‌هوا پرتاب شدن عابر */
  hitMinSpeed: 70,
  /** مدت پرواز + چرخش در هوا (ثانیه) */
  knockSec: 0.55,
  /** مدت افتادن روی زمین (ثانیه) */
  downSec: 1.7,
  /** مدت بلند شدن (ثانیه) */
  riseSec: 0.45,
  /** ارتفاع پرتاب */
  knockHeight: 46,
  /** افت سرعت ماشین بعد از ضربه به عابر */
  speedLoss: 0.9,
} as const;

/** خودروهای پارک‌شده — برخورد فیزیکی (فاز SMASH) */
export const PARKED_HIT = {
  /** شعاع تقریبی برخورد هر مدل (px) — قدیمی (فقط fallback) */
  radius: { pride: 86, peugeot405: 98, tiba: 82, nissan: 98, samand: 100, renault4: 88, vintage: 98 } as Record<string, number>,
  /**
   * فاز HITBOX-EXACT: جعبه برخورد دقیق هر مدل پارکی [نصف‌عرض (X)، نصف‌طول (Y)]
   * برخورد OBB دقیق — «نچسبیدن به ماشین» دیگر تصادف حساب نمی‌شود!
   * ابعاد از خود مدل‌ها: پژو len196، سمند len206، رنو۴ len176/wid77، قدیمی len197/wid73
   */
  box: {
    peugeot405: { hw: 39, hh: 90 },
    samand: { hw: 39, hh: 95 },
    renault4: { hw: 35, hh: 81 },
    vintage: { hw: 34, hh: 91 },
  } as Record<string, { hw: number; hh: number }>,
  /** سرعت بالای این = ضربه جدی (صدا + آسیب + لرزش) */
  hardSpeed: 230,
  /** کمترین سرعت برای اثرگذاری بر سرعت بازیکن */
  softSpeed: 55,
  /** نگه‌داشت سرعت در ضربه جدی / ساییدن */
  hardKeep: 0.52,
  slideKeep: 0.985,
  /** سردشدن بین دو ضربه (ثانیه) */
  cooldownSec: 0.5,
  /** آسیب ضربه جدی */
  hardDamageBase: 3,
  hardDamageScale: 0.03,
  hardDamageMax: 12,
} as const;

/** رویدادهای تصادفی واقعی (فاز 2) */
export const RANDOM_EVENTS = {
  minIntervalSec: 26,
  maxIntervalSec: 52,
  /** گربه: سرعت عرضی عبور از جاده */
  catSpeed: 85,
  catSize: 34,
  /** مخروط: چند عدد و طول عمر (ثانیه) */
  coneCount: 4,
  coneLifetimeSec: 24,
} as const;

/** مأموریت‌ها (فاز 4) — اعداد فیزیکی/تنظیمی؛ محتوا در data/missions.ts */
export const MISSIONS = {
  /** شعاع رسیدن به هدف (px) */
  reachRadius: 110,
  /** تبدیل پیکسل به متر برای نمایش فاصله */
  pxPerMeter: 6.4,
  /** جریمه زمان هر تصادف شدید در مأموریت timed_reach (ثانیه) */
  hardCrashTimePenalty: 6,
  /** شعاع چاله + ضریب کاهش سرعت هنگام افتادن */
  potholeRadius: 34,
  potholeSlowFactor: 0.72,
  /** تعداد چاله‌های مأموریت pothole_run و حداقل فاصله بین‌شان */
  potholeCount: 8,
  potholeMinGap: 130,
  /** فاصله ایمن چاله از اسپاون/هدف */
  potholeSafeFromSpawn: 260,
  potholeSafeFromTarget: 190,
  /** دود ماشین دودکن: فاصله پف دود (ثانیه) */
  smokeIntervalSec: 0.14,
  /** بونوس آبروی بالا (سند بخش ۷: ضریب ×1.25) */
  bonusRepThreshold: 80,
  bonusFactor: 1.25,
} as const;

/**
 * پارک دوبل (فاز ۵) — سخت‌گیری متعادل: حال تمرین بده، عذاب نده!
 */
export const PARK = {
  /** حداکثر فاصله عرضی مرکز ماشین از مرکز جای پارک (px) */
  lateralTol: 52,
  /** حداکثر فاصله طولی مرکز ماشین از مرکز جای پارک (px) */
  alongTol: 110,
  /** حداکثر انحراف زاویه از راستای جای پارک (رادیان — روی محور، هر دو جهت) */
  angleTol: 0.24,
  /** کمترین سرعت برای «وایسادن» (px/s) */
  stopSpeed: 14,
  /** چند ثانیه باید ثابت بمونی (تأیید پارک) */
  holdSec: 1.3,
  /** فاصله ماشین‌های نگهبان از مرکز جای پارک (نیمه‌جا + نصف ماشین + gap) */
  guardGap: 8,
  /** نصف عرض برخورد ماشین نگهبان (برای collider) */
  guardHitW: 48,
} as const;

/**
 * مسافرکشی (فاز ۵) — تاکسی فانی‌کار
 */
export const TAXI = {
  /** شعاع جای سوار شدن (px) */
  pickupRadius: 135,
  /** کمترین سرعت برای «توقف کامل» (px/s) */
  stopSpeed: 16,
  /** چند ثانیه توقف کافیه (ثانیه) */
  stopHoldSec: 0.55,
  /** اگر بیش از این نسبت وقت باقی بمونه، انعام می‌گیری */
  tipTimeFrac: 0.4,
  /** مقدار انعام (ضریبی از جایزه پایه) */
  tipFactor: 0.25,
} as const;

/**
 * چالش‌ها (فاز ۵) — چک‌پوینت و سکه
 */
export const CHALLENGE = {
  /** شعاع عبور از چک‌پوینت (px) */
  checkpointRadius: 125,
} as const;

/** آستانه‌های برخورد */
export const COLLISION = {
  /** سرعت بالای این = تصادف جدی (لرزش + آبرو) */
  hardCrashSpeed: 260,
  softCrashSpeed: 90,
  /** ضریب نگه‌داشت سرعت هنگام لغزش در امتداد مانع (ساییدن به دیوار) — سازگاری مسیرهای قدیمی */
  wallSlideFactor: 0.6,
  /** ضریب جهش عمودی بعد از برخورد (ادغام از شاخهٔ کاربر) — مقدار کم برای حس آرکیدِ سنگین */
  restitution: 0.12,
  /** جهش اندکی بیشتر در تصادف شدید */
  hardRestitution: 0.19,
  /** حفظ سرعت مماسی هنگام برخورد نرم — دیوار قفل نمی‌شود */
  tangentRetention: 0.91,
  /** اصطکاک بیشتر در برخورد شدید؛ از سر خوردن غیرطبیعی جلوگیری می‌کند */
  hardTangentRetention: 0.78,
} as const;

/** آبرو (Reputation) — طبق GAME_DESIGN بخش ۶ */
export const REPUTATION = {
  start: 50,
  min: 0,
  max: 100,
  softCrashPenalty: 3,
  hardCrashPenalty: 8,
  /** برخورد با خودروی ترافیک — خطای راننده بازیکن فرض می‌شود */
  trafficCrashPenalty: 4,
  /** برخورد با عابر پیاده — آبرو کم می‌شود! */
  pedHitPenalty: 3,
} as const;

/** چراغ راهنمای تقاطع‌ها (فاز GRAPHICS_OVERHAUL) */
export const TRAFFIC_LIGHTS = {
  /** مدت سبز هر محور (ثانیه) */
  greenSec: 7,
  yellowSec: 1.8,
  /** همه‌قرمز بین دو سبز (ثانیه) */
  allRedSec: 0.7,
  /** آفست موج سبز بین تقاطع‌ها (ثانیه) */
  offsetStepSec: 1.7,
  /** فاصله خط توقف از لبه تقاطع (px) */
  stopGap: 60,
  /** زرد: اگر فاصله بیشتر از این باشد توقف، وگرنه عبور (px) */
  yellowCommitDist: 150,
  /** سرعت کمینه برای شمارش «رد شدن با پرت‌قانون» بازیکن (px/s) */
  redRunnerSpeed: 110,
  /** سردشدن دیالوگ چراغ قرمز (ثانیه) */
  redRunnerCooldown: 12,
} as const;

/** لاشه/تکه‌های پرتابی تصادف (فاز GRAPHICS_OVERHAUL) */
export const DEBRIS = {
  /** سقف تکه‌های همزمان */
  maxCount: 90,
  /** عمر لاشه روی زمین (ثانیه) */
  lifeSec: 2.6,
  /** ضریب جهش */
  bounce: 0.38,
  /** اصطکاک روی زمین (ضرب در هر ثانیه) */
  groundFriction: 0.12,
} as const;

/** دوربین */
export const CAMERA = {
  /** نرمی دنبال کردن (0=خشک، 1=خیلی شل) */
  lerp: 5.5,
  /** پیش‌بینی مسیر (نسبت سرعت) */
  lookahead: 0.42,
  shakeDecay: 7,
  maxShake: 14,
} as const;

/** حلقه رویدادهای طنز پس‌زمینه (فاز 1: فقط جملات رادیویی) */
export const IDLE_EVENTS = {
  minIntervalSec: 25,
  maxIntervalSec: 55,
} as const;

/** ذخیره */
export const SAVE = {
  key: 'funnycarir_save',
  backupKey: 'funnycarir_save_backup',
  /** نسخه ۲: فاز ۶ — فیلدهای upgrades/ownedPaints/paint گاراژ اضافه شد */
  /** نسخه ۳: فاز ۷ — فیلدهای ownedHorns/horn فروشگاه بوق اضافه شد */
  version: 3,
} as const;

/** رندر دوبعدی (fallback و مرجع ابعاد منطقی) */
export const RENDER = {
  /** عرض منطقی بازی — همه محاسبات با این است (ارتفاع متغیر با صفحه) */
  logicalWidth: 720,
  maxDevicePixelRatio: 2,
  /** کاشی پایه دنیا */
  tileSize: 256,
} as const;

/**
 * رندر سه‌بعدی (فاز 3D) — دوربین Chase + نور و مه
 * منطق بازی کاملاً دوبعدی می‌ماند؛ فقط نمایش سه‌بعدی Low-Poly است.
 */
export const RENDER3D = {
  /** FOV دوربین (درجه) */
  fov: 58,
  /** فاصله و ارتفاع دوربین پشت ماشین (بر حسب واحد دنیا = پیکسل منطقی) */
  camBack: 380,
  camHeight: 232,
  /** با سرعت، دوربین کمی عقب‌تر می‌رود (ضریب × سرعت) */
  camBackPerSpeed: 0.55,
  /** نرمی پیگرد زاویه (0=خشک، بزرگ‌تر=شل‌تر) */
  camAngleLerp: 3.6,
  /** نرمی پیگرد موقعیت */
  camPosLerp: 6.5,
  /** مه و رنگ آسمان (نقشه بزرگ — دورتر) */
  fogNear: 1000,
  fogFar: 3300,
  skyColor: '#AEDCEB',
  /** نور */
  sunIntensity: 1.42,
  hemiIntensity: 0.92,
  /** سقف رد لاستیک و ذرات در حالت سه‌بعدی (Pool) */
  skidMax: 180,
  particleMax: 140,
  /** ارتفاع ساختمان‌ها بر حسب نوع (بخش بالای footprint دوبعدی) */
  buildingHeights: {
    env_building_home_01: 400,
    env_building_shop_01: 300,
    env_building_garage_01: 235,
    env_building_apartment_01: 560,
  },
  gasStationShopHeight: 210,
  /** مینی‌مپ سبک GTA — اندازه (پیکسل CSS) */
  minimapSize: 112,
  /** سرعت‌گیر (فاز GTA-IR) — ضریب کندی + آستانه سرعت + سردشدن + لرزش دوربین */
  bumpSlowFactor: 0.78,
  bumpMinSpeed: 80,
  bumpCooldownSec: 1.2,
  bumpShake: 7,
} as const;

/**
 * ENDLESS — شهر بی‌پایان (فاز ENDLESS-1)
 * ============================================================
 * شهر در هر جهت ادامه دارد: قطعه‌های ۱۴۰۰×۱۴۰۰ دور بازیکن جاری می‌شوند.
 * بودجه فریمی سخت‌گیرانه:
 *  - هر فریم حداکثر maxChunkBuildsPerFrame قطعه بصری ساخته می‌شود
 *  - و کل زمان ساخت در فریم از buildBudgetMs فراتر نمی‌رود (performance.now)
 *  - داده منطقی (کولایدر/سکه/پارکی) با شعاع بزرگ‌تر و «بدون» بودجه آماده است
 *    (تولیدش ارزان است) تا هرگز ساختمانِ بدون برخورد نداشته باشیم
 *  - برد بصری visualRadius: فراتر از آن مه کامل است (fogFar=3300 → برد ۲ قطعه کافی)
 */
export const ENDLESS = {
  /** شعاع داده منطقی دور قطعه بازیکن (۳ → ۷×۷ قطعه) */
  dataRadius: 3,
  /** شعاع بصری (۲ → ۵×۵ قطعه = حداکثر ۲۵ قطعه زنده) */
  visualRadius: 2,
  /** حاشیه تخلیه بصری (قطعه تا radius+margin زنده می‌ماند — ضد لرزش در مرز) */
  unloadMargin: 1,
  /** ⏱ بودجه فریمی ساخت بصری (میلی‌ثانیه در هر فریم) */
  buildBudgetMs: 3.5,
  /** حداکثر قطعه ساخته‌شده در یک فریم */
  maxChunkBuildsPerFrame: 2,
  /** بازیافت ترافیک: دورتر از این فاصله از بازیکن → اسپاون دوباره نزدیک بازیکن */
  trafficRecycleDist: 2900,
  /** بازیافت عابرها */
  pedRecycleDist: 2500,
} as const;
