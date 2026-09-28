# راهنمای وارد کردن Asset به بازی — FunnyCarIR

> نسخه: 1.0 | فاز: Phase 0
>
> خبر خوب: چون معماری بازی **Data-Driven** است، وارد کردن Asset تقریباً همیشه «کپی فایل در پوشه درست» است — بدون هیچ تغییری در کد. این سند همه حالت‌ها را دقیق توضیح می‌دهد.

---

## 1. سه قانون اصلی

1. **نام فایل = شناسه Asset.** بازی فایل را با نام می‌شناسد، نه با محتوا. نام باید دقیقاً مطابق `ASSET_INVENTORY_FA.md` باشد (حروف کوچک، بدون فاصله).
2. **مسیر = مسیر جدول Inventory.** حرف بزرگ/کوچک و زیرپوشه‌ها مهم‌اند.
3. **بدون تغییر کد.** اگر مجبور شدید برای یک Asset معمولی کد را عوض کنید، یعنی چیزی را اشتباه رفته‌اید.

---

## 2. حالت‌های Import

### حالت A — جایگزینی یک Asset موجود (رایج‌ترین حالت)

مثال: ماشین بازیکن واقعی آماده شده و باید جای Placeholder بنشیند.

```text
فایل قدیمی (placeholder):  public/assets/vehicles/player/veh_player_01.png
فایل جدید (واقعی):         public/assets/vehicles/player/veh_player_01.png
```

1. فایل جدید را با **همان نام دقیق** در **همان مسیر** کپی کنید (روی قدیمی بازنویسی).
2. صفحه بازی را رفرش کنید (یا Cache دوباره بارگذاری شود).
3. تمام — AssetManager خودکار فایل واقعی را می‌خواند و برچسب PLACEHOLDER حذف می‌شود. ✅

> این همان تضمین بخش ۳۱ سند مادر است: «جایگزینی بدون دست‌کاری منطق بازی».

### حالت B — اضافه کردن Asset جدیدی که در Inventory هست ولی هنوز در manifest نیست

(وقتی Asset برای یک فاز آینده است و هنوز کد از آن استفاده نکرده.)

1. فایل را در مسیر جدول Inventory بگذارید.
2. یک ردیف به `src/game/data/assets.manifest.ts` اضافه کنید:

```ts
// ⭐Asset جدید — طبق ASSET_INVENTORY VEH-006
'veh_wedding_01': {
  src: 'assets/vehicles/special/veh_wedding_01.png',
  placeholder: { type: 'vehicle', w: 256, h: 448, label: 'PLACEHOLDER_VEHICLE' },
},
```

3. همین. (بازی تا وقتی کد از آن نخواهد، اصلاً بارگذاری‌اش نمی‌کند — بهینه.)

### حالت C — Asset کاملاً جدید (در Inventory هم نیست)

1. اول Inventory را آپدیت کنید (ردیف با ID جدید: VEH-010، PROP-010...).
2. بعد حالت B را انجام دهید.
3. اگر سبک/ابعاد جدیدی است، از هندبوک بخش ۲ برای مشخصات کمک بگیرید.

### حالت D — فایل صوتی (Voice/SFX/Music)

همان قوانین حالت A/B با این تفاوت‌ها:
- مسیر: `public/assets/audio/...` طبق جدول (voices در زیرپوشه شخصیت).
- فرمت: OGG. اگر فقط MP3 دارید: Audacity → Export → OGG.
- VoiceManager جمله را با ID رویداد می‌خواند (`voice_crash_01`) — تا فایل نباشد، همان جمله به‌صورت **متن** در حباب نمایش داده می‌شود؛ وقتی فایل بیاید صدا هم خودکار پخش می‌شود.

### حالت E — Sprite Sheet

1. Sheet باید ردیف افقیِ فریم‌های هم‌اندازه باشد (مثلاً 6×128 = عرض 768، ارتفاع 128).
2. نام: `..._sheet.png`.
3. مشخصات فریم (تعداد، FPS، Loop) در manifest ثبت می‌شود:

```ts
'fx_smoke_01_sheet': {
  src: 'assets/effects/fx_smoke_01_sheet.png',
  frame: { w: 128, h: 128, count: 6, fps: 10, loop: true },
  placeholder: { type: 'effect', w: 128, h: 128, label: 'PLACEHOLDER_EFFECT' },
},
```

---

## 3. مرجع کامل مسیرها (پوشه‌بندی رسمی)

```text
public/assets/
├── vehicles/player/          veh_player_01.png
├── vehicles/traffic/         veh_taxi_01.png ...
├── vehicles/special/         veh_wedding_01.png ...
├── vehicles/unlockable/
├── characters/player/        char_driver_01_idle.png ...
├── characters/mechanic/
├── characters/passenger/
├── npc/police/               npc_police_01.png ...
├── npc/pedestrians/
├── npc/animals/
├── environments/roads/       env_road_straight_01.png ...
├── environments/buildings/
├── environments/landmarks/
├── environments/props/
├── props/                    prop_trash_01.png ...
├── ui/                       ui_button_01.png ...
├── icons/                    ui_icon_coin.png ...
├── effects/                  fx_smoke_01_sheet.png ...
├── particles/
├── animations/
├── audio/music/  audio/sfx/  audio/voices/{player, npc, police, passenger, mechanic}/  audio/ambient/
├── fonts/
├── loading/
└── localization/
```

این ساختار عمداً با ساختار بخش ۳ سند مادر یک‌به‌یک مطابق است تا هر وقت خواستید پروژه را به موتور دیگری ببرید، نگاشت ساده باشد.

---

## 4. تنظیمات Import (سؤال ۱۹ هندبوک)

برخلاف موتورهایی مثل Unity، اینجا «تنظیمات Import» وجود ندارد چون:

| کار موتورهای دیگر | معادل در پروژه ما |
|---|---|
| Texture Type / Sprite Mode | خودکار (manifest تعیین می‌کند: تک‌تصویر یا Sheet با فیلد frame) |
| Compression | قبل از Import با squoosh.app انجام می‌دهید (فایل نهایی فشرده وارد می‌شود) |
| Pivot Point | مرکز پیش‌فرض؛ اگر استثناست در manifest فیلد anchor |
| Pixels Per Unit | بی‌معنی — ابعاد منطقی بازی ثابت است |

---

## 5. ابزار اعتبارسنجی (بخش ۳۰ سند مادر)

بعد از هر Import، این دستور را بزنید:

```bash
node scripts/validate_assets.mjs
```

خروجی خوانا این موارد را گزارش می‌دهد:

```text
✅ Missing Assets      (manifest گفته لازم است ولی فایل نیست → Placeholder فعال شده)
✅ Unused Assets       (فایل هست ولی هیچ جا استفاده نمی‌شود — قبل از حذف Reference را چک کنید)
✅ Wrong Format        (مثلاً JPG داخل پوشه Spriteها)
✅ Wrong Size          (ابعاد با جدول Inventory نمی‌خواند)
✅ Invalid Name        (نام خارج از الگوی نام‌گذاری)
✅ Broken Reference    (manifest به فایلی اشاره می‌کند که نیست)
✅ Oversized Texture   (حجم فایل از سقف جدول رد شده)
```

**قانون:** قبل از هر Release، خروجی این ابزار باید بدون خطای قرمز باشد.

---

## 6. عیب‌یابی Import (وقتی Asset دیده نمی‌شود)

| علامت | علت رایج | درمان |
|---|---|---|
| هنوز Placeholder می‌بینی | نام/مسیر فرق دارد | حرف‌به‌حرف با Inventory مقایسه کن؛ حروف بزرگ ممنوع |
| تصویر لود شد ولی جایش عجیب است | ابعاد با جدول فرق دارد | Image Size را دقیق اصلاح کن |
| دور تصویر مربع سفید | پس‌زمینه شفاف نشده | هندبوک گام ۴ (حذف پس‌زمینه) |
| تصویر تار | بزرگ‌سازی شده | نسخه اصلی را کوچک کن، نه برعکس |
| صدا پخش نمی‌شود | فرمت یا مسیر غلط | OGG؟ مسیر جدول؟ خروجی validate را ببین |
| همه چیز درست ولی هنوز قدیمی می‌آید | Cache مرورگر | رفرش سخت (Ctrl+Shift+R) یا تب جدید |

---

## 7. چک‌لیست نهایی هر Import

```text
[ ] نام فایل دقیقاً = جدول Inventory
[ ] مسیر دقیقاً = جدول
[ ] ابعاد دقیقاً = جدول
[ ] فرمت درست (PNG sprite / OGG صدا / WOFF2 فونت)
[ ] پس‌زمینه شفاف (برای Spriteها)
[ ] حجم زیر سقف جدول
[ ] سبک با بقیه هماهنگ (۸ مورد بخش ۳.۲ هندبوک)
[ ] node scripts/validate_assets.mjs → بدون خطا
[ ] در بازی چشم اجرا: تصویر سرجایش، سرجایش درست
[ ] وضعیت در ASSET_INVENTORY_FA.md به‌روز شد (⬜→🟢)
```
