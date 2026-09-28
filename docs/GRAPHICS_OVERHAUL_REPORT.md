# GRAPHICS_OVERHAUL_REPORT.md — گزارش ارتقای گرافیک (فاز GRAPHICS_OVERHAUL)

> شواهد بصری: `scripts/e2e_ovh_01..14.png` | سند مرجع: `upload/GRAPHICS_OVERHAUL_3D_MASTER_PROMPT.md`

## خلاصه
پروژه بازنویسی نشد — «Fix + Refactor + Graphics Overhaul» طبق سند مادر. منطق بازی، ذخیره، ورودی، ترافیک، مأموریت، صدا و UI دست‌نخورده ماندند و فقط لایه نمایش و پایپ‌لاین Asset ارتقا یافت.

## Status / Changed / Why / Files / Tests / Result — برای هر محور

### ۱) پایپ‌لاین GLB واقعی (بخش‌های B, C, R, S, AI)
- **Status:** ✅ کامل
- **Changed:**
  - ابزار تولید GLB مستقل بدون وابستگی: `tools/glb/glbwriter.mjs` (کانتینر GLB 2.0 با accessor/bufferView/متریال PBR و پشتیبانی `translation` node و `COLOR_0`)
  - `tools/glb/generate_vehicles.ts` و `generate_city.ts` (اجرا با bun از روی کد TypeScript مشترک پروژه)
  - بارگذار ران‌تایم: `src/game/render3d/GlbModels.ts` — `GLTFLoader.parse` + cache + جلوگیری از لود تکراری + **fallback خودکار به مدل procedural در هر خطا** (بخش AC: خطا log، بازی ادامه می‌یابد)
- **Why:** سند مادر: «Primitive نباید Asset نهایی باشد» + الزام GLB/GLTF با GLTFLoader.
- **Files:** `tools/glb/*`، `src/game/render3d/GlbModels.ts` (جدید)
- **Tests:** ساختار GLB (JSON chunk) بررسی شد؛ E2E: تعویض خودکار مدل پس از لود؛ **Test 21 (خطای لود):** با block کردن `pride.glb` بازی بدون خطا با fallback بالا آمد (۸→۷ مدل).
- **Result:** ۲۳ فایل GLB واقعی (۱۵ خودرو + ۱۲ ساختمان) در `public/assets/models/` — لود با GLTFLoader استاندارد Three.js.

### ۲) ارتقای خودروها (بخش‌های D, E, N)
- **Status:** ✅ کامل برای ۵ خودرو اصلی + ۳ تکمیلی (هر ۸ واریانت)
- **Changed:** هندسه v4 در `src/game/render3d/vehicleGeometry.ts` — نیم‌رخ نرم‌تر (۱۴ نقطه) با bevel، بدنه/شیشه/تریم/سپر جدا، چرخ‌های مرکز‌محور روی node (اسپین + **فرمان بصری چرخ جلو**)، چراغ عقب کلون‌شده هر نمونه (**چراغ ترمز با emissive**)، پلاک دو‌رنگ، داخل کابین برای بازیکن (صندلی/داشبورد/فرمان)، باربند/علامت تاکسی/چراغ‌گردان پلیس؛ + **LOD1** برای ترافیک.
- **Why:** بخش N سند مادر: suspension feel، wheel rotation، steering، brake light.
- **Files:** `vehicleGeometry.ts`، `CarFactory3D.ts` (اینترفیس توسعه‌یافت)، `WorldRenderer3D.ts`
- **Tests:** E2E — اسپین چرخ هنگام حرکت، فرمان بصری با کلید، چراغ ترمز: `ff1a08@2.4` هنگام ترمز → `5a0f08@0.7` پس از رها کردن (اندازه‌گیری عددی).
- **Result:** خودروها از ~۲۵ مش به ~۱۲ مش GLB باکیفیت‌تر رسیدند؛ بدون از دست دادن sepهای جداشدنی آسیب.

### ۳) شهر و محیط ایرانی (بخش‌های I, J)
- **Status:** ✅
- **Changed:** ساختمان‌های GLB با پنجره‌های هندسی، بالکن، سایبان، **پشت‌بام ایرانی baked** (کولر آبی، منبع آب، ظرف ماهواره، آنتن) — ۴ نوع × ۳ واریانس؛ تعویض خودکار پس از لود با حفظ collider دوبعدی.
- **Why:** خروج از «چند Box کنار Road» طبق بخش I.
- **Files:** `cityGeometry.ts` (جدید)، `generate_city.ts`، `WorldRenderer3D → buildBuilding`
- **Tests:** E2E — ساختمان‌های GLB در منو و گیم‌پلی رندر می‌شوند؛ ناحیه برخورد بدون تغییر (آسیب/اسکران سالم).
- **Result:** ۳۶ ساختمان با جزئیات واقعی و ظاهر متنوع.

### ۴) چراغ راهنما + زندگی شهری (بخش I — traffic lights)
- **Status:** ✅
- **Changed:** سیستم کامل چراغ راهنما:
  - منطق: `src/game/world/TrafficLights.ts` (چرخه سبز/زرد/همه‌قرمز + **موج سبز** با آفست تقاطع) — Data-Driven در `TRAFFIC_LIGHTS` از `balance.ts`
  - **ترافیک AI پشت چراغ قرمز می‌ایستد** (`TrafficManager.lightConstraint`) و پشت چراغ بوق اعصاب نمی‌زند
  - رندر: تیرهای Instanced (۴۹ تقاطع = ۱ Draw Call) + لامپ‌های قرمز/زرد/سبز Instanced (۳ Draw Call) با sync فقط هنگام تغییر وضعیت
  - گیم‌پلی: رد شدن بازیکن با چراغ قرمز با سرعت → دیالوگ طنز جدید `red_light` + بوق اعتراض ترافیک
- **Files:** `TrafficLights.ts` (جدید)، `TrafficManager.ts`، `WorldRenderer3D.ts`، `GameManager.ts`، `dialogues.ts`، `balance.ts`
- **Tests:** E2E — ماشین ترافیک با `speed=0, atLight=true` پشت خط ایستاد؛ دیالوگ «قهوه‌مون سرد می‌شه!» هنگام رد شدن با قرمز ثبت شد؛ لامپ‌ها عددی: ۵۵ قرمز + ۱۰ زرد + ۳۳ سبز = ۹۸ = ۴۹×۲ ✓.
- **Result:** حس شهری واقعی + مکانیک جدید بدون رگرسیون.

### ۵) افکت‌های تصادف و حرکت (بخش‌های O, P)
- **Status:** ✅
- **Changed:** سیستم **لاشه/تکه‌های پرتابی** (`spawnDebris`) — تکه‌های ۳بعدی چرخان با گرانش/جهش (`DEBRIS.bounce`)، اصطکاک زمین و آرامش روی آسفالت + شیشه آبی در تصادف سخت + تکه هم‌رنگ مانع‌های شکستنی؛ همه روی همان `InstancedMesh` ذرات (بدون mesh تکی).
- **Why:** بخش O: impact effect + body reaction بدون افت FPS.
- **Files:** `WorldRenderer3D.ts` (Particle3D توسعه‌یافت)، `GameManager.ts`
- **Tests:** E2E — ۲۰ لاشه زنده پس از spawn؛ شکستنی واقعی (`broken:true`) با تکه هم‌رنگ؛ تصادف سخت: سلامت ۱۰۰→۷۷ + frontDamage=22.
- **Result:** تصادف داینامیک‌تر و حرفه‌ای‌تر بدون mesh مستقل.

### ۶) دوربین (بخش M)
- **Status:** ✅ (بهبود روی Chase موجود)
- **Changed:** **FOV سرعتی** (تا +۹° با سرعت، نرم با lerp) هم‌ساز با FOV تطبیقی موبایل (`fovBase`)؛ لرزش برخورد از قبل موجود حفظ شد.
- **Files:** `WorldRenderer3D → updateChaseCamera/resize`
- **Tests:** E2E — بدون jitter؛ restart سالم.
- **Result:** حس سرعت بیشتر، افق پایدار.

### ۷) رندر و رنگ (بخش K و بخش‌های PHASE 2)
- **Status:** ✅
- **Changed:** `outputColorSpace = SRGBColorSpace` صریح؛ `colorSpace` روی همه بافت‌های Canvas؛ پالت ساختمان اشباع‌تر؛ tone mapping و مه طلایی تهران از قبل موجود حفظ شد.
- **Files:** `WorldRenderer3D.ts`، `textures3d.ts` (بررسی شد — همه SRGB)
- **Result:** رنگ‌های غنی‌تر و سازگار.

### ۸) Debug Mode (بخش Y)
- **Status:** ✅
- **Changed:** کلید F اکنون پنل کامل می‌دهد: FPS، **Draw Calls، Triangles، Geometries/Textures، Object Count، Particles، تعداد خودرو، موقعیت دوربین** — روی اورلی، بدون مزاحمت UI اصلی.
- **Files:** `WorldRenderer3D → drawOverlay`، `GameManager → draw3DFrame`
- **Result:** معیار کیفیت در خود بازی قابل مشاهده است.

### ۹) چیزی که عمداً و شفاف انجام نشد
- **Blender:** در محیط نصب نیست؛ به‌جای آن طبق روح بخش T یک «Generator» واقعی ساخته شد (`tools/glb/*` با bun + three) که GLB استاندارد می‌سازد — نه primitive‌های rename‌شده.
- **DRACO/Meshopt/KTX2:** فعلاً لازم نیست (GLBها ۶۰–۲۰۰KB و بدون بافت سنگین‌اند) — طبق بخش S «فقط وقتی کمک کند».
- **نمای شب (Shot 8):** در بازی وجود ندارد؛ در گزارش QA «n/a».
- **Capacitor/Android (PHASE 8):** wrapper هنوز در پروژه وجود ندارد — فیک نمی‌کنیم؛ مراحل لازم در PERFORMANCE_REPORT آمده است.
- **صحنه بنچمارک جداگانه (بخش U):** به‌جای صحنه مجزا، خود شهر + پنل دیباگ F معیار سنجش است (اسکرین‌شات‌های ovh_03/04/14 معادل Benchmark Shot هستند).

## Acceptance Criteria — با شواهد
> «پروژه فقط ظاهرش تغییر نکرده؛ باگ‌های موجود رفع شده‌اند (BUG_FIX_REPORT)، Graphics Pipeline به GLB/GLTF ارتقا یافته (۲۳ فایل + GLTFLoader + fallback)، محیط و خودروها واقعاً باکیفیت‌تر شده‌اند (e2e_ovh_*) و Gameplay قبلی بدون Regression باقی مانده است (TEST_REPORT).»
