# Worklog — FunnyCarIR

---
Task ID: 1
Agent: Super Z (main agent)
Task: اجرای Phase 0 + Phase 1 پروژه FunnyCarIR طبق Master Prompt (بازی ماشین طنز فارسی اندرویدی)

Work Log:
- شفاف‌سازی: ۸ سؤال کلیدی از کاربر پرسیده شد؛ تصمیم‌ها: موتور HTML5+TypeScript (Capacitor در آینده)، دوربین Top-Down، کنترل دکمه‌ای لمسی، سبک کارتون خط‌ضخیم، Asset تدریجی با AI، دامنه فاز 0+1، صدای سینتی WebAudio، کد EN + کامنت FA
- محیط: init-fullstack اجرا شد (Next.js 16 + App Router + Tailwind 4)
- Phase 0 — ۸ سند فارسی نوشته شد: GAME_DESIGN_FA، ARCHITECTURE_FA، ASSET_INVENTORY_FA، ASSET_HANDBOOK_FA، ASSET_GENERATION_GUIDE_FA، ASSET_IMPORT_GUIDE_FA، VOICE_RECORDING_GUIDE_FA، TEST_PLAN_FA + README_FA.md
- Phase 1 — موتور بازی TypeScript خالص در src/game/: GameManager (حلقه Fixed Timestep 120Hz)، AssetManager (fallback خودکار Placeholder)، InputManager (لمسی+کیبورد)، Camera (lerp+lookahead+shake)، SaveManager (نسخه‌دار+backup+مهاجرت)، Vehicle (فیزیک آرکید+برخورد محور-به-محور)، World (شبکه جاده/بلوک/سکه)، WorldRenderer (culling+ذرات)، AudioManager (سینتی WebAudio، ۴ کانال)، VoiceManager (Pool/Random/Cooldown/Priority)، PlaceholderFactory (برچسب‌دار)
- پوسته React: GameShell (بوت/منو/HUD/Pause/Toast) + touch-controls (HoldButton/TapButton) — فارسی RTL کامل، اعداد فارسی
- فونت وزیرمتن (۴ وزن WOFF2، مجوز OFL) دانلود و به globals.css اضافه شد
- دیالوگ‌های طنز Data-Driven در src/game/data/dialogues.ts (۱۵ رویداد، ۵۰+ جمله) + balance.ts (اعداد قابل تنظیم) + assets.manifest.ts (تک‌نقطه حقیقت Asset)
- ابزارها: scripts/validate_assets.mjs (اعتبارسنجی کامل) + test_voice.ts (۸ تست واحد VoiceManager) + gen_batch1.mjs/gen_batch1_fix.mjs (تولید AI) + process_batch1.py (حذف پس‌زمینه BFS+feather، resize، کوانتیز)
- Batch 1 AI: ۸ تصویر تولید و بعد از بازبینی بصری (۲ کاشی رد و بازتولید شدند) وارد public/assets شد: veh_player_01 (19KB)، ۳ پرتره راننده (24-32KB)، ۴ کاشی محیط (29-205KB) — همه زیر سقف حجم
- تست E2E با agent-browser: بوت، منو، شروع بازی، رانندگی (سرعت 117 کیلومتر/ساعت نمایش)، جمع سکه، برخورد + کاهش آبرو، ذخیره/بازیابی بین رفرش‌ها، حباب دیالوگ RTL با پرتره، Pause، نمای موبایل 390×844، کنسول بدون خطا
- باگ‌های یافته و رفع‌شده در تست: (۱) گیر کردن ماشین به دیوار → برخورد محور-به-محور با لغزش؛ (۲) حباب دیالوگ بیرون کانواس → ترنسلیت دوربین بعد از restore رندرر اعمال شد + clamp داخل کادر؛ (۳) ریس نمونه زامبی در StrictMode/HMR → گارد تک‌نمونه در GameManager؛ (۴) رگولار اکسپرس پارس manifest در ابزار اعتبارسنجی
- lint نهایی: بدون خطا | validate_assets: بدون خطا | کنسول مرورگر: بدون خطا

Stage Summary:
- خروجی: بازی قابل اجرای فارسی RTL با رانندگی آزاد کامل + ۹ سند فارسی + Asset Pipeline کامل + ۸ Asset واقعی Batch 1
- وضعیت Placeholder: ۶ فایل موقت (تاکسی، پلیس، ۳ صدا، ۱ voice) — همه برچسب‌دار و در گزارش ابزار اعتبارسنجی
- تصمیم‌های مهم: موتور اختصاصی Canvas2D (بدون وابستگی)، React فقط برای UI، Data-Driven بودن دیالوگ/بالانس/manifest، Save نسخه‌دار localStorage
- فاز بعدی (Phase 2-3): فیزیک کامل‌تر (دنده عقب، درفت ملایم)، ترافیک (VEH-002/004/007)، ساختمان‌های واقعی (ENV-005..008)، RandomEventManager واقعی

---
Task ID: 2
Agent: Super Z (main agent)
Task: اجرای Phase 2-3 (سه قلم بعدی به درخواست کاربر): فیزیک کامل‌تر + Batch 2 ترافیک (VEH-002/003/004/007) + Batch 3 ساختمان‌ها (ENV-005..008)

Work Log:
- فیزیک فاز 2 در Vehicle.ts: دنده عقب (maxReverse=120, reverseAccel)، درفت ملایم با latVel (slipGain/gripDecay/maxLateral=130/skidThreshold=55) + خروجی skidding برای رد لاستیک/صدا/دود
- TrafficCar.ts + TrafficManager.ts: ۷ خودرو AI با لاین دست‌راست (قاعده ایران)، تصمیم تقاطع (مستقیم/راست/چپ از گزینه‌های معتبر)، دید جلو (ترمز پشت بازیکن و ترافیک)، بوق اعصاب پس از ۲.۵ ثانیه گیر، واکنش به بوق بازیکن، stun پس از برخورد
- RandomEventManager.ts: سه رویداد (گربهٔ عرضی، مخروط‌های موقتی، تاکسیِ بوق‌زن) — همه اعداد از RANDOM_EVENTS در balance.ts
- WorldRenderer.ts: drawTraffic/drawCat/drawEventCones + ساختمان‌های Batch 3 به‌عنوان Collider رندر می‌شوند؛ GameManager: resolveTrafficCollisions (جریمه آبرو trafficCrashPenalty=4) + اتصال کامل صدا/دیالوگ/ذرات/لرزش
- Batch 2 AI (gen_batch2*.mjs + process_batch2.py با همان pipeline فاز 1): veh_taxi_01، veh_sedan_01، veh_pickup_01، veh_police_01 — وارد public/assets شد
- Batch 3 AI: env_building_shop_01، env_building_home_01، env_building_garage_01، env_gas_station_01 — وارد public/assets شد
- manifest (تک‌نقطه حقیقت): ۲۰ شناسه / ۱۶ فایل واقعی — فقط ۴ Placeholder صوتی باقی (طبق برنامه فاز 7/9)
- ASSET_INVENTORY_FA.md: وضعیت VEH-002/003/004/007 و ENV-005..008 به 🟢 به‌روز شد
- تست E2E با agent-browser (اسکرین‌شات‌ها در scripts/e2e_p2_0*.png):
  * بوت و منو سالم → شروع رانندگی آزاد
  * ترافیک: ۷ ماشین فعال با هر ۴ Asset (taxi/sedan/pickup/police) و سرعت‌های واقعی ۲۵-۱۴۰ px/s
  * درفت: سرعت 380 + latVel=130 (سقف maxLateral) → skidding=true و ۷۴ رد لاستیک رندر شد
  * برخورد با ساختمان (Batch 3 به‌عنوان Collider): توقف + جریمه آبرو (50→37 در تست) — لغزش دیوار بدون گیر
  * برخورد با وانت ترافیک: جداسازی صحیح دو ماشین + stun
  * ذخیره: version=1، سکه‌ها و آبرو بین تعامل‌ها حفظ شد
  * کنسول بدون خطا | lint بدون خطا | tsc روی src/game پاک | bun run build موفق
- نکته: latVel=0 در یک تست میانی علت داشت — ماشین پس از رانندگی کورکیبه‌دیوار چسبیده بود (رفتار صحیب بازی)؛ پس از reset روی جاده، درفت دوباره تأیید شد

Stage Summary:
- هر سه قلم درخواستی کاربر کامل و راستی‌آزمایی شد: فیزیک فاز 2 (دنده‌عقب+درفت)، ترافیک ۷ خودرویی با ۴ Asset واقعی، ساختمان‌های واقعی Batch 3
- وضعیت Placeholder: از ۶ به ۴ کاهش یافت (فقط صدا/voice — فاز 7/9)
- ابزار دیباگ: window.__funnycar (state/traffic/vehicle/renderer/randomEvents/save) برای QA سریع
- فاز بعدی پیشنهادی: مأموریت‌ها (Mission System)، پرتره پلیس/مسافر، یا فایل‌های صوتی

---
Task ID: 3
Agent: Super Z (main agent)
Task: Phase 4 + 7 — سیستم مأموریت (Mode 2 سند طراحی) + Batch 4 پرتره‌ها + فایل‌های صوتی واقعی (به درخواست «بریم بعدی»)

Work Log:
- missions.ts (Data-Driven): ۴ مأموریت سند طراحی — مسافر عجول (تایمر ۴۰s)، ماشین دودکن (حتی یک تصادف = شکست)، سوخت‌گیری در ترافیک (حداکثر ۲ تصادف شدید)، فرار از چاله‌ها (حداکثر ۳ چاله + تایمر) — جایزه‌ها طبق سند (۲۰..۱۰۰ سکه، ۸..۱۵ آبرو)
- MISSIONS در balance.ts: reachRadius، pxPerMeter، جریمه زمان تصادف، شعاع/تعداد چاله، فاصله دود، بونوس آبروی ≥۸۰ (×1.25 طبق سند بخش ۷)
- MissionManager.ts: ماشین وضعیت idle/active/succeeded/failed + چاله‌های روی دالان مسیر + گزارش برخورد فقط یک‌بار در هر رویداد (با crashCooldown) + faNum برای ارقام فارسی
- WorldRenderer: نشانگر هدف پالس‌دار (حلقه چرخان خط‌چین + فلش شناور)، چاله‌های کاریکاتوری با ترک، فلش صفحه‌ای هدف خارج از کادر با فاصله «متر» فارسی
- GameManager: startMission/abandonMission/listMissions + گزارش برخورد ثابت و ترافیک به مأموریت + دود ماشین دودکن + جایزه/بونوس/ذخیره completedMissions + رویداد onMissionEnd
- GameShell: صفحه انتخاب مأموریت (کارت با جایزه/بج «انجام شد ✓»)، پنل HUD مأموریت (تایمر رنگی/فاصله/وضعیت/انصراف)، اورلی نتیجه (موفق: سکه+آبرو+جمله طنز؛ شکست: علت فارسی+«تلاش دوباره/ادامه رانندگی/منو») — دکمه مأموریت‌ها در منو سبز شد
- dialogues.ts: mission_success / mission_fail / pothole (جملات طنز Data-Driven)
- باگ رفع‌شده: گزارش برخورد به مأموریت ابتدا هر فریم بود (جریمه زمان انباشته می‌شد) → داخل gate crashCooldown منتقل شد؛ React lint (react-hooks/refs) → دسترسی ref مستقیم در handler
- تست E2E (e2e_p4_*.png): شروع m01 از منو → HUD + فلش ۳۴۶م → موفقیت (+۴۰ سکه، +۱۰ آبرو، ذخیره، بج «انجام شد ✓»)؛ m02 تصادف در دیوار → «ماشین خاموش شد!»؛ m04 → ۶ چاله روی مسیر، برخورد با چاله «چاله: ۱/۳» + لرزش + کندی؛ کنسول بدون خطا
- Batch 4 (gen_batch4.mjs + process_batch4.py): npc_police_01، char_mechanic_01، char_pass_m_01_idle/_angry — بازبینی بصری قبول (۴/۴) — manifest + SPEAKER_PORTRAIT به‌روز شد (پلیس/مکانیک/مسافر)
- صدا فاز 7: gen_audio_sfx.py (سینتز numpy: موتور لوپ بی‌درز ۱.۶s با هارمونیک‌های کامل + تصادف ۰.۷s + بوق دوتیونی ۰.۵۵s) → ffmpeg libvorbis OGG؛ voice_crash_01 با TTS فارسی (۳.۰۴s — موقت تا ضبط انسانی طبق VOICE_RECORDING_GUIDE)
- AssetManager: مسیر صوتی جدید (fetch + decodeAudioData روی OfflineAudioContext → AudioBuffer) با fallback Placeholder
- AudioManager: attachAssets + اولویت فایل واقعی در horn/crash/engine (لوپ با playbackRate وابسته به سرعت) + playVoiceFile (جستجوی voice.event/index در manifest) — fallback سینتی حفظ شد
- وضعیت نهایی Asset: ۲۴/۲۴ واقعی — صفر Placeholder 🎉

Stage Summary:
- Mode 2 (مأموریت‌ها) کاملاً فعال: منو → انتخاب → HUD → موفق/شکست → ذخیره
- پرتره‌های پلیس/مکانیک/مسافر واقعی؛ حباب‌های دیالوگ شخصیت واقعی دارند
- همه فایل‌های صوتی manifest واقعی و پخش می‌شوند (موتور/بوق/تصادف/جمله تصادف)
- ابزار: window.__funnycar شامل mission/audio/assets برای QA
- فاز بعدی پیشنهادی: Mode 3 پارک دوبل، یا فروشگاه/آپگرید ماشین، یا اسپرایت پیکان‌چرخان پلیس (NPC-001 نیمه‌کاره)
