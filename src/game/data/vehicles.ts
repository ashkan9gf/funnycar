/** Vehicles purchasable with in-game coins. IDs remain stable for existing save files. */
export type PlayerVehicleVariant =
  | 'player' | 'pride' | 'peugeot405' | 'samand'
  | 'nissan' | 'tiba' | 'renault4' | 'vintage';

export interface PlayerVehicleDef {
  id: string;
  name: string;
  variant: PlayerVehicleVariant;
  price: number;
  description: string;
  flavor: string;
}

export const PLAYER_VEHICLES: PlayerVehicleDef[] = [
  { id: 'veh_player_01', name: 'پراید سفید', variant: 'player', price: 0, description: 'ماشین شروع؛ کم‌خرج و آشنا', flavor: 'با همین شروع کن، قهرمان کوچه‌ها!' },
  { id: 'veh_pride_01', name: 'پراید اسپرت', variant: 'pride', price: 320, description: 'سبک و چابک برای کوچه‌های تنگ', flavor: 'فقط باهاش پز نده، هنوز پرایده!' },
  { id: 'veh_tiba_01', name: 'تیبا هاچ‌بک', variant: 'tiba', price: 520, description: 'جمع‌وجور با فرمان‌پذیری خوب', flavor: 'از دور شبیه ماشین مسابقه‌ست؛ از نزدیک هم تقریباً!' },
  { id: 'veh_405_01', name: 'پژو ۴۰۵', variant: 'peugeot405', price: 780, description: 'سدان کشیده برای مسیرهای طولانی', flavor: 'کولر روشن، غرغر مسافر خاموش!' },
  { id: 'veh_samand_01', name: 'سمند', variant: 'samand', price: 1050, description: 'بدنه بزرگ‌تر و حس رانندگی سنگین‌تر', flavor: 'سدان ملی؛ فقط با آبرو برونش!' },
  { id: 'veh_nissan_01', name: 'نیسان آبی', variant: 'nissan', price: 1250, description: 'وانت جان‌سخت با ظاهر متفاوت', flavor: 'بار نداری؟ عمو نقی یه یخچال هم می‌ده!' },
  { id: 'veh_renault4_01', name: 'رنو ۴ کلاسیک', variant: 'renault4', price: 1450, description: 'کلاسیک سبک با قیافه نوستالژیک', flavor: 'از موزه اومده، ولی هنوز گاز می‌خوره!' },
  { id: 'veh_vintage_01', name: 'کلاسیک زنگاری', variant: 'vintage', price: 1650, description: 'ماشین خاص برای راننده‌های باتجربه', flavor: 'زنگش تزئینیه؛ خودت رو به اون راه بزن!' },
];

export function vehicleById(id: string): PlayerVehicleDef | undefined {
  return PLAYER_VEHICLES.find((vehicle) => vehicle.id === id);
}
