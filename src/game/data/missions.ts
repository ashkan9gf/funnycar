/**
 * missions.ts — تعریف مأموریت‌ها (Data-Driven — طبق GAME_DESIGN بخش ۵ حالت ۲)
 * ============================================================
 * ⭐ محتوای مأموریت (متن/هدف/جایزه) اینجاست؛ منطق در MissionManager.
 * اعداد قابل تنظیم فیزیکی در balance.ts (MISSIONS) هستند.
 *
 * چهار مأموریت سند طراحی:
 *  1) رساندن مسافر عجول قبل از خشک شدن نان
 *  2) رساندن ماشین دودکن به تعمیرگاه قبل از خاموش شدن
 *  3) سوخت‌گیری از پمپ بنزین در ترافیک
 *  4) فرار از چاله‌های خیابان
 *
 * قواعد متن (بخش ۸ سند مادر): کوتاه، محترمانه، آشنا از کوچه و بازار.
 */

/** انواع هدف مأموریت */
export type MissionKind =
  | 'timed_reach'      // رسیدن به هدف قبل از پایان وقت (تصادف شدید = جریمه زمان)
  | 'fragile_reach'    // رسیدن به هدف — حتی یک تصادف = شکست (ماشین لَخت!)
  | 'tolerant_reach'   // بدون تایمر — حداکثر N تصادف شدید مجاز
  | 'pothole_run';     // مأموریت چاله‌ها — حداکثر N چاله + تایمر

export type MissionFailReason = 'time_up' | 'engine_died' | 'too_many_crashes' | 'too_many_potholes';

export interface MissionDef {
  /** شناسه پایدار برای ذخیره (completedMissions) */
  id: string;
  title: string;
  /** توضیح بامزه کارت منو */
  intro: string;
  /** هدف کوتاه HUD */
  objective: string;
  kind: MissionKind;
  /** نقطه هدف — همیشه روی جاده (قابل رسیدن) */
  target: { x: number; y: number };
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
}

/**
 * مختصات هدف‌ها روی شبکه جاده (roadCenter(k) = k*1024 + 128):
 *  - تقاطع جاده ۲ عمودی و ۱ افقی: (2176, 1152)
 *  - جاده ۱ عمودی کنار تعمیرگاه بلوک غربی: (1152, 1664)
 *  - جاده ۲ عمودی کنار پمپ بنزین بلوک شرقی: (2176, 1664)
 *  - تقاطع جاده ۱ عمودی و ۳ افقی (جنوب): (1152, 3200)
 */
export const MISSION_LIST: MissionDef[] = [
  {
    id: 'm01_passenger',
    title: 'مسافر عجول',
    intro: 'خانم همسایه سرِحرصه! نون‌داغ داره سرد می‌شه، برسونش به مقصد!',
    objective: 'برس به علامت هدف، قبل از اینکه وقت تموم شه',
    kind: 'timed_reach',
    target: { x: 2176, y: 1152 },
    timeLimitSec: 40,
    rewardCoins: 40,
    rewardRep: 10,
  },
  {
    id: 'm02_smoking_car',
    title: 'ماشین دودکن',
    intro: 'ماشین دود می‌کنه مثل قلیون! فقط نذار خاموش شه...',
    objective: 'برس به تعمیرگاه — حتی یک تصادف یعنی خاموشی!',
    kind: 'fragile_reach',
    target: { x: 1152, y: 1664 },
    timeLimitSec: 30,
    rewardCoins: 60,
    rewardRep: 12,
  },
  {
    id: 'm03_refuel',
    title: 'سوخت‌گیری در ترافیک',
    intro: 'باک خالی، اعصاب خالی‌تر! تا پمپ بنزین فقط مواظب ماشین‌ها باش.',
    objective: 'برس به پمپ بنزین — حداکثر ۲ تصادف شدید مجازه',
    kind: 'tolerant_reach',
    target: { x: 2176, y: 1664 },
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
    target: { x: 1152, y: 3200 },
    timeLimitSec: 45,
    maxPotholes: 3,
    rewardCoins: 50,
    rewardRep: 10,
  },
];
