/**
 * index.ts — نقطه ورود موتور بازی
 * ============================================================
 * پوسته React فقط با این توابع صحبت می‌کند؛ هیچ کامپوننتی مستقیماً
 * به کلاس‌های داخلی موتور دست نمی‌زند (مرز لایه‌ها — ARCHITECTURE بخش ۱)
 */

import { GameManager, type GameCallbacks, type GameState, type HudData, type MissionResultData, type GarageView, type PurchaseResult } from './core/GameManager';
import type { MissionCategory } from './data/missions';
import type { UpgradeId } from './data/garage';

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
  pressHorn: () => void;
  setSetting: <K extends 'music' | 'sfx' | 'voice'>(k: K, v: number) => void;
  setGraphicsQuality: (quality: 'performance' | 'balanced' | 'quality') => void;
  getSettings: () => { music: number; sfx: number; voice: number; vibration: boolean; graphicsQuality: 'performance' | 'balanced' | 'quality' };
  getSave: () => { coins: number; reputation: number };
  toggleDebugFps: () => void;
  /** فاز 4: مأموریت‌ها (فاز ۵: با فیلتر دسته — park/taxi/challenge) */
  listMissions: (category?: MissionCategory) => MissionListItem[];
  startMission: (id: string) => void;
  abandonMission: () => void;
  /** فاز BIG-IR: اسکران به تعمیرگاه بعد از خاموشی */
  towToRepair: () => void;
  /** گاراژ عمو نقی — خودروها، آپگرید و رنگ */
  listGarage: () => GarageView;
  buyVehicle: (id: string) => PurchaseResult;
  selectVehicle: (id: string) => PurchaseResult;
  buyUpgrade: (id: UpgradeId) => PurchaseResult;
  buyPaint: (id: string) => PurchaseResult;
  selectPaint: (id: string) => PurchaseResult;
  /** فاز ۷: فروشگاه بوق‌های طنز */
  buyHorn: (id: string) => PurchaseResult;
  selectHorn: (id: string) => PurchaseResult;
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
    pressHorn: () => gm.pressHorn(),
    setSetting: (k, v) => gm.setSetting(k, v),
    setGraphicsQuality: (quality) => gm.setGraphicsQuality(quality),
    getSettings: () => gm.getSettings(),
    getSave: () => gm.getSave(),
    toggleDebugFps: () => gm.toggleDebugFps(),
    listMissions: (category?: MissionCategory) => gm.listMissions(category),
    startMission: (id) => gm.startMission(id),
    abandonMission: () => gm.abandonMission(),
    towToRepair: () => gm.towToRepair(),
    listGarage: () => gm.listGarage(),
    buyVehicle: (id) => gm.buyVehicle(id),
    selectVehicle: (id) => gm.selectVehicle(id),
    buyUpgrade: (id) => gm.buyUpgrade(id),
    buyPaint: (id) => gm.buyPaint(id),
    selectPaint: (id) => gm.selectPaint(id),
    buyHorn: (id) => gm.buyHorn(id),
    selectHorn: (id) => gm.selectHorn(id),
    dispose: () => gm.dispose(),
  };
}

export type { GameState, HudData, MissionResultData, GarageView, PurchaseResult };
export type { MissionCategory } from './data/missions';
export type { UpgradeId } from './data/garage';
export { GARAGE_FOOTER, PAINT_FLAVOR } from './data/garage';
export { HORN_FOOTER, HORN_FLAVOR } from './data/horns';
