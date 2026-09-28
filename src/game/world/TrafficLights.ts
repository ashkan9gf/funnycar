/**
 * TrafficLights.ts — چراغ راهنمای تقاطع‌ها (فاز GRAPHICS_OVERHAUL)
 * ============================================================
 * چرخه کامل هر تقاطع: سبز NS → زرد NS → همه‌قرمز → سبز EW → زرد EW → همه‌قرمز
 * آفست هر تقاطع = (i + j) × offsetStep → «موج سبز» مثل خیابان‌های واقعی
 * توابع حالت Pure هستند (تابع زمان) — منطق AI و رندر هر دو از همین می‌خوانند.
 */

import { TRAFFIC_LIGHTS } from '../data/balance';

export type LightState = 'green' | 'yellow' | 'red';

/** مجموع چرخه (ثانیه) */
const CYCLE =
  TRAFFIC_LIGHTS.greenSec + TRAFFIC_LIGHTS.yellowSec + TRAFFIC_LIGHTS.allRedSec +
  TRAFFIC_LIGHTS.greenSec + TRAFFIC_LIGHTS.yellowSec + TRAFFIC_LIGHTS.allRedSec;

export class TrafficLights {
  /** زمان شبیه‌سازی انباشته (ثانیه) — در GameManager.step به‌روز می‌شود */
  time = 0;

  update(dt: number): void {
    this.time += dt;
  }

  /** آفست موج سبز برای تقاطع (i,j) */
  private offset(i: number, j: number): number {
    return ((i + j) * TRAFFIC_LIGHTS.offsetStepSec) % CYCLE;
  }

  /** حالت چراغ محور شمالی-جنوبی در تقاطع (i,j) */
  stateNS(i: number, j: number, time: number = this.time): LightState {
    const t = (time + this.offset(i, j)) % CYCLE;
    const G = TRAFFIC_LIGHTS.greenSec;
    const Y = TRAFFIC_LIGHTS.yellowSec;
    if (t < G) return 'green';
    if (t < G + Y) return 'yellow';
    return 'red';
  }

  /** حالت چراغ محور شرقی-غربی در تقاطع (i,j) */
  stateEW(i: number, j: number, time: number = this.time): LightState {
    const t = (time + this.offset(i, j)) % CYCLE;
    const P = TRAFFIC_LIGHTS.greenSec + TRAFFIC_LIGHTS.yellowSec + TRAFFIC_LIGHTS.allRedSec;
    const G = TRAFFIC_LIGHTS.greenSec;
    const Y = TRAFFIC_LIGHTS.yellowSec;
    const u = t - P;
    if (u >= 0 && u < G) return 'green';
    if (u >= G && u < G + Y) return 'yellow';
    return 'red';
  }

  /**
   * حالت محور حرکت داده‌شده
   * @param axis 'v' = جاده عمودی (حرکت N/S)، 'h' = جاده افقی (حرکت E/W)
   */
  stateFor(axis: 'v' | 'h', i: number, j: number, time: number = this.time): LightState {
    return axis === 'v' ? this.stateNS(i, j, time) : this.stateEW(i, j, time);
  }

  /** آیا با این حالت باید ایست کرد؟ (زرد = فقط اگر هنوز نزدیک نیامده — تصمیم با caller) */
  static isStop(state: LightState): boolean {
    return state === 'red';
  }
}
