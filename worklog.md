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
