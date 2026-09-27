# PERFORMANCE_REPORT.md — گزارش پرفورمنس (فاز GRAPHICS_OVERHAUL)

## اندازه‌گیری (Baseline → After)

سنجش واقعی از داخل بازی با `renderer.info` و شمارش صحنه — مرورگر headless/Chromium (SwiftShader نرم‌افزاری؛ همان روش ثبت‌شده در فازهای قبلی).

| سنجه | Baseline (قبل) | بعد از Overhaul | تغییر |
|---|---|---|---|
| **Draw Calls (منو)** | 1432 | **289** | **−۸۰٪** |
| **Draw Calls (گیم‌پلی)** | 1439 | **276–368** | **−۷۵٪** |
| Object Count صحنه | 3737 | **965** | **−۷۴٪** |
| Triangles | 78,648 | ~530,000 | + جزئیات واقعی GLB (معقول برای GPU موبایل) |
| Geometries | 1889 | 302 | −۸۴٪ |
| InstancedMesh | 7 (سکه/اسکید/ذرات…) | 20 (+ دوبله‌ها/پراپ‌ها/چراغ‌ها) | پولینگ گسترده |
| Heap (JS) پس از ۶۰ ثانیه | — | 29.3 → 31.2 → 30.2 MB | **پایدار — بدون نشتی** |

## Optimizations انجام‌شده (بخش Q و AA سند مادر)

1. **Merge استاتیک‌ها:** جاده‌ها (۱۴→۱)، تقاطع‌ها (۴۹→۱)، پیاده‌رو/چمن/حیاط (۷۲→۳) — با `mergeGeometries` + ترنسفورم baked.
2. **Instancing دوبله‌پارکی‌ها:** ۹۰ ماشین × ~۱۹ مش (=~۱۷۰۰ Draw Call) → **۶ InstancedMesh** با `instanceColor` برای رنگ‌های متنوع پراید/۴۰۵/تیبا/نیسان/سمند.
3. **Instancing پراپ‌ها:** درخت/سطل/مخروط/جعبه/کیسه/موتور/تیر → ۷ InstancedMesh؛ شکستنی‌ها با scale=0 مخفی/ظاهر می‌شوند (فقط هنگام تغییر state، نه هر فریم).
4. **چراغ راهنما:** ۴۹ تیر = ۱ Draw Call + ۳ InstancedMesh لامپ (قرمز/زرد/سبز) — update ماتریس فقط هنگام تغییر رنگ.
5. **LOD خودرو:** ترافیک از فاصله > 1500px به نسخه `*_lod1.glb` (۹۸۴→۹۴۸ tri، بدون جزئیات ریز) سوییچ می‌کند — ۸ فایل LOD1 تولید شد.
6. **Vertex-Color به‌جای متریال تکی:** کل ساختمان/پراپ با ۱ متریال مشترک رندر می‌شود.
7. **بدون تخصیص در حلقه رندر:** همه Matrix4/Quaternion/Vector موقت به‌صورت فیلد reused؛ sync لامپ‌ها/شکستنی‌ها فقط در تغییر state.
8. **pooling ذرات:** سقف `particleMax + DEBRIS.maxCount` — بدون runaway.

## بودجه موبایل (بخش Z و AA)
- هدف سند: 30 FPS حداقل / 45+ مطلوب. با ~۳۰۰ Draw Call و ~۵۳۰k tri (ذره‌بین‌شده نسبت به قبل در جزئیات، ۷۵٪ کمتر در Draw Call) این صحنه در بازه سخت‌افزارهای mid-range اندرویدی با GPU واقعی قرار می‌گیرد. نکته: FPS پایین (~۱۰) در تست‌های ما فقط مخصوص headless SwiftShader است و معیار سخت‌افزار واقعی نیست (مستند در فازهای 3D/BIG-IR نیز).
- `devicePixelRatio` روی ۱ قفل است (پیشنهاد ما برای فاز Capacitor: 1.5 روی پرچم‌دارها).
- سایه: PCF 1024 — بدون افزایش بی‌دلیل (بخش L).

## Memory Leak Audit (بخش AB)
- `addEventListener/removeEventListener` جفت‌اند (`handleResize/onKeyDown/onVisibility/onBeforeUnload` در dispose).
- `requestAnimationFrame` با گارد `disposed` و `GameManager.live` لغو می‌شود.
- `scene.add/remove` ترافیک‌های بازیافت‌شده ✓ (تست E2E).
- `geometry/material.dispose` در `dispose()` رندرر (کانتکت WebGL عمداً باز می‌ماند — کانواس در StrictMode استفاده مجدد می‌شود؛ تصمیم مستند فاز 3D).
- Long Session ۶۰ ثانیه‌ای: heap پایدار (جدول بالا) + شمارش اشیاء ثابت.

## PHASE 8 — Android Validation (شفاف)
Capacitor/Android wrapper هنوز در پروژه بوت نشده است (طبق نقشه راه اولیه، پس از تثبیت گیم‌پلی). گام‌های باقی‌مانده:
1. `bunx cap add android` + تنظیم `webDir`
2. تست لمس/جهت/صدا روی دستگاه واقعی
3. اندازه‌گیری FPS واقعی GPU (هدف 30+ روی low-end)
این مورد «تأییدنشده» اعلام می‌شود و به‌عنوان فاز بعدی پیشنهاد می‌گردد.
