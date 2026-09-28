# BUG_FIX_REPORT.md — گزارش رفع باگ (فاز GRAPHICS_OVERHAUL)

طبق بخش A سند مادر، ابتدا Audit کامل انجام شد و سپس باگ‌های یافته رفع شدند.

## خلاصه Audit (قبل از تغییر)

| بررسی | وضعیت | نتیجه |
|---|---|---|
| TypeScript (`tsc --noEmit`) | ✅ | صفر خطا در `src/` (خطاهای `examples/` و `skills/` خارج از پروژه بازی‌اند) |
| ESLint | ✅ | بدون خطا |
| Production Build (`bun run build`) | ✅ | موفق |
| Runtime Errors (کنسول مرورگر) | ✅ | بدون خطا |
| State Bugs (StrictMode/Pause/Restart) | ✅ | گارد `GameManager.live` سر جاست — تست دوباره تأیید شد |
| Save/Load | ✅ | version=1، سکه/آبرو بین رفرش ماندگار |
| Asset Loading | ✅ | fallback کامل؛ صفر Placeholder در manifest |
| Memory Leak | ✅ | dispose کامل رندرر + Long Session پایدار (بخش TEST_REPORT) |

## باگ‌های یافته و رفع‌شده در حین Overhaul

### BUG-1: کرش کامل بوت با merge هندسه‌ها
- **محل:** `vehicleGeometry.ts → mergeParts` + `WorldRenderer3D → mergeColored`
- **علت:** `ExtrudeGeometry` غیر-indexed و `BoxGeometry/CylinderGeometry` ایندکس‌شده‌اند؛ `mergeGeometries` فقط با «همه ایندکس‌دار» یا «هیچ‌کدام» کار می‌کند → برگشت null → خطا در سازنده رندرر → بازی بالا نمی‌آمد.
- **رفع:** نرمال‌سازی همه ورودی‌های merge با `toNonIndexed()` قبل از ادغام.
- **تست:** بوت مجدد + کنسول پاک + رندر صحیح همه mergeها.
- **وضعیت:** ✅ رفع شد

### BUG-2: لامپ‌های چراغ راهنما داخل جعبه مخفی بودند
- **محل:** `WorldRenderer3D → buildTrafficLights`
- **علت:** کره لامپ (r=7) کاملاً داخل جعبه ۲۶×۷۴×۲۲ قرار می‌گرفت؛ از هیچ زاویه‌ای دیده نمی‌شد.
- **رفع:** طراحی سر چراغ به‌صورت «پنل دوردیفه» (نازک) + لامپ‌های برجسته در هر دو وجه — برای هر دو جهت تردد.
- **وضعیت:** ✅ رفع شد

### BUG-3: شرط روشن بودن لامپ معکوس بود
- **محل:** `WorldRenderer3D → updateTrafficLightLamps`
- **علت:** شرط `nsCode === (2 - k)` لامپ قرمز را هنگام سبز روشن می‌کرد.
- **رفع:** شرط صحیح `nsCode === k` (قرمز=0، زرد=1، سبز=2).
- **وضعیت:** ✅ رفع شد

### BUG-4: اندیس نمونه لامپ‌ها ناسازگار
- **محل:** `updateTrafficLightLamps`
- **علت:** پس از تغییر به ۴ نمونه در هر تقاطع، شماره‌گذاری `idx*2` می‌ماند → نمونه‌های آخر با ماتریس همانی در مبدأ دنیا ظاهر می‌شدند.
- **رفع:** شماره‌گذاری `idx*4` هم‌اندازه با ظرفیت InstancedMesh.
- **وضعیت:** ✅ رفع شد

### BUG-5 (بهبود): تیرگی‌شدن آسیب با رول بدنه تداخل داشت
- **محل:** `CarFactory3D → applyDamageVisual`
- **علت:** کجی آسیب مستقیماً `rotation.z` گروه را تغییر می‌داد و با رول دینامیک جدید جمع نمی‌شد.
- **رفع:** انباشت کجی در فیلد `damageTiltZ` و اعمال ترکیبی در `draw3D`: `rotation.z = damageTiltZ + rollZ`.
- **وضعیت:** ✅ رفع شد

## نتیجه نهایی
`src/` بدون خطای TypeScript و ESLint | Build موفق | کنسول مرورگر بدون خطا و هشدار | همه قابلیت‌های قبل سالم (رگرسیون صفر).
