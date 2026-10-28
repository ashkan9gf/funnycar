/** Vehicles purchasable with in-game coins. IDs remain stable for existing save files. */
export type PlayerVehicleVariant =
  | 'player' | 'pride' | 'peugeot405' | 'samand'
  | 'nissan' | 'tiba' | 'renault4' | 'vintage'
  | 'taxi' | 'police' | 'challenger';

export interface PlayerVehicleDef {
  id: string;
  name: string;
  variant: PlayerVehicleVariant;
  price: number;
  description: string;
  flavor: string;
}

export const PLAYER_VEHICLES: PlayerVehicleDef[] = [
  { id: 'veh_player_01', name: 'تیزبوق', variant: 'player', price: 0, description: 'ماشین شروع؛ کم‌خرج و آشنا', flavor: 'با همین شروع کن، قهرمان کوچه‌ها!' },
  { id: 'veh_pride_01', name: 'قسطی', variant: 'pride', price: 320, description: 'سبک و چابک برای کوچه‌های تنگ', flavor: 'فقط باهاش پز نده، هنوز قسط‌هاتم تموم نشده!' },
  { id: 'veh_tiba_01', name: 'پچ‌پچو', variant: 'tiba', price: 520, description: 'جمع‌وجور با فرمان‌پذیری خوب', flavor: 'از دور شبیه ماشین مسابقه‌ست؛ از نزدیک هم تقریباً!' },
  { id: 'veh_405_01', name: 'فشفاهی', variant: 'peugeot405', price: 780, description: 'سدان کشیده برای مسیرهای طولانی', flavor: 'کولر روشن، غرغر مسافر خاموش!' },
  { id: 'veh_samand_01', name: 'دبه‌کش', variant: 'samand', price: 1050, description: 'بدنه بزرگ‌تر و حس رانندگی سنگین‌تر', flavor: 'سدان باوقار محله؛ فقط با آبرو برونش!' },
  { id: 'veh_nissan_01', name: 'زورگرد', variant: 'nissan', price: 1250, description: 'وانت جان‌سخت با ظاهر متفاوت', flavor: 'بار نداری؟ عمو نقی یه یخچال هم می‌ده!' },
  { id: 'veh_renault4_01', name: 'چهاردَنده', variant: 'renault4', price: 1450, description: 'کلاسیک سبک با قیافه نوستالژیک', flavor: 'از موزه اومده، ولی هنوز گاز می‌خوره!' },
  { id: 'veh_vintage_01', name: 'تُف‌تُفی', variant: 'vintage', price: 1650, description: 'ماشین خاص برای راننده‌های باتجربه', flavor: 'زنگش تزئینیه؛ خودت رو به اون راه بزن!' },
  { id: 'veh_taxi_01', name: 'کرایه‌چی', variant: 'taxi', price: 1850, description: 'با تابلوی تاکسی؛ مسافرها خودشون سوار می‌شن!', flavor: 'کرایه‌چی رسمی محله؛ فقط سر چراغ گیر نده!' },
  { id: 'veh_police_01', name: 'آژیرخان', variant: 'police', price: 2400, description: 'چراغ‌گردان فلاش‌دار و آژیر واقعی؛ با نظم برانش!', flavor: 'حالا تو پلیسی... ولی خداییش قانون‌شکنی نکن!' },
  { id: 'veh_challenger_01', name: 'اژدهاخان', variant: 'challenger', price: 2950, description: 'موثل‌کار امریکایی؛ گاز که بدهی کل محله بیدار می‌شن!', flavor: 'ورودی‌ش که باز بشه، شیشهٔ مغازه‌ها می‌لرزه!' },
];

export function vehicleById(id: string): PlayerVehicleDef | undefined {
  return PLAYER_VEHICLES.find((vehicle) => vehicle.id === id);
}

/**
 * 🔑 v0.2.41 — رنگ‌های کارخانه‌ای هر خودرو (رایگان همراه خرید)
 * درخواست کاربر: «ماشین‌هایی که مدل دارن با بدنه رنگی متفاوت قابل خرید باشن»
 * هنگام خرید، خریدار رنگ بدنه را از همین پالت انتخاب می‌کند.
 * v0.2.42 — تاکسی و پلیس هم مدل GLB دارند و حالا قابل خریدند.
 * v0.2.59 — 🔑 رنگ اول = رنگ امضای همان خودرو (هم‌رنگ بیکِ GLB) — تمایز خودروها؛
 * قبلاً همه سفید spawn می‌شدند و «همه شبیه هم» دیده می‌شدند.
 */
export const VEHICLE_FACTORY_COLORS: Record<PlayerVehicleVariant, string[]> = {
  player: ['#c71b1d', '#f4f4f0', '#2c3e50'],
  pride: ['#1a9994', '#f4f4f0', '#b03a2e', '#7f8c8d', '#e8a33d'],
  tiba: ['#5c9eb8', '#f4f4f0', '#b03a2e', '#d5dbdb'],
  peugeot405: ['#e0e1de', '#7b241c', '#34495e', '#5d6d7e', '#e8a33d'],
  samand: ['#b3b8bd', '#424949', '#5d8aa8', '#f2f3f4'],
  nissan: ['#4d80ae', '#f4f4f0'],
  renault4: ['#ccb99a', '#a04000', '#616a6b', '#7b241c'],
  vintage: ['#575f45', '#5d6d7e'],
  taxi: ['#f5ba1a', '#f4f4f0', '#2a9d8f', '#b03a2e'],
  police: ['#ebeded', '#274e36', '#1c2833'],
  challenger: ['#e6660d', '#f4f4f0', '#2c3e50', '#7f8c8d', '#1a5276'],
};
