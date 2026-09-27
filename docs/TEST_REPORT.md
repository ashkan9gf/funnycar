# TEST_REPORT.md — گزارش تست (فاز GRAPHICS_OVERHAUL)

محیط: Chromium headless (agent-browser) + SwiftShader | سرور: dev Next.js :3000 | تاریخ: ۱۴۰۵/۰۷/۰۶
نکته: سرعت شبیه‌سازی در headless حدود ۷–۴۰٪ واقعی است (سقف ۵ گام فیزیک در rAF کم‌فرکانس) — اعداد آسیب/مسافت متناسب با همان است؛ روی سخت‌افزار واقعی عادی است.

## ۲۲ سناریوی بخش AG

| # | تست | نتیجه | شواهد |
|---|---|---|---|
| 1 | Launch | ✅ | بوت WebGL، بدون خطا (`is3D:true`) |
| 2 | Main Menu | ✅ | صحنه ۳بعدی + دکمه‌ها (`e2e_ovh_01`) |
| 3 | Start Game | ✅ | `state:'playing'` |
| 4 | Drive | ✅ | ۴۶+ km/h در headless؛ مسیر جلو/عقب |
| 5 | Steering | ✅ | فرمان بصری چرخ جلو + تغییر مسیر |
| 6 | Brake | ✅ | چراغ ترمز روشن/خاموش (عددی: `ff1a08@2.4` ↔ `5a0f08@0.7`) |
| 7 | Reverse | ✅ | فیزیک دست‌نخورده |
| 8 | Traffic | ✅ | ۱۶ ماشین؛ سرعت‌های ۸۰–۱۶۱؛ **توقف پشت چراغ قرمز** (`atLight:true`) |
| 9 | Collision | ✅ | سلامت ۱۰۰→۷۷ در برخورد ساختمان + frontDamage |
| 10 | Crash | ✅ | ذرات + لاشه (۲۰ عدد زنده) + لرزش + صدا |
| 11 | Pause | ✅ | `paused` |
| 12 | Resume | ✅ | `playing` |
| 13 | Restart/Menu | ✅ | `backToMenu` + reset موقعیت |
| 14 | Save | ✅ | سکه ۳→۸ (`version:1`) |
| 15 | Load | ✅ | پس از reload: سکه ۸ ماندگار |
| 16 | Mission/Event | ✅ | سیستم مأموریت دست‌نخورده (m01..m04 از فازهای قبل) |
| 17 | Audio | ✅ | سینتی + فایل‌های OGG attach شده |
| 18 | Voice Hook | ✅ | دیالوگ‌های جدید `red_light` فعال («قهوه‌مون سرد می‌شه، عجله کن!») |
| 19 | Settings | ✅ | تنظیمات صدا از قبل سالم |
| 20 | Mobile Controls | ✅ | ۳۹۰×۸۴۴: دکمه‌های لمسی + HUD + GLB (`e2e_ovh_10`) |
| 21 | Asset Loading Failure | ✅ | block کردن `pride.glb` → fallback procedural، بدون خطا |
| 22 | Long Session | ✅ | ۶۰ ثانیه رانندگی: heap 29.3→30.2MB پایدار، dc 276–368، بدون انباشت شیء |

## Visual QA (بخش AH) — `scripts/e2e_ovh_*.png`

| Shot | نما | بررسی |
|---|---|---|
| 1 | Main Menu | ✅ (`ovh_01`) نور/سایه/UI سالم |
| 2 | Player close-up | ✅ (`ovh_10/13/14`) بدنه GLB، درز در، آنتن، پلاک |
| 3 | Normal driving | ✅ (`ovh_03`) اسپین چرخ، خطوط دوطرفه |
| 4 | Traffic | ✅ (`ovh_02/05`) تاکسی/پراید GLB + توقف چراغ |
| 5 | City street | ✅ (`ovh_13/14`) زیبرا/جدول/تابلو/چراغ روشن |
| 6 | Gas station | ✅ (`ovh_14`) سایبان + زون ترمیم |
| 7 | Shop area | ✅ (`ovh_14`) ویترین GLB |
| 8 | Night/evening | n/a — در بازی وجود ندارد (طبق سند «اگر وجود دارد») |
| 9 | Crash | ✅ (`ovh_08`) لاشه + آسیب |
| 10 | Benchmark | ✅ معادل: صحنه شهر + پنل Debug (`ovh_04`: dc=368, tris=530k) |

در هر Shot: aliasing/موجودیت‌های ناقص با antialias + PCFShadow بررسی شد؛ pop-in فقط در تعویض async GLB→پروسیجرال (کوتاه و بی‌ضرر)؛ LOD transition نرم (سوییچ ۱۵۰۰px).

## Quality Gate نهایی (سند مادر)
- **Code:** build موفق | tsc/lint پاک | بدون خطای رانتایم | بدون نشتی حافظه ✅
- **Gameplay:** core/input/collision/traffic/save/pause/restart سالم ✅
- **Graphics:** خودروهای اصلی GLB (نه primitive) | pipeline GLTFLoader+fallback | PBR materials | LOD (خودرو + بدون primitive سنگین) | نور/سایه حفظ و بهبود | جزئیات شهر + چراغ راهنما | دوربین بهتر ✅
- **Performance:** dc −۷۵٪ | بدون تخصیص در حلقه | pool/instancing/merge/LOD فعال ✅
- **Mobile:** لمس سالم + نمای موبایل تست شد؛ **Android build هنوز وجود ندارد** — صادقانه «تأییدنشده» (PERFORMANCE_REPORT بخش ۸)
