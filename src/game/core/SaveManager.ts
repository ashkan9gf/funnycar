/**
 * SaveManager.ts — ذخیره نسخه‌دار + بازیابی از خرابی
 * ============================================================
 * (ARCHITECTURE بخش ۷ — قانون بخش ۴۰ سند مادر)
 * - versioned: برای تغییرات آینده ساختار (migrate)
 * - backup: نسخه قبلیِ سالم همیشه محفوظ است
 * - هر خطا → بازیابی یا شروع تازه؛ هرگز Crash
 */

import { SAVE } from '../data/balance';
import { DEFAULT_PAINT_ID, PAINT_IDS, UPGRADES, MAX_UPGRADE_LEVEL, type UpgradeId } from '../data/garage';
import { DEFAULT_HORN_ID, HORN_IDS } from '../data/horns';

export interface GameSettings {
  music: number;  // 0..1
  sfx: number;
  voice: number;
  vibration: boolean;
}

export interface SaveData {
  version: number;
  coins: number;
  reputation: number;
  unlockedVehicles: string[];
  selectedVehicle: string;
  completedMissions: string[];
  settings: GameSettings;
  progress: { tutorialDone: boolean; firstRunDone: boolean };
  /** فاز ۶ — سطح هر آپگرید گاراژ (۰ = کارخانه) */
  upgrades: Record<UpgradeId, number>;
  /** فاز ۶ — رنگ‌های خریده‌شده (رنگ پیش‌فرض همیشه هست) */
  ownedPaints: string[];
  /** فاز ۶ — رنگ انتخابی فعلی */
  paint: string;
  /** فاز ۷ — بوق‌های خریده‌شده (بوق استاندارد همیشه هست) */
  ownedHorns: string[];
  /** فاز ۷ — بوق انتخابی فعلی */
  horn: string;
}

function defaultSave(): SaveData {
  return {
    version: SAVE.version,
    coins: 0,
    reputation: 50,
    unlockedVehicles: ['veh_player_01'],
    selectedVehicle: 'veh_player_01',
    completedMissions: [],
    settings: { music: 0.7, sfx: 0.9, voice: 1.0, vibration: true },
    progress: { tutorialDone: false, firstRunDone: false },
    upgrades: defaultUpgrades(),
    ownedPaints: [DEFAULT_PAINT_ID],
    paint: DEFAULT_PAINT_ID,
    ownedHorns: [DEFAULT_HORN_ID],
    horn: DEFAULT_HORN_ID,
  };
}

/** سطوح صفر آپگریدها — از داده گاراژ ساخته می‌شود */
function defaultUpgrades(): Record<UpgradeId, number> {
  const out = {} as Record<UpgradeId, number>;
  for (const u of UPGRADES) out[u.id] = 0;
  return out;
}

/** ارتقای نسخه‌های قدیمی — نسخه فعلی 1 است؛ الگو برای آینده */
function migrate(raw: unknown): SaveData {
  const base = defaultSave();
  if (typeof raw !== 'object' || raw === null) return base;
  const data = raw as Partial<SaveData>;
  // نسخه‌های آینده اینجا زنجیره‌وار ارتقا می‌یابند: if (data.version === 1) {...}
  return {
    version: SAVE.version,
    coins: typeof data.coins === 'number' && Number.isFinite(data.coins) && data.coins >= 0
      ? Math.floor(data.coins)
      : base.coins,
    reputation: typeof data.reputation === 'number' && Number.isFinite(data.reputation)
      ? Math.min(100, Math.max(0, data.reputation))
      : base.reputation,
    unlockedVehicles: Array.isArray(data.unlockedVehicles) && data.unlockedVehicles.some((v) => typeof v === 'string')
      ? [...new Set(data.unlockedVehicles.filter((v): v is string => typeof v === 'string' && v.length > 0))]
      : base.unlockedVehicles,
    selectedVehicle: typeof data.selectedVehicle === 'string' && data.selectedVehicle.length > 0
      ? data.selectedVehicle
      : base.selectedVehicle,
    completedMissions: Array.isArray(data.completedMissions)
      ? [...new Set(data.completedMissions.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : [],
    settings: migrateSettings(data.settings, base.settings),
    progress: migrateProgress(data.progress, base.progress),
    upgrades: migrateUpgrades(data.upgrades),
    ownedPaints: migratePaints(data.ownedPaints),
    paint: typeof data.paint === 'string' && PAINT_IDS.includes(data.paint) ? data.paint : DEFAULT_PAINT_ID,
    ownedHorns: migrateHorns(data.ownedHorns),
    horn: typeof data.horn === 'string' && HORN_IDS.includes(data.horn)
      ? data.horn
      : DEFAULT_HORN_ID,
  };
}

/** اعتبارسنجی بوق‌ها — بوق استاندارد همیشه هست تا فروشگاه خراب نشود */
function migrateHorns(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.filter((h): h is string => typeof h === 'string' && HORN_IDS.includes(h)) : [];
  if (!list.includes(DEFAULT_HORN_ID)) list.push(DEFAULT_HORN_ID);
  return list;
}

/** اعتبارسنجی سطوح آپگرید در سیو قدیمی/خراب */
function migrateUpgrades(raw: unknown): Record<UpgradeId, number> {
  const out = defaultUpgrades();
  if (typeof raw !== 'object' || raw === null) return out;
  const obj = raw as Record<string, unknown>;
  for (const u of UPGRADES) {
    const v = obj[u.id];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[u.id] = Math.max(0, Math.min(MAX_UPGRADE_LEVEL, Math.floor(v)));
    }
  }
  return out;
}

/** اعتبارسنجی رنگ‌ها — رنگ پیش‌فرض همیشه هست تا گاراژ خراب نشود */
function migratePaints(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string' && PAINT_IDS.includes(p)) : [];
  if (!list.includes(DEFAULT_PAINT_ID)) list.push(DEFAULT_PAINT_ID);
  return list;
}

function migrateSettings(raw: unknown, base: GameSettings): GameSettings {
  if (typeof raw !== 'object' || raw === null) return { ...base };
  const value = raw as Partial<GameSettings>;
  const volume = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
  return {
    music: volume(value.music, base.music),
    sfx: volume(value.sfx, base.sfx),
    voice: volume(value.voice, base.voice),
    vibration: typeof value.vibration === 'boolean' ? value.vibration : base.vibration,
  };
}

function migrateProgress(raw: unknown, base: SaveData['progress']): SaveData['progress'] {
  if (typeof raw !== 'object' || raw === null) return { ...base };
  const value = raw as Partial<SaveData['progress']>;
  return {
    tutorialDone: typeof value.tutorialDone === 'boolean' ? value.tutorialDone : base.tutorialDone,
    firstRunDone: typeof value.firstRunDone === 'boolean' ? value.firstRunDone : base.firstRunDone,
  };
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class SaveManager {
  private data: SaveData;

  constructor() {
    this.data = this.load();
  }

  get(): SaveData {
    return this.data;
  }

  /**
   * تغییر امن: همه تغییرات از طریق همین تابع — بعد از هر تغییر ذخیره می‌شود
   */
  mutate(fn: (d: SaveData) => void): void {
    try {
      fn(this.data);
      this.persist();
    } catch (err) {
      // حتی خطای داخل mutate نباید بازی را ببندد
      console.warn('[SaveManager] mutate failed:', err);
    }
  }

  private load(): SaveData {
    if (typeof window === 'undefined') return defaultSave();
    try {
      // Accessing localStorage itself can throw in restricted WebView/private contexts.
      const storage = window.localStorage;
      const text = storage.getItem(SAVE.key);
      if (text) {
        const parsed = safeParse(text);
        if (parsed !== null) return migrate(parsed);
      }
      // نسخه اصلی خراب/خالی → بازیابی از backup
      const backup = storage.getItem(SAVE.backupKey);
      if (backup) {
        const parsed = safeParse(backup);
        if (parsed !== null) return migrate(parsed);
      }
    } catch (err) {
      console.warn('[SaveManager] load failed:', err);
    }
    return defaultSave();
  }

  private persist(): void {
    try {
      const current = window.localStorage.getItem(SAVE.key);
      if (current) window.localStorage.setItem(SAVE.backupKey, current); // نسخه سالم قبلی
      window.localStorage.setItem(SAVE.key, JSON.stringify(this.data));
    } catch (err) {
      console.warn('[SaveManager] persist failed (private mode?):', err);
    }
  }

  /** ذخیره فوری (مثلاً هنگام Pause یا خروج) */
  flush(): void {
    this.persist();
  }

  /** بازنشانی کامل (تنظیمات: Reset Save) */
  reset(): void {
    this.data = defaultSave();
    try {
      window.localStorage.removeItem(SAVE.key);
      window.localStorage.removeItem(SAVE.backupKey);
    } catch { /* بی‌خطر */ }
    this.persist();
  }
}
