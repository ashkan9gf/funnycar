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
  { id: 'veh_player_01', name: 'پراید قرمز', variant: 'player', price: 0, description: 'ماشین شروع؛ کم‌خرج و آشنا', flavor: 'با همین شروع کن، قهرمان کوچه‌ها!' },
  { id: 'veh_pride_01', name: 'پراید اسپرت', variant: 'pride', price: 320, description: 'سبک و چابک برای کوچه‌های تنگ', flavor: 'فقط باهاش پز نده، هنوز پرایده!' },
  { id: 'veh_tiba_01', name: 'تیبا هاچ‌بک', variant: 'tiba', price: 520, description: 'جمع‌وجور با فرمان‌پذیری خوب', flavor: 'از دور شبیه ماشین مسابقه‌ست؛ از نزدیک هم تقریباً!' },
  { id: 'veh_405_01', name: 'پژو ۴۰۵', variant: 'peugeot405', price: 780, description: 'سدان کشیده برای مسیرهای طولانی', flavor: 'کولر روشن، غرغر مسافر خاموش!' },
  { id: 'veh_samand_01', name: 'سمند', variant: 'samand', price: 1050, description: 'بدنه بزرگ‌تر و حس رانندگی سنگین‌تر', flavor: 'سدان ملی؛ فقط با آبرو برونش!' },
  { id: 'veh_nissan_01', name: 'نیسان آبی', variant: 'nissan', price: 1250, description: 'وانت جان‌سخت با ظاهر متفاوت', flavor: 'بار نداری؟ عمو نقی یه یخچال هم می‌ده!' },
  { id: 'veh_renault4_01', name: 'رنو ۴ کلاسیک', variant: 'renault4', price: 1450, description: 'کلاسیک سبک با قیافه نوستالژیک', flavor: 'از موزه اومده، ولی هنوز گاز می‌خوره!' },
  { id: 'veh_vintage_01', name: 'کلاسیک زنگاری', variant: 'vintage', price: 1650, description: 'ماشین خاص برای راننده‌های باتجربه', flavor: 'زنگش تزئینیه؛ خودت رو به اون راه بزن!' },
  { id: 'veh_taxi_01', name: 'تاکسی فانی‌کار', variant: 'taxi', price: 1850, description: 'با تابلوی تاکسی؛ مسافرها خودشون سوار می‌شن!', flavor: 'کرایه‌چی رسمی محله؛ فقط سر چراغ گیر نده!' },
  { id: 'veh_police_01', name: 'پلیس محلّه', variant: 'police', price: 2400, description: 'چراغ‌گردان فلاش‌دار و آژیر واقعی؛ با نظم برانش!', flavor: 'حالا تو پلیسی... ولی خداییش قانون‌شکنی نکن!' },
  { id: 'veh_challenger_01', name: 'چلنجر موسکل', variant: 'challenger', price: 2950, description: 'موثل‌کار امریکایی؛ گاز که بدهی کل محله بیدار می‌شن!', flavor: 'ورودی‌ش که باز بشه، پراید محله خیس می‌شه!' },
];

export function vehicleById(id: string): PlayerVehicleDef | undefined {
  return PLAYER_VEHICLES.find((vehicle) => vehicle.id === id);
}

/**
 * 🔑 v0.2.41 — رنگ‌های کارخانه‌ای هر خودرو (رایگان همراه خرید)
 * درخواست کاربر: «ماشین‌هایی که مدل دارن با بدنه رنگی متفاوت قابل خرید باشن»
 * هنگام خرید، خریدار رنگ بدنه را از همین پالت انتخاب می‌کند.
 * v0.2.42 — تاکسی و پلیس هم مدل GLB دارند و حالا قابل خریدند.
 */
export const VEHICLE_FACTORY_COLORS: Record<PlayerVehicleVariant, string[]> = {
  player: ['#f4f4f0'],
  pride: ['#f4f4f0', '#b03a2e', '#3f7fd4', '#7f8c8d', '#e8a33d'],
  tiba: ['#f4f4f0', '#b03a2e', '#1a5276', '#d5dbdb'],
  peugeot405: ['#f7f7f2', '#7b241c', '#34495e', '#5d6d7e', '#e8a33d'],
  samand: ['#f2f3f4', '#bfc9ca', '#424949', '#5d8aa8'],
  nissan: ['#2f6fae', '#f4f4f0'],
  renault4: ['#d9d9d4', '#a04000', '#616a6b', '#7b241c'],
  vintage: ['#8a6d3b', '#5d6d7e'],
  taxi: ['#f2c230', '#f4f4f0', '#2a9d8f', '#b03a2e'],
  police: ['#f7f7f2', '#274e36', '#1c2833'],
  challenger: ['#b03a2e', '#f4f4f0', '#2c3e50', '#7f8c8d', '#1a5276', '#e8a33d'],
};
