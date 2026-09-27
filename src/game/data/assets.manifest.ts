/**
 * assets.manifest.ts — فهرست رسمی Assetهای بازی (تک‌نقطه حقیقت)
 * ============================================================
 * ⭐ اصل طلایی معماری (ARCHITECTURE_FA.md بخش ۵):
 *    منطق بازی → شناسه Asset → AssetManager → فایل واقعی یا Placeholder
 *    منطق بازی هرگز مسیر فایل را نمی‌داند!
 *
 * برای جایگزینی یک Placeholder با Asset واقعی: فقط فایل را با همان نام
 * در همان مسیر بگذارید (ASSET_IMPORT_GUIDE_FA.md) — بدون هیچ تغییر کد.
 *
 * - placeholder.type: شکل placeholder برنامه‌ای (PlaceholderFactory می‌کشد)
 * - frame: اگر Asset یک Sprite Sheet است
 * - voice: جمله صوتی متصل به یک کلید دیالوگ (در فاز 7/9 فایل واقعی جایگزین می‌شود)
 */

export type PlaceholderType =
  | 'vehicle'
  | 'portrait'
  | 'tile_road'
  | 'tile_cross'
  | 'tile_sidewalk'
  | 'tile_ground'
  | 'building'
  | 'prop'
  | 'effect'
  | 'ui';

export interface AssetEntry {
  /** مسیر نسبی داخل public/ — طبق ASSET_INVENTORY_FA.md */
  src: string;
  /** مشخصات Placeholder اگر فایل واقعی نبود (همیشه تعریف می‌شود) */
  placeholder: { type: PlaceholderType; w: number; h: number; label?: string };
  /** اگر Sprite Sheet است: اندازه فریم/تعداد/سرعت/تکرار */
  frame?: { w: number; h: number; count: number; fps: number; loop: boolean };
  /** جمله صوتی: اگر فایل موجود باشد VoiceManager پخشش می‌کند، وگرنه فقط متن */
  voice?: { event: string; index: number };
}

export const ASSETS_MANIFEST: Record<string, AssetEntry> = {
  // ============ Batch 1 — ماشین بازیکن، کاشی‌ها، پرتره راننده ============
  veh_player_01: {
    src: 'assets/vehicles/player/veh_player_01.png',
    placeholder: { type: 'vehicle', w: 256, h: 448, label: 'PLACEHOLDER_VEHICLE' },
  },
  env_road_straight_01: {
    src: 'assets/environments/roads/env_road_straight_01.png',
    placeholder: { type: 'tile_road', w: 512, h: 512, label: 'PLACEHOLDER_ENVIRONMENT' },
  },
  env_road_cross_01: {
    src: 'assets/environments/roads/env_road_cross_01.png',
    placeholder: { type: 'tile_cross', w: 512, h: 512, label: 'PLACEHOLDER_ENVIRONMENT' },
  },
  env_sidewalk_01: {
    src: 'assets/environments/roads/env_sidewalk_01.png',
    placeholder: { type: 'tile_sidewalk', w: 512, h: 512, label: 'PLACEHOLDER_ENVIRONMENT' },
  },
  env_ground_01: {
    src: 'assets/environments/roads/env_ground_01.png',
    placeholder: { type: 'tile_ground', w: 512, h: 512, label: 'PLACEHOLDER_ENVIRONMENT' },
  },
  char_driver_01_idle: {
    src: 'assets/characters/player/char_driver_01_idle.png',
    placeholder: { type: 'portrait', w: 512, h: 512, label: 'PLACEHOLDER_CHARACTER' },
  },
  char_driver_01_happy: {
    src: 'assets/characters/player/char_driver_01_happy.png',
    placeholder: { type: 'portrait', w: 512, h: 512, label: 'PLACEHOLDER_CHARACTER' },
  },
  char_driver_01_shock: {
    src: 'assets/characters/player/char_driver_01_shock.png',
    placeholder: { type: 'portrait', w: 512, h: 512, label: 'PLACEHOLDER_CHARACTER' },
  },

  // ============ Batch 2 — ترافیک و پلیس (واقعی — فاز 2) ============
  veh_taxi_01: {
    src: 'assets/vehicles/traffic/veh_taxi_01.png',
    placeholder: { type: 'vehicle', w: 256, h: 448, label: 'PLACEHOLDER_VEHICLE' },
  },
  veh_police_01: {
    src: 'assets/npc/vehicles/veh_police_01.png',
    placeholder: { type: 'vehicle', w: 256, h: 448, label: 'PLACEHOLDER_VEHICLE' },
  },
  veh_pickup_01: {
    src: 'assets/vehicles/traffic/veh_pickup_01.png',
    placeholder: { type: 'vehicle', w: 256, h: 448, label: 'PLACEHOLDER_VEHICLE' },
  },
  veh_sedan_01: {
    src: 'assets/vehicles/traffic/veh_sedan_01.png',
    placeholder: { type: 'vehicle', w: 256, h: 448, label: 'PLACEHOLDER_VEHICLE' },
  },

  // ============ Batch 2 — ساختمان‌های واقعی (فاز 2) ============
  env_building_shop_01: {
    src: 'assets/environments/buildings/env_building_shop_01.png',
    placeholder: { type: 'building', w: 512, h: 640, label: 'PLACEHOLDER_ENVIRONMENT' },
  },
  env_building_home_01: {
    src: 'assets/environments/buildings/env_building_home_01.png',
    placeholder: { type: 'building', w: 512, h: 640, label: 'PLACEHOLDER_ENVIRONMENT' },
  },
  env_building_garage_01: {
    src: 'assets/environments/buildings/env_building_garage_01.png',
    placeholder: { type: 'building', w: 512, h: 640, label: 'PLACEHOLDER_ENVIRONMENT' },
  },
  env_gas_station_01: {
    src: 'assets/environments/landmarks/env_gas_station_01.png',
    placeholder: { type: 'building', w: 640, h: 640, label: 'PLACEHOLDER_ENVIRONMENT' },
  },

  // ============ صدا (فاز 7/9 جایگزین سینتی می‌شود — بدون تغییر کد) ============
  sfx_engine_loop: {
    src: 'assets/audio/sfx/sfx_engine_loop.ogg',
    placeholder: { type: 'effect', w: 128, h: 128, label: 'PLACEHOLDER_AUDIO' },
  },
  sfx_crash_01: {
    src: 'assets/audio/sfx/sfx_crash_01.ogg',
    placeholder: { type: 'effect', w: 128, h: 128, label: 'PLACEHOLDER_AUDIO' },
  },
  sfx_horn_01: {
    src: 'assets/audio/sfx/sfx_horn_01.ogg',
    placeholder: { type: 'effect', w: 128, h: 128, label: 'PLACEHOLDER_AUDIO' },
  },
  voice_crash_01: {
    src: 'assets/audio/voices/player/voice_crash_01.ogg',
    placeholder: { type: 'effect', w: 128, h: 128, label: 'PLACEHOLDER_AUDIO' },
    voice: { event: 'car_crash', index: 0 },
  },
};

/** پرتره پیش‌فرض هر گوینده (برای حباب دیالوگ) */
export const SPEAKER_PORTRAIT: Record<string, string> = {
  driver: 'char_driver_01_idle',
  police: 'char_driver_01_idle', // تا Batch 2 (npc_police)
  passenger: 'char_driver_01_idle', // تا Batch 4
  mechanic: 'char_driver_01_idle',
  radio: 'char_driver_01_idle',
  cat: 'char_driver_01_idle',
};
