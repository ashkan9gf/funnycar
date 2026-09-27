/**
 * AssetManager.ts — بارگذاری Assetها با جایگزینی خودکار Placeholder
 * ============================================================
 * ⭐ اصل طلایی (ARCHITECTURE بخش ۵):
 *    Game Logic → شناسه → AssetManager → فایل واقعی یا Placeholder
 *
 * - فایل واقعی موجود بود → همان (گزارش: real)
 * - نبود → PlaceholderFactory + ثبت هشدار (گزارش: placeholder) — بازی ادامه می‌یابد
 * - خطای بارگذاری → هرگز Crash نمی‌کند (قانون Error Handling بخش ۴۶)
 */

import { ASSETS_MANIFEST } from '../data/assets.manifest';
import { createPlaceholder } from '../render/PlaceholderFactory';

export type GameAsset = HTMLImageElement | HTMLCanvasElement;

export interface AssetReport {
  total: number;
  loaded: string[];      // فایل واقعی
  placeholders: string[]; // برچسب‌دار موقت
  missing: string[];      // فایل غایب (placeholder فعال شد)
  errors: string[];
}

export class AssetManager {
  private cache = new Map<string, GameAsset>();
  private report: AssetReport = { total: 0, loaded: [], placeholders: [], missing: [], errors: [] };

  getReport(): AssetReport {
    return this.report;
  }

  /** آیا این شناسه در حال حاضر Placeholder است؟ (برای گزارش Release) */
  isPlaceholder(id: string): boolean {
    return this.report.placeholders.includes(id);
  }

  /**
   * بارگذاری همه Assetهای manifest — انتظار حل می‌شود حتی اگر فایلی نباشد
   */
  async loadAll(onProgress?: (done: number, total: number) => void): Promise<void> {
    const ids = Object.keys(ASSETS_MANIFEST);
    this.report = { total: ids.length, loaded: [], placeholders: [], missing: [], errors: [] };
    let done = 0;

    await Promise.all(
      ids.map(async (id) => {
        try {
          const asset = await this.loadOne(id);
          this.cache.set(id, asset);
        } catch (err) {
          // حتی خطای غیرمنتظره هم بازی را نمی‌بندد
          this.report.errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          done++;
          onProgress?.(done, ids.length);
        }
      }),
    );
  }

  private loadOne(id: string): Promise<GameAsset> {
    const entry = ASSETS_MANIFEST[id];
    if (!entry) return Promise.reject(new Error(`unknown asset id: ${id}`));

    return new Promise<GameAsset>((resolve) => {
      const img = new Image();
      let settled = false;
      const fallback = (): HTMLCanvasElement => {
        this.report.placeholders.push(id);
        this.report.missing.push(id);
        const { placeholder } = entry;
        return createPlaceholder(placeholder.type, placeholder.w, placeholder.h, placeholder.label);
      };

      img.onload = () => {
        if (settled) return;
        settled = true;
        // تصویر صفر‌پیکسلی/خراب = همان رفتار فایل غایب
        if (img.naturalWidth <= 0 || img.naturalHeight <= 0) resolve(fallback());
        else {
          this.report.loaded.push(id);
          resolve(img);
        }
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        resolve(fallback());
      };
      // cache-busting نمی‌گذاریم — مرورگر اجازه کش دارد (آفلاین بودن مهم‌تر است)
      img.src = `/${entry.src}`;
    });
  }

  /**
   * دسترسی به Asset — همیشه چیزی برمی‌گرداند (فایل یا Placeholder)
   */
  get(id: string): GameAsset | undefined {
    return this.cache.get(id);
  }

  /**
   * ابعاد طبیعی Asset (برای مقیاس‌بندی رسم)
   */
  getSize(id: string): { w: number; h: number } {
    const a = this.cache.get(id);
    if (!a) return { w: 0, h: 0 };
    if (a instanceof HTMLImageElement) return { w: a.naturalWidth, h: a.naturalHeight };
    return { w: a.width, h: a.height };
  }
}
