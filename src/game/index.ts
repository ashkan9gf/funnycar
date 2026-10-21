/**
 * index.ts — نقطه ورود موتور بازی
 * ============================================================
 * پوسته React فقط با این توابع صحبت می‌کند؛ هیچ کامپوننتی مستقیماً
 * به کلاس‌های داخلی موتور دست نمی‌زند (مرز لایه‌ها — ARCHITECTURE بخش ۱)
 */

import { GameManager, type GameCallbacks, type GameState, type HudData, type MissionResultData, type GarageView, type PurchaseResult } from './core/GameManager';
import type { GameSettings } from './core/SaveManager';
import type { MissionCategory } from './data/missions';
import type { UpgradeId } from './data/garage';

/** 🔑 v0.2.43 + v0.2.45 — تنظیمات کنترل لمسی (بین موتور و پوستهٔ React) */
export type UiPrefs = Pick<GameSettings, 'controlsScale' | 'controlsOpacity' | 'leftHanded' | 'vibration' | 'controlMode'>;

export interface MissionListItem {
  id: string;
  title: string;
  intro: string;
  objective: string;
  category: MissionCategory;
  rewardCoins: number;
  rewardRep: number;
  timeLimitSec: number;
  done: boolean;
  /** فاز ۷ — قفل زنجیره داستانی */
  locked: boolean;
  /** فاز ۷ — عنوان مأموریت پیش‌نیاز (برای متن راهنمای قفل) */
  requiresTitle: string | null;
}

export interface GameInstance {
  startGameplay: () => void;
  pause: () => void;
  resume: () => void;
  backToMenu: () => void;
  setVirtualSteer: (dir: -1 | 0 | 1) => void;
  setVirtualGas: (v: boolean) => void;
  setVirtualBrake: (v: boolean) => void;
  /** 🔑 v0.2.45 — فرمان آنالوگ برای مود فرمان‌دستی/ژیروسکوپ (null = غیرفعال) */
  setVirtualSteerAnalog: (v: number | null) => void;
  /** 🔑 v0.2.45 — چرخش ۳۶۰ درجهٔ دوربین با کشیدن انگشت روی صحنه */
  orbitCamera: (delta: number) => void;
  /** 🔑 v0.2.45 — دکمهٔ ریفرش: ماشین از آسمان همان‌جا می‌افتد پایین (ضدگیرکردن) */
  respawnDrop: () => void;
  pressHorn: () => void;
  setSetting: <K extends 'music' | 'sfx' | 'voice'>(k: K, v: number) => void;
  setGraphicsQuality: (quality: 'performance' | 'balanced' | 'quality') => void;
  getSettings: () => GameSettings;
  /** 🔑 v0.2.43 — اندازه/شفافیت/چپ‌دست/ویبرهٔ دکمه‌های لمسی */
  setUiPrefs: (p: Partial<UiPrefs>) => void;
  getSave: () => { coins: number; reputation: number };
  toggleDebugFps: () => void;
  /** فاز 4: مأموریت‌ها (فاز ۵: با فیلتر دسته — park/taxi/challenge) */
  listMissions: (category?: MissionCategory) => MissionListItem[];
  startMission: (id: string) => void;
  /** v0.2.40 — دکمهٔ «مأموریت بعدی» */
  nextMissionId: () => string;
  abandonMission: () => void;
  /** فاز BIG-IR: اسکران به تعمیرگاه بعد از خاموشی */
  towToRepair: () => void;
  /** گاراژ عمو نقی — خودروها، آپگرید و رنگ */
  listGarage: () => GarageView;
  buyVehicle: (id: string, colorHex?: string) => PurchaseResult;
  selectVehicle: (id: string) => PurchaseResult;
  buyUpgrade: (id: UpgradeId) => PurchaseResult;
  buyPaint: (id: string) => PurchaseResult;
  selectPaint: (id: string) => PurchaseResult;
  /** فاز ۷: فروشگاه بوق‌های طنز */
  buyHorn: (id: string) => PurchaseResult;
  selectHorn: (id: string) => PurchaseResult;
  /** بازار (v0.2.39): شنیدن بوق قبل از خرید */
  previewHorn: (id: string) => void;
  dispose: () => void;
}

export async function createGame(
  canvas: HTMLCanvasElement,
  callbacks: GameCallbacks = {},
  onBootProgress?: (done: number, total: number) => void,
): Promise<GameInstance> {
  const gm = new GameManager(canvas, callbacks);
  await gm.boot(onBootProgress);
  return {
    startGameplay: () => gm.startGameplay(),
    pause: () => gm.pause(),
    resume: () => gm.resume(),
    backToMenu: () => gm.backToMenu(),
    setVirtualSteer: (dir) => gm.setVirtualSteer(dir),
    setVirtualGas: (v) => gm.setVirtualGas(v),
    setVirtualBrake: (v) => gm.setVirtualBrake(v),
    setVirtualSteerAnalog: (v) => gm.setVirtualSteerAnalog(v),
    orbitCamera: (delta) => gm.orbitCamera(delta),
    respawnDrop: () => gm.respawnDrop(),
    pressHorn: () => gm.pressHorn(),
    setSetting: (k, v) => gm.setSetting(k, v),
    setGraphicsQuality: (quality) => gm.setGraphicsQuality(quality),
    getSettings: () => gm.getSettings(),
    setUiPrefs: (p) => gm.setUiPrefs(p),
    getSave: () => gm.getSave(),
    toggleDebugFps: () => gm.toggleDebugFps(),
    listMissions: (category?: MissionCategory) => gm.listMissions(category),
    startMission: (id) => gm.startMission(id),
    nextMissionId: () => gm.nextMissionId(),
    abandonMission: () => gm.abandonMission(),
    towToRepair: () => gm.towToRepair(),
    listGarage: () => gm.listGarage(),
    buyVehicle: (id, colorHex) => gm.buyVehicle(id, colorHex),
    selectVehicle: (id) => gm.selectVehicle(id),
    buyUpgrade: (id) => gm.buyUpgrade(id),
    buyPaint: (id) => gm.buyPaint(id),
    selectPaint: (id) => gm.selectPaint(id),
    buyHorn: (id) => gm.buyHorn(id),
    selectHorn: (id) => gm.selectHorn(id),
    previewHorn: (id) => gm.previewHorn(id),
    dispose: () => gm.dispose(),
  };
}

export type { GameState, HudData, MissionResultData, GarageView, PurchaseResult };
export type { MissionCategory } from './data/missions';
export type { UpgradeId } from './data/garage';
export { GARAGE_FOOTER, PAINT_FLAVOR } from './data/garage';
export { HORN_FOOTER, HORN_FLAVOR } from './data/horns';
