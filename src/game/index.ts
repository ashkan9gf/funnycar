/**
 * index.ts — نقطه ورود موتور بازی
 * ============================================================
 * پوسته React فقط با این توابع صحبت می‌کند؛ هیچ کامپوننتی مستقیماً
 * به کلاس‌های داخلی موتور دست نمی‌زند (مرز لایه‌ها — ARCHITECTURE بخش ۱)
 */

import { GameManager, type GameCallbacks, type GameState, type HudData } from './core/GameManager';

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
  getSettings: () => { music: number; sfx: number; voice: number; vibration: boolean };
  getSave: () => { coins: number; reputation: number };
  toggleDebugFps: () => void;
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
    getSettings: () => gm.getSettings(),
    getSave: () => gm.getSave(),
    toggleDebugFps: () => gm.toggleDebugFps(),
    dispose: () => gm.dispose(),
  };
}

export type { GameState, HudData };
