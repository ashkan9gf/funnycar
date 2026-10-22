/**
 * AssetManager.ts — بارگذاری Assetها با جایگزینی خودکار Placeholder
 * ============================================================
 * ⭐ اصل طلایی (ARCHITECTURE بخش ۵):
 *    Game Logic → شناسه → AssetManager → فایل واقعی یا Placeholder
 *
 * - فایل واقعی موجود بود → همان (گزارش: real)
 * - نبود → PlaceholderFactory + ثبت هشدار (گزارش: placeholder) — بازی ادامه می‌یابد
 * - خطای بارگذاری → هرگز Crash نمی‌کند (قانون Error Handling بخش ۴۶)
 * - فاز 7: فایل‌های صوتی (.ogg/.mp3/.wav) → AudioBuffer با decodeAudioData
 *   (OfflineAudioContext — بدون نیاز به تعامل کاربر)
 */

import { ASSETS_MANIFEST, type AssetEntry } from '../data/assets.manifest';
import { createPlaceholder } from '../render/PlaceholderFactory';

export type GameAsset = HTMLImageElement | HTMLCanvasElement | AudioBuffer;

const AUDIO_EXT = /\.(ogg|mp3|wav)$/i;
const ASSET_TIMEOUT_MS = 15_000;

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
          // حتی خطای غیرمنتظره هم باید به asset قابل‌استفاده ختم شود؛ undefined در
          // رندر مسیرهای بعدی می‌تواند باعث کرش زنجیره‌ای شود.
          this.report.errors.push(`${id}: ${err instanceof Error ? err.message : String(err)}`);
          const entry = ASSETS_MANIFEST[id];
          if (entry) {
            this.report.placeholders.push(id);
            this.report.missing.push(id);
            this.cache.set(id, createPlaceholder(
              entry.placeholder.type,
              entry.placeholder.w,
              entry.placeholder.h,
              entry.placeholder.label,
            ));
          }
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

    // ---------- مسیر صوتی (فاز 7): fetch + decode → AudioBuffer ----------
    if (AUDIO_EXT.test(entry.src)) return this.loadAudio(id, entry);

    return new Promise<GameAsset>((resolve) => {
      const img = new Image();
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(fallback());
      }, ASSET_TIMEOUT_MS);
      const fallback = (): HTMLCanvasElement => {
        this.report.placeholders.push(id);
        this.report.missing.push(id);
        const { placeholder } = entry;
        return createPlaceholder(placeholder.type, placeholder.w, placeholder.h, placeholder.label);
      };

      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
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
        clearTimeout(timeoutId);
        resolve(fallback());
      };
      // cache-busting نمی‌گذاریم — مرورگر اجازه کش دارد (آفلاین بودن مهم‌تر است)
      img.src = `/${entry.src}`;
    });
  }

  /**
   * بارگذاری فایل صوتی به AudioBuffer — هر خطا → Placeholder (بازی ادامه می‌یابد)
   * decodeAudioData روی OfflineAudioContext بدون gesture کاربر هم کار می‌کند.
   */
  private async loadAudio(id: string, entry: AssetEntry): Promise<GameAsset> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ASSET_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(`/${entry.src}`, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.arrayBuffer();
      const OAC = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      if (!OAC) throw new Error('OfflineAudioContext unavailable');
      const octx = new OAC(1, 1, 44100);
      const buf = await octx.decodeAudioData(arr);
      this.report.loaded.push(id);
      return buf;
    } catch (err) {
      this.report.placeholders.push(id);
      this.report.missing.push(id);
      const { placeholder } = entry;
      return createPlaceholder(placeholder.type, placeholder.w, placeholder.h, placeholder.label);
    }
  }

  /**
   * دسترسی به Asset — همیشه چیزی برمی‌گرداند (فایل یا Placeholder)
   */
  get(id: string): GameAsset | undefined {
    return this.cache.get(id);
  }

  /**
   * ابعاد طبیعی Asset (برای مقیاس‌بندی رسم) — AudioBuffer اندازه ندارد
   */
  getSize(id: string): { w: number; h: number } {
    const a = this.cache.get(id);
    if (!a || a instanceof AudioBuffer) return { w: 0, h: 0 };
    if (a instanceof HTMLImageElement) return { w: a.naturalWidth, h: a.naturalHeight };
    return { w: a.width, h: a.height };
  }
}
