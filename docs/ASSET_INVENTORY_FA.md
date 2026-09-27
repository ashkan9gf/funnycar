# فهرست کامل Assetها — FunnyCarIR

> نسخه: 1.0 | فاز: Phase 0
>
> ⭐ این جدول «قرارداد رسمی» پروژه است. هر Asset قبل از ساخته‌شدن باید در این جدول باشد و بعد از ساخته‌شدن، وضعیتش اینجا به‌روز شود.
>
> راهنمای ستون‌ها: **Req** = Required (اجباری برای Release) | **Batch** = ترتیب تولید طبق بخش ۳۸ سند مادر | **Phase** = فازی که در کد استفاده می‌شود.
>
> 🟢 = واقعی موجود | 🟡 = Placeholder فعال | ⬜ = هنوز ساخته نشده (وضعیت با پیشرفت پروژه به‌روز می‌شود)

---

## 1. وسایل نقلیه (Vehicles)

| ID | Asset | Req | Batch | Phase | Format | ابعاد (px) | حجم هدف | انیمیشن | مسیر | وضعیت |
|---|---|---|---|---|---|---|---|---|---|---|
| VEH-001 | ماشین بازیکن «پرنده ۱۳۱» (سفید، بدنه کوچک کارتونی) | Yes | 1 | 1 | PNG | 256×448 | <80KB | Idle/Drive (2 فریم لرزش موتور — اختیاری) | vehicles/player/veh_player_01.png | 🟢 |
| VEH-002 | تاکسی نارنجی | Yes | 2 | 3 | PNG | 256×448 | <80KB | — | vehicles/traffic/veh_taxi_01.png | 🟢 |
| VEH-003 | ماشین پلیس (چراغ‌آب​ی‌سفید کارتونی) | Yes | 2 | 5 | PNG | 256×448 | <80KB | — | npc/vehicles/veh_police_01.png | 🟢 |
| VEH-004 | وانت بار قرمز | Yes | 2 | 3 | PNG | 256×448 | <80KB | — | vehicles/traffic/veh_pickup_01.png | 🟢 |
| VEH-005 | ماشین دودکن/خراب (پر از باند) | Yes | 2 | 4 | PNG | 256×448 | <80KB | — | vehicles/traffic/veh_broken_01.png | ⬜ |
| VEH-006 | ماشین عروس (با گل روی کاپوت) | No | 3 | 8 | PNG | 256×448 | <80KB | — | vehicles/special/veh_wedding_01.png | ⬜ |
| VEH-007 | خودروی شخصی آبی «کپری» | Yes | 2 | 3 | PNG | 256×448 | <80KB | — | vehicles/traffic/veh_sedan_01.png | 🟢 |
| VEH-008 | ماشین ورزشی قابل Unlock «شاهین» | No | 5 | 7 | PNG | 256×448 | <80KB | — | vehicles/unlockable/veh_sport_01.png | ⬜ |
| VEH-009 | ماشین بنزکش/تانکر کوچک | No | 3 | 6 | PNG | 256×448 | <80KB | — | vehicles/traffic/veh_fueltruck_01.png | ⬜ |

**قاعدة مشترک همه Vehicleها:** پس‌زمینه شفاف، نمای Top-Down سه‌ربع (کمی جلو دیده شود)، سایه ملایم زیر ماشین داخل خود فایل، خط دور ضخیم. 90°=رو به بالا. چرخش در بازی با کد انجام می‌شود — اسپرایت جدا برای Turn لازم نیست (قانون بخش ۱۴: Asset اضافی تولید نشود).

---

## 2. شخصیت‌ها (Characters)

| ID | Asset | Req | Batch | Phase | Format | ابعاد | حجم هدف | انیمیشن | مسیر | وضعیت |
|---|---|---|---|---|---|---|---|---|---|---|
| CHAR-001 | پرتره راننده (بازیکن) — نیم‌تنه با سبیل بامزه | Yes | 1 | 1 | PNG | 512×512 | <120KB | حالت‌ها: عادی/شوک/خوشحال (3 فایل جدا) | characters/player/char_driver_01_idle.png + _happy.png + _shock.png | 🟢 |
| CHAR-002 | پرتره مکانیک (پیش‌بند + آچار) | Yes | 4 | 6 | PNG | 512×512 | <120KB | Idle | characters/mechanic/char_mechanic_01.png | ⬜ |
| CHAR-003 | پرتره مسافر مرد | Yes | 4 | 6 | PNG | 512×512 | <120KB | Idle/عصبانی (2 فایل) | characters/passenger/char_pass_m_01_idle.png + _angry.png | ⬜ |
| CHAR-004 | پرتره مسافر زن | No | 4 | 6 | PNG | 512×512 | <120KB | Idle | characters/passenger/char_pass_f_01_idle.png | ⬜ |

**نکته:** در نمای Top-Down، بدن شخصیت داخل اسپرایت ماشین دیده می‌شود؛ پرتره‌ها فقط برای حباب دیالوگ و HUD هستند. بنابراین انیمیشن بدن (Walk/Run) لازم نیست — فقط حالت چهره. (قانون بخش ۱۳: فقط انیمیشنی که واقعاً استفاده می‌شود.)

---

## 3. NPC ها

| ID | Asset | Req | Batch | Phase | Format | ابعاد | حجم هدف | مسیر | وضعیت |
|---|---|---|---|---|---|---|---|---|---|
| NPC-001 | افسر پلیس (پرتره + پیکان‌چرخان کوچک Top-Down) | Yes | 2/4 | 5 | PNG | 512×512 + 96×128 | <150KB | npc/police/npc_police_01.png, npc_police_01_car.png | ⬜ |
| NPC-002 | عابر مرد (Top-Down 4 جهت) | Yes | 4 | 5 | PNG | 96×128 ×4 جهت | <40KB | npc/pedestrians/npc_ped_m_01.png | ⬜ |
| NPC-003 | عابر زن (Top-Down 4 جهت) | Yes | 4 | 5 | PNG | 96×128 ×4 جهت | <40KB | npc/pedestrians/npc_ped_f_01.png | ⬜ |
| NPC-004 | موتورسوار (موتور + سوار، Top-Down) | Yes | 4 | 6 | PNG | 160×280 | <50KB | npc/npc_motor_01.png | ⬜ |
| NPC-005 | گربه خیابانی | No | 4 | 6 | PNG | 96×96 ×2 فریم راه رفتن | <20KB | npc/animals/npc_cat_01.png | ⬜ |

---

## 4. محیط (Environments)

| ID | Asset | Req | Batch | Phase | Format | ابعاد | حجم هدف | مسیر | وضعیت |
|---|---|---|---|---|---|---|---|---|---|
| ENV-001 | کاشی جاده آسفالت (خط‌چین وسط، قابل Tile شدن) | Yes | 1 | 1 | PNG | 512×512 | <150KB | environments/roads/env_road_straight_01.png | 🟢 |
| ENV-002 | کاشی تقاطع (چهارراه) | Yes | 1 | 1 | PNG | 512×512 | <150KB | environments/roads/env_road_cross_01.png | 🟢 |
| ENV-003 | کاشی پیاده‌رو/جدول | Yes | 1 | 1 | PNG | 512×512 | <120KB | environments/roads/env_sidewalk_01.png | 🟢 |
| ENV-004 | کاشی زمین/حیاط | Yes | 1 | 1 | PNG | 512×512 | <120KB | environments/roads/env_ground_01.png | 🟢 |
| ENV-005 | ساختمان نوع A (مغازه دوطبقه با تابلوی فارسی) | Yes | 3 | 3 | PNG | 512×640 | <200KB | environments/buildings/env_building_shop_01.png | 🟢 |
| ENV-006 | ساختمان نوع B (خانه مسکونی آجری) | Yes | 3 | 3 | PNG | 512×640 | <200KB | environments/buildings/env_building_home_01.png | 🟢 |
| ENV-007 | ساختمان نوع C (تعمیرگاه با درب بزرگ) | Yes | 3 | 6 | PNG | 512×640 | <200KB | environments/buildings/env_building_garage_01.png | 🟢 |
| ENV-008 | پمپ بنزین (جایگاه + کانوپی) | Yes | 3 | 6 | PNG | 640×640 | <250KB | environments/landmarks/env_gas_station_01.png | 🟢 |
| ENV-009 | تابلوی خیابان فارسی (بلوک متنی جدا برای متن داینامیک) | No | 3 | 8 | PNG | 256×128 | <60KB | environments/props/env_sign_01.png | ⬜ |
| ENV-010 | چراغ راهنمایی | Yes | 3 | 3 | PNG | 128×256 | <60KB | environments/props/env_trafficlight_01.png | ⬜ |

**قابلیت Tile:** کاشی‌های ENV-001 تا 004 باید لبه‌های seamless داشته باشند (تصویر کنار خودش بدون درز رد شود) — در ASSET_GENERATION_GUIDE prompt مخصوص دارد.

---

## 5. اشیاء کوچک (Props)

| ID | Asset | Req | Batch | Phase | Format | ابعاد | حجم هدف | مسیر | وضعیت |
|---|---|---|---|---|---|---|---|---|---|
| PROP-001 | سطل زباله | Yes | 3 | 6 | PNG | 128×128 | <30KB | props/prop_trash_01.png | ⬜ |
| PROP-002 | مخروط ترافیکی | Yes | 3 | 4 | PNG | 96×96 | <20KB | props/prop_cone_01.png | ⬜ |
| PROP-003 | درخت کاج/چنار کارتونی | Yes | 3 | 3 | PNG | 192×192 | <40KB | props/prop_tree_01.png + _02.png | ⬜ |
| PROP-004 | تیر برق/چراغ | Yes | 3 | 3 | PNG | 96×192 | <30KB | props/prop_pole_01.png | ⬜ |
| PROP-005 | نیمکت پارک | No | 3 | 8 | PNG | 128×96 | <25KB | props/prop_bench_01.png | ⬜ |
| PROP-006 | موتور پارک‌شده | No | 3 | 8 | PNG | 128×192 | <30KB | props/prop_motor_01.png | ⬜ |
| PROP-007 | دوچرخه پارک‌شده | No | 3 | 8 | PNG | 128×96 | <25KB | props/prop_bike_01.png | ⬜ |
| PROP-008 | چاله (لکه روی جاده) | Yes | 3 | 6 | PNG | 160×160 | <25KB | props/prop_pothole_01.png | ⬜ |
| PROP-009 | سکه (Gameplay) | Yes | 5 | 7 | PNG | 96×96 ×6 فریم چرخش | <40KB | props/prop_coin_01_sheet.png | ⬜ |

---

## 6. رابط کاربری (UI) و آیکون‌ها

| ID | Asset | Req | Batch | Phase | Format | ابعاد | حجم هدف | مسیر | وضعیت |
|---|---|---|---|---|---|---|---|---|---|
| UI-001 | دکمه پایه (حالت عادی/فشرده — Two-state) | Yes | 5 | 1 | PNG | 256×128 | <40KB | ui/ui_button_01.png + _pressed.png | 🟡 |
| UI-002 | پنل کج‌لبه (کارت منو) | Yes | 5 | 2 | PNG | 512×512 (9-slice) | <80KB | ui/ui_panel_01.png | 🟡 |
| UI-003 | آیکون سکه | Yes | 5 | 7 | PNG | 128×128 | <25KB | icons/ui_icon_coin.png | 🟡 |
| UI-004 | آیکون آبرو (قهوه شکیل! ☕ کارتونی) | Yes | 5 | 2 | PNG | 128×128 | <25KB | icons/ui_icon_reputation.png | 🟡 |
| UI-005 | آیکون بنزین | Yes | 5 | 6 | PNG | 128×128 | <25KB | icons/ui_icon_fuel.png | 🟡 |
| UI-006 | آیکون سرعت‌سنج | Yes | 5 | 2 | PNG | 128×128 | <25KB | icons/ui_icon_speed.png | 🟡 |
| UI-007 | آیکون مأموریت | Yes | 5 | 4 | PNG | 128×128 | <25KB | icons/ui_icon_mission.png | ⬜ |
| UI-008 | آیکون بوق | Yes | 5 | 1 | PNG | 128×128 | <25KB | icons/ui_icon_horn.png | 🟡 |
| UI-009 | دکمه Pause / Play / Settings (3 فایل) | Yes | 5 | 1 | PNG | 128×128 | <45KB | ui/ui_btn_pause.png, ui_btn_play.png, ui_btn_settings.png | 🟡 |
| UI-010 | لوگوی بازی (تایپوگرافی فارسی «فانی‌کار») | Yes | 5 | 2 | PNG | 512×256 | <80KB | ui/ui_logo_01.png | 🟡 |
| UI-011 | تصویر Splash (پس‌زمینه صحنه خیابان) | No | 5 | 8 | PNG/WebP | 720×1280 | <250KB | loading/splash_01.webp | ⬜ |

---

## 7. جلوه‌ها (Effects / Particles)

| ID | Asset | Req | Batch | Phase | Format | ابعاد | فریم | مسیر | وضعیت |
|---|---|---|---|---|---|---|---|---|---|
| FX-001 | دود موتور/تصادف | Yes | 6 | 6 | PNG | 128×128 | 6 فریم | effects/fx_smoke_01_sheet.png | ⬜ |
| FX-002 | ستاره گیجی بعد از تصادف | Yes | 6 | 6 | PNG | 128×128 | 4 فریم | effects/fx_stars_01_sheet.png | ⬜ |
| FX-003 | گرد و خاک ترمز/سوتی | No | 6 | 8 | PNG | 128×128 | 4 فریم | effects/fx_dust_01_sheet.png | ⬜ |
| FX-004 | برق/برخورد (Impact) | Yes | 6 | 6 | PNG | 128×128 | 4 فریم | effects/fx_impact_01_sheet.png | ⬜ |

**نکته فنی:** در Phase 1 جلوه‌های ساده (دایره/مستطیل متحرک) به‌صورت کدی نمایش داده می‌شوند؛ Sprite Sheetها در فاز 6 جایگزین می‌شوند (بدون تغییر کد فراخوانی).

---

## 8. صدا — موسیقی و افکت (Audio)

مشخصات استاندارد همه صداها: **Mono، 44.1kHz، فرمت نهایی OGG (Vorbis q5) یا MP3 (192kbps)؛ فایل کارشده WAV 24bit نگه‌داری می‌شود؛ بلندی نرمال‌شده حدود ‎-16 LUFS؛ بدون Clip.**

| ID | Asset | Req | Batch | Phase | نوع | Duration | مسیر | وضعیت |
|---|---|---|---|---|---|---|---|---|
| AUD-MUS-001 | موسیقی منوی اصلی (شاد، ایرانی‌سمت‌وسو، Loopable) | Yes | 7 | 9 | Music | 60-90s loop | audio/music/music_main_loop.ogg | ⬜ |
| AUD-MUS-002 | موسیقی گیم‌پلی (ریتم ملایم) | Yes | 7 | 9 | Music | 90-120s loop | audio/music/music_gameplay_loop.ogg | ⬜ |
| AUD-SFX-001 | موتور ماشین (Loop + Pitch متغیر با سرعت) | Yes | 7 | 1* | SFX | 2s loop | audio/sfx/sfx_engine_loop.ogg | ⬜ |
| AUD-SFX-002 | ترمز | Yes | 7 | 6 | SFX | 0.6s | audio/sfx/sfx_brake_01.ogg | ⬜ |
| AUD-SFX-003 | تصادف (برخورد کارتونی) | Yes | 7 | 1* | SFX | 0.8s | audio/sfx/sfx_crash_01.ogg | ⬜ |
| AUD-SFX-004 | بوق (۳ واریشن بامزه) | Yes | 7 | 1* | SFX | 0.4s×3 | audio/sfx/sfx_horn_01..03.ogg | ⬜ |
| AUD-SFX-005 | کلیک دکمه | Yes | 7 | 1* | SFX | 0.15s | audio/sfx/sfx_button_01.ogg | ⬜ |
| AUD-SFX-006 | جمع‌آوری سکه | Yes | 7 | 7 | SFX | 0.3s | audio/sfx/sfx_coin_01.ogg | ⬜ |
| AUD-SFX-007 | مأموریت موفق (Jingle) | Yes | 7 | 4 | SFX | 1.5s | audio/sfx/sfx_mission_ok.ogg | ⬜ |
| AUD-SFX-008 | مأموریت ناموفق (بامزه، نه غمگین) | Yes | 7 | 4 | SFX | 1.2s | audio/sfx/sfx_mission_fail.ogg | ⬜ |
| AUD-SFX-009 | سوت/آژیر پلیس (کوتاه) | Yes | 7 | 5 | SFX | 1.2s | audio/sfx/sfx_police_01.ogg | ⬜ |
| AUD-SFX-010 | سوخت‌گیری | Yes | 7 | 6 | SFX | 1.5s | audio/sfx/sfx_fuel_01.ogg | ⬜ |
| AUD-SFX-011 | آپگرید/خرید | Yes | 7 | 7 | SFX | 0.8s | audio/sfx/sfx_upgrade_01.ogg | ⬜ |

`*` = در Phase 1 نسخه سینتی WebAudio در کد ساخته می‌شود (AUD-SFX-001/003/004/005) و در فاز 7/9 فایل واقعی جایگزین می‌شود — بدون تغییر کد فراخوان.

---

## 9. صدا — جملات طنز صوتی (Voices)

**مشخصات:** Mono، 44.1kHz، OGG، هر جمله 0.8 تا 2 ثانیه، نرمال‌شده ‎-16 LUFS. نام‌گذاری: `voice_{event}_{شماره}.ogg` در پوشه `assets/audio/voices/{شخصیت}/`.

| ID | رویداد | تعداد جمله | شخصیت | مسیر پایه | وضعیت |
|---|---|---|---|---|---|
| VOX-CRASH-001..05 | car_crash | 5 | Player | voices/player/voice_crash_01..05 | ⬜ (متن‌ها فعال ✅) |
| VOX-PARK-BAD-001..03 | parking_bad | 3 | Player | voices/player/voice_park_bad_01..03 | ⬜ (متن فعال ✅) |
| VOX-PARK-OK-001..03 | parking_good | 3 | Player | voices/player/voice_park_good_01..03 | ⬜ |
| VOX-ENGFAIL-001..03 | engine_failure | 3 | Player | voices/player/voice_engfail_01..03 | ⬜ |
| VOX-FUEL-001..03 | low_fuel | 3 | Player | voices/player/voice_lowfuel_01..03 | ⬜ |
| VOX-POLICE-001..04 | police_stop | 4 | Police | voices/police/voice_police_01..04 | ⬜ |
| VOX-PASS-001..05 | passenger reactions | 5 | Passenger | voices/passenger/voice_pass_01..05 | ⬜ |

متن همه جملات از همین حالت در `src/game/data/dialogues.ts` تعریف شده و به‌صورت حباب متنی نمایش داده می‌شود؛ فایل صوتی هر جمله وقتی ساخته شود، با همان ID از manifest خودکار بارگذاری و پخش می‌شود (Data-Driven — بدون تغییر کد).

---

## 10. فونت و بومی‌سازی

| ID | Asset | Req | مشخصات | مسیر | وضعیت |
|---|---|---|---|---|---|
| FONT-001 | وزیرمتن (Vazirmatn) — Regular/Medium/Bold | Yes | WOFF2، مجوز OFL آزاد (استفاده تجاری ✅) | public/fonts/Vazirmatn-*.woff2 | 🟢 |
| LOC-001 | فایل متن‌های بازی (string table فارسی) | Yes | TypeScript map | src/game/data/strings.ts (فاز 8) | ⬜ |

**اعلام مجوز (قانون بخش ۵۷):**

| Asset | منبع | مجوز | استفاده تجاری | نیاز به ذکر منبع | تغییر مجاز |
|---|---|---|---|---|---|
| Vazirmatn | github.com/rastikerdar/vazirmatn | SIL OFL 1.1 | ✅ | در فروش فونت تنها، بله — در بازی خیر | ✅ |
| تصاویر AI (Batch 1: VEH-001، ENV-001..004، CHAR-001×3) | تولیدشده با ابزار AI در همین پروژه (gen_batch1.mjs) | متعلق به پروژه | ✅ | خیر | ✅ |
| صداهای سینتی کد | تولیدشده در پروژه | متعلق به پروژه | ✅ | خیر | ✅ |
| فایل‌های صوتی آینده | طبق همین جدول ثبت خواهد شد | — | باید Yes باشد | طبق مجوز | طبق مجوز |

---

## 11. بودج حافظه تصویر (Texture Memory Budget)

برای هدف «روان بودن روی گوشی 2GB RAM»، مجموع رم تصاویر بارگذاری‌شده در گیم‌پلی نباید از **40MB** بیشتر شود (هر پیکسل 4 بایت):

| گروه | تعداد | ابعاد | رم تقریبی |
|---|---|---|---|
| کاشی‌های محیط | 4 | 512×512 | 4MB |
| ساختمان‌ها | 3 | 512×640 | 3.7MB |
| ماشین‌ها (فعال + ترافیک) | 8 | 256×448 | 3.6MB |
| پرتره‌ها | 6 | 512×512 | 6MB |
| UI + آیکون | ~15 | متوسط | 3MB |
| افکت‌ها | 4 sheet | 128×128×6 | 2.4MB |
| **جمع تصویر** | | | **≈ 23MB ✅** (با حاشیه امنیت) |

بقیه بودج برای موسیقی/صدای دیکودشده و حاشیه سیستم نگه‌داری می‌شود. ابزار `scripts/validate_assets.mjs` هر تخطی را گزارش می‌کند.
