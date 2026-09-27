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
 * مختصات هدف‌ها روی شبکه جاده جدید (roadCenter(k) = k*1400 + 280):
 *  - تقاطع جاده ۲ عمودی و ۱ افقی: (3080, 1680)
 *  - زون تعمیرگاه کنار بلوک گاراژ (1,2): (3250, 3780)
 *  - زون پمپ بنزین کنار بلوک (3,3): (5180, 4480)
 *  - تقاطع جاده ۳ عمودی و ۰ افقی (شمال): (4480, 280)
 */
export const MISSION_LIST: MissionDef[] = [
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
];
