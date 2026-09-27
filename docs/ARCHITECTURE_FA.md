# سند معماری — FunnyCarIR

> نسخه: 1.0 | فاز: Phase 0
>
> این سند توضیح می‌دهد بازی «چطور» ساخته شده است. زبان کد انگلیسی و کامنت‌ها فارسی است (تصمیم پروژه).

---

## 1. نمای کلی (Big Picture)

بازی ما یک **موتور کوچک اختصاصی HTML5** است که داخل یک پروژه Next.js اجرا می‌شود و بعداً با **Capacitor** به APK اندروید تبدیل می‌شود.

سه لایه کاملاً جدا از هم داریم:

```
┌─────────────────────────────────────────────┐
│  لایه ۱: پوسته رابط (React Shell)           │  ← src/app/, src/components/
│  منوها، HUD، دکمه‌های لمسی، تنظیمات (RTL)   │
├─────────────────────────────────────────────┤
│  لایه ۲: موتور بازی (Game Engine)           │  ← src/game/
│  TypeScript خالص — هیچ وابستگی به React!    │
├─────────────────────────────────────────────┤
│  لایه ۳: داده و Asset                       │  ← src/game/data/, public/assets/
│  دیالوگ‌ها، بالانس، manifest تصاویر/صدا     │
└─────────────────────────────────────────────┘
```

**چرا این جداسازی مهم است؟**
- اگر فردا بخواهیم موتور را تغییر دهیم یا بازی را روی پلتفرم دیگری ببریم، لایه ۲ بدون تغییر می‌ماند.
- منطق بازی هرگز مستقیم به یک فایل تصویر اشاره نمی‌کند (بخش 5 همین سند).
- UI فارسی می‌تواند آزادانه تغییر کند بدون اینکه به فیزیک ماشین دست بزنیم.

---

## 2. ماژول‌های موتور بازی (فهرست رسمی کلاس‌ها)

| ماژول | فایل | وظیفه | فاز ساخت |
|---|---|---|---|
| GameManager | `src/game/core/GameManager.ts` | حلقه بازی، ماشین‌حالت کلی (MENU/PLAY/PAUSE)، هماهنگی همه مدیرها | 1 |
| AssetManager | `src/game/core/AssetManager.ts` | بارگذاری تصاویر از manifest + fallback خودکار به Placeholder | 1 |
| InputManager | `src/game/core/InputManager.ts` | جمع‌آوری ورودی لمسی/کیبورد به یک ساختار واحد | 1 |
| Camera | `src/game/core/Camera.ts` | دوربین دنبال‌کننده نرم + لرزش (Screen Shake) | 1 |
| SaveManager | `src/game/core/SaveManager.ts` | ذخیره نسخه‌دار + بازیابی از خرابی | 1 |
| VehicleController | `src/game/entities/Vehicle.ts` | فیزیک ماشین: گاز، ترمز، فرمان، برخورد | 1 |
| World | `src/game/world/World.ts` | نقشه شهر: جاده، ساختمان، prop، نقطه‌های تعامل | 1 |
| WorldRenderer | `src/game/world/WorldRenderer.ts` | رسم دنیا با دوربین (فقط رسم، بدون منطق) | 1 |
| AudioManager | `src/game/managers/AudioManager.ts` | کانال‌های Music/SFX/Voice/UI با WebAudio | 1 |
| VoiceManager | `src/game/managers/VoiceManager.ts` | Pool + Random + Cooldown + Priority برای جملات طنز | 1 |
| DialogueManager | `src/game/managers/DialogueManager.ts` | نمایش حباب دیالوگ (متن فعلاً، صدای ضبطی در آینده) | 1 |
| MissionManager | `src/game/managers/MissionManager.ts` | تعریف/اجرای مأموریت‌ها (Data-Driven) | 4 |
| TrafficManager | `src/game/managers/TrafficManager.ts` | ماشین‌های ترافیک | 3 |
| NPCManager | `src/game/managers/NPCManager.ts` | عابرها و رفتارهای ساده | 5 |
| PoliceManager | `src/game/managers/PoliceManager.ts` | تشخیص تخلف، تعقیب، جریمه | 5-6 |
| FuelManager | `src/game/managers/FuelManager.ts` | مصرف و سوخت‌گیری | 6 |
| EconomyManager | `src/game/managers/EconomyManager.ts` | سکه، خرید، آپگرید | 7 |
| RandomEventManager | `src/game/managers/RandomEventManager.ts` | رویدادهای تصادفی طنز | 6 |
| UIManager (پوسته) | `src/components/game/*` | اتصال وضعیت موتور به رابط React | 1 |

**قانون ارتباط بین ماژول‌ها:** ماژول‌ها به‌صورت «تزریق وابستگی ساده» همدیگر را می‌شناسند (GameManager همه را می‌سازد و به همدیگر وصل می‌کند). هیچ ماژولی `new` از ماژول دیگر داخل خودش نمی‌زند تا تست‌پذیری حفظ شود.

---

## 3. حلقه بازی (Game Loop)

```text
requestAnimationFrame (تا 60fps)
↓
InputManager.collect()          ← وضعیت دکمه‌ها را می‌خواند
↓
[Fixed Timestep × N]            ← فیزیک با گام ثابت 120Hz (مستقل از سرعت صفحه‌نمایش)
   Vehicle.update(dt)
   Managers.update(dt)
↓
Camera.update()                 ← دنبال کردن نرم ماشین
↓
WorldRenderer.draw()            ← رسم یک فریم کامل
↓
(اگر فریم عقب افتاد → حداکثر ۵ گام فیزیک اجرا می‌شود، بقیه دور ریخته می‌شود = «Spiral of Death» نمی‌گیریم)
```

**چرا Fixed Timestep؟** چون فیزیک ماشین باید روی گوشی 60Hz و 90Hz و 120Hz دقیقاً یکسان رفتار کند و تست‌ها قابل تکرار باشند.

---

## 4. رزولوشن و مقیاس‌بندی

- **رزولوشن منطقی بازی:** 720×1280 (عمودی) — همه محاسبات با این اعداد انجام می‌شود.
- Canvas واقعی = اندازه پنجره × devicePixelRatio (محدود به 2 برای صرفه‌جویی رم).
- مقیاس با `ctx.setTransform` اعمال می‌شود؛ هیچ کدی «اندازه صفحه» را نمی‌داند.

---

## 5. ⭐ اصل طلایی: جدایی منطق از Asset (قانون بخش ۵۶ سند مادر)

Game Logic هرگز مسیر فایل تصویر را نمی‌داند. جریان همیشه این است:

```text
Game Logic
     ↓  می‌گوید: من «veh_player_01» می‌خواهم
AssetManager (manifest را چک می‌کند)
     ↓  اگر فایل واقعی موجود بود → همان را می‌دهد
     ↓  اگر نبود → Placeholder برچسب‌دار می‌سازد + هشدار ثبت می‌کند
Actual Asset (تصویر واقعی یا placeholder)
```

نتیجه: **جایگزینی Asset بدون حتی یک خط تغییر کد.** کافی است فایل جدید را با همان نام در همان پوشه بگذارید (راهنمای کامل: ASSET_IMPORT_GUIDE_FA.md).

Manifest تمام Assetها: `src/game/data/assets.manifest.ts` — تنها جایی که «شناسه → مسیر فایل» نگه‌داری می‌شود.

---

## 6. سیستم Placeholder

هر Asset در manifest یک «مشخصات Placeholder» دارد (اندازه، نوع، برچسب). اگر فایل واقعی نبود، `PlaceholderFactory` یک تصویر برنامه‌ای با متن انگلیسی واضح مثل `PLACEHOLDER_VEHICLE` می‌کشد. این سه اصل رعایت می‌شود:

1. Placeholder همیشه **برچسب واضح** دارد (تا هرگز با Asset واقعی اشتباه نشود).
2. کد بازی **تفاوتی بین آن‌ها نمی‌گذارد** — یعنی ساختار «قابل جایگزینی» تست می‌شود.
3. ابزار `scripts/validate_assets.mjs` قبل از هر Release لیست همه Placeholderهای باقی‌مانده را گزارش می‌دهد (قانون بخش ۳۲).

---

## 7. سیستم ذخیره (Save System)

- محل ذخیره: `localStorage` با کلید `funnycarir_save` (در Capacitor همان localStorage پایدار است).
- ساختار نسخه‌دار:

```json
{
  "version": 1,
  "coins": 0,
  "reputation": 50,
  "unlockedVehicles": ["veh_player_01"],
  "selectedVehicle": "veh_player_01",
  "completedMissions": [],
  "settings": { "music": 0.8, "sfx": 0.9, "voice": 1.0, "vibration": true },
  "progress": { "tutorialDone": false }
}
```

- **Migration:** وقتی نسخه جدید بازی ساختار را عوض کند، تابع migrate از نسخه قبلی به جدید ارتقا می‌دهد.
- **Recovery:** اگر JSON خراب باشد → از `funnycarir_save_backup` (نسخه قبلی هر ذخیره موفق) بازیابی می‌شود؛ اگر آن هم خراب بود → ذخیره جدید با حفظ تنظیمات صدا.
- ذخیره فقط در نقاط امن (پایان مأموریت، تغییر تنظیمات، خروج از گیم‌پلی) انجام می‌شود.

---

## 8. مدیریت خطا (Error Handling)

| خطا | رفتار سیستم |
|---|---|
| Asset گم‌شده | Placeholder + ثبت در گزارش؛ بازی ادامه می‌یابد |
| Save خراب | بازیابی از backup → ساخت save نو؛ هیچ Crash |
| خطای WebAudio | صدا بی‌صدا خاموش می‌شود؛ بازی ادامه می‌یابد |
| خطای بارگذاری صحنه/داده | پیام فارسی دوستانه «ای بابا! یه چیزی خوابش برد. دوباره امتحان کن» + دکمه تلاش مجدد |
| State غیرمنتظره گیم‌پلی | بازگشت امن به منوی اصلی + ثبت لاگ |
| حلقه بازی Exception | catch در سطح فریم: فریم جا می‌افتد ولی بازی متوقف نمی‌شود |

اصل: **«هیچ خطایی نباید بازی را ببندد؛ بدترین حالت، از دست دادن یک قابلیت است نه کل بازی.»**

---

## 9. صدا (Audio Architecture)

AudioManager با **Web Audio API** چهار کانال جدا دارد: Music / SFX / Voice / UI — هر کدام Volume مستقل از تنظیمات.

در Phase 1 افکت‌ها **سینتز شده** (تولیدشده با oscillator/noise در کد) هستند تا بازی کاملاً آفلاین و بدون فایل صوتی کار کند. ساختار طوری است که در فاز 9 فایل‌های OGG/MP3 جایگزین شوند بدون تغییر هیچ کد فراخوانی (همان اصل جدایی از Asset).

VoiceManager مستقل است و قبل از پخش هر جمله: Pool → Random → Cooldown (همان صدا، همان رویداد، همان کاراکتر) → Priority Check.

```
اولویت‌ها (بزرگ‌تر = مهم‌تر):
5  Critical (تصادف جدی / خاموشی موتور)
4  Mission
3  Police
2  Passenger
1  Random Funny
0  Ambient
```

---

## 10. استراتژی پرفورمنس (از روز اول)

| تکنیک | جایی که استفاده می‌شود |
|---|---|
| Fixed Timestep + interpolation | کل حلقه بازی |
| عدم تخصیص حافظه در حلقه داغ (بدون new در update) | فیزیک، رسم |
| Object Pooling | ذرات (دود، جرقه)، سکه‌ها (فاز 7) |
| Culling (رسم فقط آنچه در کادر دوربین است) | WorldRenderer |
| محدود کردن dpr به 2 | Canvas setup |
| Texture بودج: حداکثر ~40MB رم تصویر | بودج‌بندی در ASSET_INVENTORY |
| Atlas (چسباندن تصاویر کوچک) | فاز 11 برای UI و Iconها |
| بدون فریم‌ورک خارجی سنگین | موتور اختصاصی سبک (~بدون وابستگی runtime) |

**ابزار سنجش:** در Buildهای Debug، یک نمایشگر FPS/Frame-Time اختیاری (کلید F) وجود دارد؛ تست واقعی روی دستگاه طبق TEST_PLAN انجام می‌شود، نه بر اساس حدس.

---

## 11. ساختار پوشه‌های کد

```text
src/
├── app/                      # لایه Next.js (فقط یک route: /)
│   ├── layout.tsx            # فونت وزیرمتن + RTL
│   └── page.tsx              # پوسته بازی: Canvas + منوها + HUD
├── components/
│   └── game/                 # کامپوننت‌های React مخصوص بازی (HUD، دکمه لمسی...)
└── game/                     # ⭐ موتور بازی — TypeScript خالص، بدون React
    ├── core/                 # GameManager, AssetManager, InputManager, Camera, SaveManager
    ├── entities/             # Vehicle
    ├── world/                # World, WorldRenderer
    ├── managers/             # AudioManager, VoiceManager, DialogueManager, ...
    ├── render/               # PlaceholderFactory, SpeechBubbleRenderer
    ├── data/                 # assets.manifest.ts, dialogues.ts, balance.ts  (Data-Driven)
    └── index.ts              # نقطه ورود: createGame(canvas, callbacks)

public/
├── assets/                   # ⭐ Assetهای واقعی — طبق ساختار سند ASSET_INVENTORY
│   ├── vehicles/  characters/  npc/  environments/  props/
│   ├── ui/  icons/  effects/  animations/
│   ├── audio/music  audio/sfx  audio/voices  ambient
│   └── fonts/  loading/  localization/
└── fonts/                    # فونت‌های وب (وزیرمتن — مجوز OFL آزاد)

scripts/
├── validate_assets.mjs       # ابزار اعتبارسنجی Asset (بخش ۳۰ سند مادر)
└── process_batch1.py         # پردازش تصاویر Batch 1 (حذف پس‌زمینه + بهینه‌سازی)

docs/                         # مستندات فارسی پروژه
```

---

## 12. مسیر تبدیل به APK اندروید (نقشه راه Capacitor)

بازی HTML5 ما با Capacitor (ابزار رسمی و رایگان Ionic) داخل یک Webview بومی اندروید اجرا می‌شود. در فاز 13 این مراحل انجام می‌شود (همه مستند در BUILD_GUIDE_FA.md آینده):

```text
1. npm i @capacitor/core @capacitor/cli @capacitor/android
2. npx cap init FunnyCarIR ir.funnycar.game
3. next build + export  →  خروجی استاتیک
4. npx cap add android   →  پروژه اندروید ساخته می‌شود
5. npx cap sync          →  فایل‌های بازی داخل پروژه اندروید کپی می‌شوند
6. Android Studio → Build APK / AAB
```

نکته: در فاز 1 هیچ وابستگی کد به Capacitor وجود ندارد؛ فقط ساختار طوری است که مرحله بالا «افزودن» است نه «بازنویسی».

---

## 13. تصمیم‌های معماری و دلیلشان (Architecture Decision Log)

| # | تصمیم | دلیل |
|---|---|---|
| A-1 | موتور اختصاصی سبک به‌جای Phaser/Unity WebGL | حجم خروجی کوچک‌تر (~شروع سریع)، کنترل کامل، بدون وابستگی؛ فیزیک ما ساده است و نیازی به موتور سنگین ندارد |
| A-2 | Canvas 2D به‌جای WebGL | برای تعداد اسپرایت کمِ ما (~کمتر از 150 در فریم) Canvas 2D روی موبایل کاملاً کافی و پایدارتر است؛ مهاجرت به WebGL در فاز 11 فقط اگر Profiler لازم بداند |
| A-3 | React فقط برای UI بیرون Canvas | متن فارسی/RTL در DOM بی‌نقص است؛ Canvas برای متن فارسی شکننده‌تر است. پس HUD و منوها DOM هستند |
| A-4 | Data-Driven برای دیالوگ/بالانس/manifest | نوشتن و تغییر محتوا بدون ریسک شکستن کد — ضروری برای کاربر غیرمتخصص |
| A-5 | localStorage برای Save | آفلاین، ساده، بدون سرور؛ در Capacitor پایدار است. (اگر آینده نیاز به Cloud شد، SaveManager تنها نقطه تغییر است) |
| A-6 | TypeScript strict | جلوگیری از کلاس خطاهای رایج در رفکتور؛ مهم برای پروژه‌ای که مراحل طولانی دارد |
