/**
 * horns.ts — فروشگاه بوق‌های طنز (فاز ۷ — Data-Driven)
 * ============================================================
 * ⭐ همه محتوا (نام/قیمت/طنز/واکنش) اینجاست؛ منطق در AudioManager/GameManager.
 * بوق «امضای صوتی» راننده است — مثل خیابان‌های ایران که هر کسی یک بوق دارد!
 *
 * قواعد متن (بخش ۸ سند مادر): کوتاه، محترمانه، آشنا از کوچه و بازار.
 * واکنش‌ها (HORN_REACT) کلیدِ رویداد در dialogues.ts هستند — نه متن مستقیم.
 */

import type { DIALOGUES } from './dialogues';

/** کلید رویداد دیالوگ (برای واکنش اهالی خیابان به بوق) */
export type DialogueKey = keyof typeof DIALOGUES;

/** شناسه بوق‌ها — classic همیشه رایگان است */
export type HornId =
  | 'classic'   // بوق استاندارد پراید
  | 'doble'     // بوق دوبل دو تُنه
  | 'moto'      // بوق موتور — نازک و عصبی
  | 'klaxon'    // بوق آنتیک ماشین‌های قدیمی
  | 'steam'     // بوق کشتی بخار
  | 'melody'    // بوق آهنگ‌دار نیسانی — سلطان خیابان!
  | 'crow'      // بوق کلاغ — قارقار!
  | 'police';   // آژیر — بذار فکر کنن پلیسه!

export interface HornDef {
  id: HornId;
  name: string;
  price: number; // 0 = رایگان/پیش‌فرض
  /** توضیح کوتاه زیر دکمه در فروشگاه */
  desc: string;
}

/** فهرست فروشگاه — ترتیب نمایش */
export const HORN_LIST: HornDef[] = [
  { id: 'classic', name: 'بوق استاندارد', price: 0, desc: 'همون بوق کارخانه — بی‌ادعا و خسته' },
  { id: 'doble',   name: 'بوق دوبل',     price: 120, desc: 'دو تُنه هم‌زمان؛ یعنی «من جدی‌م!»' },
  { id: 'moto',    name: 'بوق موتوری',   price: 140, desc: 'نازک و عصبی — مثل پیک موتوری عصر جمعه' },
  { id: 'klaxon',  name: 'بوق آنتیک',    price: 220, desc: 'طرفدارانفیروزخانری و کلاسیک‌بازها امضاش کردن' },
  { id: 'steam',   name: 'بوق کشتی',     price: 260, desc: 'مثل کشتی بخار؛ مردم فکر می‌کنن رودخونه‌ست!' },
  { id: 'melody',  name: 'بوق آهنگ‌دار', price: 340, desc: 'نیسانِ مسافرکش رو یاد مردم می‌ندازه!' },
  { id: 'crow',    name: 'بوق کلاغ',     price: 420, desc: 'قارقار! کلاغ‌های خیابون جواب می‌دن' },
  { id: 'police',  name: 'آژیر خیابانی', price: 520, desc: 'بذار فکر کنن پلیسه... ولی دعوا با خودت!' },
];

export const DEFAULT_HORN_ID: HornId = 'classic';

export function hornById(id: string): HornDef | undefined {
  return HORN_LIST.find((h) => h.id === id);
}

/** فهرست شناسه‌های مجاز (برای migrate سیو) — string تا includes سیو راحت باشد */
export const HORN_IDS: string[] = HORN_LIST.map((h) => h.id);

/**
 * واکنش اهالی خیابان به هر بوق — کلید رویداد dialogues.ts
 * بوق‌های معمولی → همان واکنش همیشگی (traffic_honk)
 */
export const HORN_REACT: Record<HornId, DialogueKey> = {
  classic: 'traffic_honk',
  doble: 'traffic_honk',
  moto: 'traffic_honk',
  klaxon: 'traffic_honk',
  steam: 'horn_steam',
  melody: 'horn_melody',
  crow: 'horn_crow',
  police: 'horn_police',
};

/** بوق‌های «خاص» — جملات طنز خودِ راننده جای horn_joke می‌آید */
export const HORN_OWNER_EVENT: Partial<Record<HornId, DialogueKey>> = {
  melody: 'horn_melody_self',
  crow: 'horn_crow_self',
  police: 'horn_police_self',
};

/** جمله طنز بعد از خرید هر بوق — عمو نقی نصب می‌کند! */
export const HORN_FLAVOR: Record<HornId, string> = {
  classic: 'بوق کارخانه! چرخ دستی هم صدا داره، ولی باشه...',
  doble: 'دوتا بوق وصل کردم به هم! مهندسیِ واقعی همین‌ه!',
  moto: 'این بوق رو از پیک موتوری خریدم... عصبی شده بود، آروم شد!',
  klaxon: 'از یه فیروزخانری ۵۶ کندمش! تق تق تق!',
  steam: 'کشتی نیاورده تا این بوقو بیاره! بخارش از اگزوز خودته!',
  melody: 'حالا تو نیسان موزیک‌باز شهر می‌شی! ولومش هم کم نکن!',
  crow: 'قار قار! کلاغای میدون توست فکر کنن همقطارشونی!',
  police: 'بزن تا ببینم... مردم پراکنده شدن! ولی سرت رو به دیوار ننداز!',
};

/** جمله پیش‌فرض پاورقی بخش بوق‌ها */
export const HORN_FOOTER = 'عمو نقی: «بوق، هویتِ راننده‌ست! بی‌بوق که آدم نمی‌شه راند!»';
