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

/** آستانه‌های برخورد */
export const COLLISION = {
  /** سرعت بالای این = تصادف جدی (لرزش + آبرو) */
  hardCrashSpeed: 260,
  softCrashSpeed: 90,
  /** ضریب نگه‌داشت سرعت هنگام لغزش در امتداد مانع (ساییدن به دیوار) */
  wallSlideFactor: 0.6,
} as const;

/** آبرو (Reputation) — طبق GAME_DESIGN بخش ۶ */
export const REPUTATION = {
  start: 50,
  min: 0,
  max: 100,
  softCrashPenalty: 3,
  hardCrashPenalty: 8,
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
  version: 1,
} as const;

/** رندر */
export const RENDER = {
  /** عرض منطقی بازی — همه محاسبات با این است (ارتفاع متغیر با صفحه) */
  logicalWidth: 720,
  maxDevicePixelRatio: 2,
  /** کاشی پایه دنیا */
  tileSize: 256,
} as const;
