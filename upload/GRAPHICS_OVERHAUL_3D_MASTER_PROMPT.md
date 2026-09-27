# GRAPHICS_OVERHAUL_3D_MASTER_PROMPT.md

# مأموریت اصلی

تو مسئول انجام یک **Graphics Overhaul واقعی و Production-Ready** برای پروژه بازی ماشین فعلی هستی.

هدف فقط «زیباتر کردن چند رنگ یا اضافه کردن چند BoxGeometry» نیست.

باید پروژه فعلی را بررسی کنی، باگ‌های موجود را پیدا و رفع کنی، سپس سیستم گرافیکی 3D را به سطح بسیار بالاتری برسانی؛ به‌خصوص:

- مدل‌های سه‌بعدی واقعی و باکیفیت
- خودروهای ایرانی یا ایرانی‌الهام، بدون وابستگی به لوگو و برندهای دارای محدودیت
- خیابان و محیط شهری با جزئیات واقعی
- متریال PBR
- نورپردازی حرفه‌ای
- سایه
- LOD
- بهینه‌سازی WebGL و Android
- دوربین بهتر
- افکت‌های تصادف و حرکت
- محیط شهری زنده‌تر
- UI فارسی سالم و بدون Regression
- حفظ تمام Gameplay فعلی
- رفع باگ‌های موجود
- تست واقعی بعد از تغییرات

---

# قانون بسیار مهم

## این پروژه را از صفر بازنویسی نکن.

کد فعلی، Gameplay، منطق بازی، Save System، Input، Traffic، Collision، Mission/Event Logic، Audio Hooks و UI فعلی باید تا جای ممکن حفظ شوند.

هدف:

> **Fix + Refactor where necessary + Graphics Overhaul**

نه:

> Rewrite the whole game.

هر تغییری که باعث شکستن قابلیت موجود شود غیرقابل قبول است.

---

# قانون شماره 1: اول Audit، بعد تغییر

قبل از اینکه حتی یک سیستم گرافیکی را بازنویسی کنی:

1. کل پروژه را Scan کن.
2. ساختار فایل‌ها را بررسی کن.
3. Entry Pointها را پیدا کن.
4. Game Loop را بررسی کن.
5. Renderer را بررسی کن.
6. Scene/World را بررسی کن.
7. Player Vehicle را بررسی کن.
8. Traffic را بررسی کن.
9. Collision را بررسی کن.
10. Camera را بررسی کن.
11. Input را بررسی کن.
12. UI را بررسی کن.
13. Audio را بررسی کن.
14. Save/Load را بررسی کن.
15. Mission/Event را بررسی کن.
16. Asset Loading را بررسی کن.
17. Android/Capacitor integration را بررسی کن.
18. تمام TODO/FIXME/placeholderها را پیدا کن.
19. خطاهای TypeScript/JavaScript را پیدا کن.
20. Runtime Errorها را پیدا کن.
21. Memory Leakهای احتمالی را پیدا کن.
22. مواردی که باعث FPS Drop می‌شوند را پیدا کن.

ابتدا یک گزارش داخلی از وضعیت فعلی بساز.

---

# قانون شماره 2: هیچ Regression مجاز نیست

پس از هر تغییر، موارد زیر باید همچنان کار کنند:

- Start Game
- Restart
- Pause
- Resume
- Steering
- Acceleration
- Brake
- Reverse
- Camera
- Collision
- Traffic
- Random Events
- Mission/Event system
- Fuel/vehicle state در صورت وجود
- Score/coins/economy در صورت وجود
- Save
- Load
- Audio
- Voice hooks
- UI
- Menus
- Game Over
- Return to Menu
- Mobile touch controls در صورت وجود
- Keyboard controls
- Android/Capacitor flow در صورت وجود

اگر قابلیت جدیدی باعث خراب شدن یکی از این موارد شد، تغییر را تا رفع Regression ادامه بده.

---

# بخش A — Bug Fix Audit

قبل از Graphics Overhaul باید Bug Fix Pass کامل انجام شود.

## A1 — Compile Errors

بررسی:

- TypeScript errors
- JavaScript errors
- invalid imports
- circular dependencies
- undefined variables
- undefined functions
- invalid types
- unreachable code
- incorrect async handling
- missing modules
- broken paths

اجرای:

```bash
npm install
npm run build
```

و هر command واقعی دیگری که در package.json وجود دارد.

اگر test/lint/typecheck وجود دارد:

```bash
npm run test
npm run lint
npm run typecheck
```

فقط در صورتی اجرا کن که این scripts در پروژه وجود داشته باشند.

---

# A2 — Runtime Errors

در Browser/Chromium:

- Console errors
- unhandled promise rejection
- failed asset loading
- WebGL errors
- shader errors
- texture errors
- audio errors
- scene initialization errors
- game loop errors

باید بررسی شوند.

---

# A3 — Game State Bugs

بررسی کن که:

- Start چندبار قابل اجرا نباشد.
- Pause باعث چند Game Loop نشود.
- Restart منابع قبلی را آزاد کند.
- Scene دوباره ساخته شود بدون اینکه objectهای قبلی باقی بمانند.
- Traffic دوباره duplicate نشود.
- Event listenerها چندبار ثبت نشوند.
- Audio listenerها duplicate نشوند.
- timers/intervals بعد از restart باقی نمانند.
- animation frameهای قبلی باقی نمانند.

---

# A4 — Collision Bugs

بررسی:

- Player vs Traffic
- Player vs Buildings
- Player vs Props
- Player vs Road boundaries
- Player vs mission objects
- Collision هنگام سرعت بالا
- Collision بعد از restart
- Collision بعد از pause/resume

از tunneling تا جای ممکن جلوگیری کن.

---

# A5 — Traffic Bugs

بررسی:

- spawn خارج از map
- spawn داخل player
- spawn داخل building
- duplicate traffic
- traffic بدون movement
- traffic stuck
- traffic خارج از world بدون cleanup
- traffic collision
- traffic بعد از restart
- traffic memory leak

---

# A6 — Camera Bugs

بررسی:

- camera jitter
- camera clipping
- camera داخل ساختمان
- camera داخل ماشین
- camera هنگام collision
- camera هنگام reverse
- camera بعد از restart
- camera هنگام تغییر vehicle
- camera هنگام pause

Camera باید smooth باشد ولی input را با تأخیر آزاردهنده دنبال نکند.

---

# A7 — Asset Loading Bugs

هر Asset باید:

- path معتبر داشته باشد
- loading state داشته باشد
- failure handling داشته باشد
- fallback داشته باشد
- duplicate loading نداشته باشد
- cache مناسب داشته باشد

اگر GLB/GLTF وجود دارد:

- load
- parse
- material
- texture
- animation
- error handling

را بررسی کن.

---

# A8 — Save/Load Bugs

Graphics Overhaul نباید Save Data را خراب کند.

قبل و بعد از تغییرات تست کن:

- new save
- existing save
- load
- migration
- corrupted save
- missing save
- reset
- version upgrade

اطلاعات قبلی کاربر نباید بدون دلیل حذف شود.

---

# بخش B — Graphics Architecture Overhaul

## وضعیت فعلی

پروژه ممکن است از primitiveهای Three.js مثل:

- BoxGeometry
- CylinderGeometry
- ExtrudeGeometry
- PlaneGeometry

استفاده کند.

این primitiveها برای Prototype قابل قبول هستند.

اما:

> **Primitive Geometry نباید Asset نهایی خودرو و محیط باشد.**

---

# قانون کلیدی: NO PRIMITIVE FINAL ASSETS

برای Assetهای اصلی:

- Player Car
- Taxi
- Police Car
- Traffic Cars
- Pickup
- NPC Vehicles
- Main Buildings
- Gas Station
- Shops
- Important Props

تا حد امکان از:

```text
GLB / GLTF
```

استفاده کن.

Primitiveها فقط برای:

- prototype
- collision proxy
- debug
- very small background props
- procedural objects ساده

مجاز هستند.

---

# بخش C — 3D Asset Pipeline

Pipeline هدف:

```text
3D Asset
   ↓
Blender / Procedural Blender Generator / External Asset Source
   ↓
UV
   ↓
PBR Materials
   ↓
LOD
   ↓
GLB
   ↓
Three.js GLTFLoader
   ↓
AssetManager
   ↓
Scene
   ↓
Mobile Optimization
```

---

# بخش D — خودروهای ایرانی

برای خودروها از طراحی‌های:

- ایرانی
- ایرانی‌الهام
- شهری
- تاکسی
- پلیس
- وانت
- خودرو اقتصادی
- خودرو قدیمی
- خودرو خانوادگی

استفاده کن.

نمونه دسته‌ها:

### 1. Classic Iranian Sedan

یک سدان قدیمی ایرانی‌الهام با:

- بدنه واقعی
- چراغ جلو
- چراغ عقب
- جلوپنجره
- سپر
- آینه
- دستگیره
- شیشه
- لاستیک
- رینگ
- پلاک
- داشبورد در صورت نیاز

### 2. Modern Economy Sedan

سدان اقتصادی ایرانی‌الهام.

### 3. Hatchback

هاچ‌بک شهری.

### 4. Pickup

وانت شهری ایرانی‌الهام.

### 5. Taxi

نسخه تاکسی.

### 6. Police

نسخه پلیس.

### 7. Funny Vehicles

خودروهای طنز:

- ماشین مکانیکی
- ماشین عروسی
- ماشین خیلی قدیمی
- ماشین باربری عجیب
- ماشین پر از وسایل
- ماشین رنگارنگ NPC

---

# نکته حقوقی/برندی

از لوگوها، علائم تجاری و طراحی دقیق برندهای واقعی فقط در صورتی استفاده کن که مجوز/حق استفاده وجود داشته باشد.

در حالت پیش‌فرض:

> طراحی‌ها باید **fictional / Iranian-inspired** باشند.

یعنی حس خودروهای آشنا و ایرانی را منتقل کنند اما وابسته به کپی مستقیم برند نباشند.

---

# بخش E — کیفیت مدل خودرو

هر Vehicle مهم باید حداقل این موارد را داشته باشد:

- realistic proportions
- clean topology
- proper normals
- UV mapping
- PBR materials
- glass material
- rubber material
- metal material
- paint material
- headlights
- taillights
- wheels
- rims
- mirrors
- bumpers
- doors
- windows

در صورت امکان:

- steering wheel
- dashboard
- seats
- interior

اما Interior فقط وقتی اضافه شود که Camera واقعاً آن را ببیند.

---

# بخش F — LOD

برای Assetهای مهم:

```text
LOD0 = High Quality
LOD1 = Medium
LOD2 = Low
LOD3 = Very Low / Billboard where appropriate
```

مثلاً خودرو:

### LOD0

نزدیک دوربین:

- 30k–80k triangles حدودی، بسته به اهمیت Asset

### LOD1

- 10k–30k

### LOD2

- 3k–10k

### LOD3

- بسیار سبک

این اعداد Target هستند، نه قانون مطلق.

مهم‌تر از تعداد Triangle:

- visual quality
- draw calls
- material count
- texture memory
- mobile FPS

است.

---

# بخش G — PBR

Materialهای اصلی باید تا جای ممکن دارای:

```text
Base Color
Normal
Roughness
Metalness
AO
```

باشند.

برای خودرو:

- paint
- metal
- glass
- rubber

Material جداگانه داشته باشند.

از Materialهای بی‌دلیل زیاد استفاده نکن.

---

# بخش H — Texture Strategy

Textureها باید:

- optimized
- compressed where supported
- power-of-two where useful
- mipmapped
- appropriately sized

باشند.

برای Mobile:

تا حد امکان از Textureهای غیرضروری 4K برای objectهای کوچک استفاده نکن.

هدف:

```text
512
1024
2048
```

بر اساس فاصله و اهمیت Asset.

---

# بخش I — خیابان و شهر ایرانی

محیط باید از حالت:

> چند Box کنار Road

خارج شود.

باید اضافه شود:

## Road

- asphalt texture
- road patches
- cracks
- faded markings
- lane markings
- crosswalk
- manholes
- drainage
- curbs
- sidewalks
- gutters
- potholes

---

# Buildings

انواع:

- apartment
- old houses
- modern shops
- bakery
- supermarket
- restaurant
- repair shop
- mechanic
- bank
- pharmacy-style generic storefront
- parking
- gas station
- warehouse
- office

Buildingها باید variation داشته باشند:

- height
- facade
- windows
- balconies
- colors/materials
- signs
- roof details

---

# Street Props

اضافه کن:

- utility poles
- cables
- traffic lights
- street signs
- Persian signs
- billboards
- trash cans
- benches
- trees
- bushes
- planters
- barriers
- cones
- parked cars
- bus stop
- street lamps
- fences
- walls
- gates
- storefront props

---

# بخش J — Persian / Iranian Atmosphere

محیط باید حس یک شهر ایرانی را منتقل کند.

استفاده از:

- تابلوهای فارسی
- تابلوهای خیابان
- تبلیغات خیالی فارسی
- مغازه‌های ایرانی‌الهام
- تاکسی
- وانت
- موتورسیکلت در صورت وجود
- کیوسک
- نانوایی/فروشگاه/تعمیرگاه
- دیوارنوشته‌های طنز و غیرسیاسی

مجاز است.

از متن‌های واقعی حساس یا تبلیغات برندهای واقعی بدون مجوز استفاده نکن.

---

# بخش K — Lighting Overhaul

نورپردازی باید از حالت flat خارج شود.

حداقل بررسی:

- Directional Light
- Ambient/Environment Light
- Hemisphere/Environment lighting
- Shadows
- Fog
- Tone Mapping
- Color Space
- Exposure
- Ambient Occlusion در صورت مقرون‌به‌صرفه بودن

برای Mobile از افکت‌های سنگین بدون Benchmark استفاده نکن.

---

# بخش L — Shadows

Shadow باید:

- Player
- Traffic
- Buildings
- Important Props

را تا حد مناسب پوشش دهد.

اما:

> Shadow quality باید با FPS متعادل شود.

Shadow Map resolution را بی‌دلیل بالا نبر.

---

# بخش M — Camera Overhaul

Camera باید حس یک بازی واقعی ماشین بدهد.

ویژگی‌ها:

- smooth follow
- subtle lag
- look-ahead
- speed-based distance
- speed-based FOV
- collision avoidance
- terrain awareness
- camera shake هنگام crash
- camera shake بسیار محدود هنگام acceleration
- stable horizon
- reverse camera behavior

Camera نباید:

- jitter داشته باشد
- داخل building برود
- داخل vehicle برود
- هنگام crash کنترل را از player بگیرد
- بعد از restart خراب شود

---

# بخش N — Vehicle Presentation

ماشین Player باید:

- suspension movement
- wheel rotation
- steering wheel angle
- body movement
- brake light
- headlight
- turn indicator در صورت وجود
- crash reaction

داشته باشد.

حرکت باید طبیعی باشد.

---

# بخش O — Crash Visuals

هنگام تصادف:

- camera shake
- impact effect
- small particles
- tire skid
- sound trigger
- body reaction

اما:

> افکت‌ها نباید باعث افت شدید FPS شوند.

---

# بخش P — Particle System

Particleها برای:

- smoke
- dust
- crash
- skid
- sparks
- exhaust
- rain در صورت وجود

استفاده شوند.

از ایجاد هزاران Mesh مستقل برای particleها خودداری کن.

در صورت نیاز از:

- InstancedMesh
- Sprite
- GPU-friendly particle approach

استفاده کن.

---

# بخش Q — Renderer Optimization

حتماً بررسی کن:

- frustum culling
- object pooling
- instancing
- batching
- LOD
- texture reuse
- material reuse
- geometry reuse
- draw call count
- shadow cost
- overdraw
- memory usage

---

# بخش R — AssetManager

یک AssetManager استاندارد بساز یا سیستم فعلی را اصلاح کن.

باید بتواند:

```ts
loadGLTF()
loadTexture()
getAsset()
preload()
release()
has()
```

یا معادل مناسب پروژه را ارائه کند.

قابلیت‌ها:

- caching
- duplicate-load prevention
- loading progress
- error fallback
- asset versioning در صورت نیاز

---

# بخش S — GLB Loading

برای Three.js از روش استاندارد استفاده کن:

```ts
GLTFLoader
```

و در صورت نیاز:

- DRACO
- Meshopt
- KTX2

را بررسی کن.

اما فقط وقتی اضافه کن که واقعاً به پروژه کمک کند.

---

# بخش T — Blender Integration

اگر GLM توانایی تولید فایل مدل مستقیم ندارد:

به جای Fake کردن مدل حرفه‌ای با Three.js primitive:

> Blender Python Generator بساز.

مثلاً:

```text
tools/blender/
    generate_cars.py
    generate_city.py
    generate_props.py
    export_glb.py
```

این Scriptها بتوانند Assetهای پایه تولید کنند.

اما خروجی نهایی باید:

```text
.glb
```

باشد.

---

# بخش U — Graphics Benchmark Scene

قبل از تغییر کل بازی، یک Scene تست بساز:

```text
GRAPHICS_BENCHMARK
```

شامل:

- Player Car
- Taxi
- Police Car
- Traffic Car
- Road
- Sidewalk
- Apartment
- Shop
- Gas Station
- Trees
- Street Lights
- Persian Signs
- NPC/Traffic
- Props

این Scene باید معیار اصلی کیفیت گرافیکی باشد.

---

# بخش V — Quality Target

گرافیک نهایی نباید شبیه:

```text
BoxGeometry city
```

باشد.

هدف:

```text
Stylized High-Quality 3D
+
Iranian Urban Atmosphere
+
Mobile-Friendly
+
Clean PBR
+
Good Lighting
+
Detailed Vehicles
```

است.

سبک می‌تواند Stylized باشد، اما نباید Primitive و خام به نظر برسد.

---

# بخش W — UI Preservation

UI فعلی نباید بدون دلیل تغییر کند.

بررسی:

- Persian RTL
- فونت
- button click
- menu
- pause
- restart
- settings
- audio
- graphics settings
- touch controls

هر تغییر گرافیکی نباید UI را خراب کند.

---

# بخش X — Audio / Voice Preservation

سیستم Audio و Voice فعلی باید حفظ شود.

Graphics Overhaul نباید:

- Audio Manager را خراب کند.
- Voice hooks را حذف کند.
- event triggers را حذف کند.
- crash sound را خراب کند.
- engine sound را خراب کند.

اگر Audio Trigger به objectهای قدیمی وابسته است، آن را به architecture جدید منتقل کن.

---

# بخش Y — Debug Mode

یک Debug Mode قابل خاموش/روشن شدن داشته باش.

در Debug Mode امکان نمایش:

- FPS
- Draw Calls
- Triangles
- Texture Memory در صورت امکان
- Object Count
- Active Vehicles
- Active Particles
- Camera position
- Player state
- Game state
- Asset loading state

وجود داشته باشد.

این بخش نباید در Production UI اصلی مزاحم باشد.

---

# بخش Z — Mobile / Android Performance

این پروژه قرار است در نهایت روی Android اجرا شود.

پس Desktop FPS به تنهایی معیار قبولی نیست.

بررسی:

- low-end Android
- mid-range Android
- high-end Android

هدف تقریبی:

```text
30 FPS minimum acceptable
45+ FPS preferred
60 FPS target on capable devices
```

اگر سخت‌افزار اجازه دهد.

---

# بخش AA — Performance Budget

برای Scene اصلی Target تعریف کن:

```text
Stable frame time
Controlled draw calls
Controlled texture memory
Controlled triangle count
No continuous allocation in render loop
No unnecessary garbage collection
No runaway particle count
No duplicate assets
```

در Render Loop تا حد امکان از:

```ts
new ...
```

برای objectهای موقتی سنگین خودداری کن.

---

# بخش AB — Memory Leak Audit

مخصوصاً بررسی:

```text
addEventListener
removeEventListener

setInterval
clearInterval

setTimeout
clearTimeout

requestAnimationFrame
cancelAnimationFrame

scene.add
scene.remove

geometry.dispose
material.dispose
texture.dispose
renderer.dispose
```

Restart و Scene transition باید memory را کنترل کنند.

---

# بخش AC — Error Recovery

اگر Asset اصلی Load نشد:

Game نباید Crash کند.

باید:

1. خطا log شود.
2. fallback نمایش داده شود.
3. Game قابل ادامه باشد.
4. UI در صورت نیاز پیام مناسب نشان دهد.

---

# بخش AD — Fake Completion ممنوع

این موارد قابل قبول نیست:

- گفتن «مدل 3D حرفه‌ای ساخته شد» در حالی که هنوز BoxGeometry است.
- قرار دادن placeholder با نام final.
- ساختن texture جعلی و اعلام PBR.
- قرار دادن فایل خالی GLB.
- ساختن مدل ساده و اعلام High Quality.
- حذف قابلیت‌های قبلی برای ساده‌تر شدن پروژه.
- مخفی کردن Runtime Error.
- disable کردن testها برای سبز شدن build.

---

# بخش AE — قبل از هر Asset جدید

برای هر Asset مهم مشخص کن:

```text
Asset Name
Purpose
Source
Format
Triangle Count
Texture Size
Material Count
LOD Count
Collision Strategy
Animation
Mobile Cost
```

---

# بخش AF — File Structure

در صورت هماهنگ بودن با معماری فعلی:

```text
src/
  game/
    render3d/
    assets/
    vehicles/
    world/
    camera/
    effects/
    performance/

public/
  assets/
    models/
      vehicles/
      buildings/
      props/
      environment/
    textures/
      vehicles/
      buildings/
      environment/
    audio/
    voices/

tools/
  blender/
```

ساختار فعلی پروژه را بدون نیاز تغییر نده.

---

# بخش AG — تست End-to-End

بعد از تغییرات این سناریوها را اجرا کن:

## Test 01
Launch

## Test 02
Main Menu

## Test 03
Start Game

## Test 04
Drive

## Test 05
Steering

## Test 06
Brake

## Test 07
Reverse

## Test 08
Traffic

## Test 09
Collision

## Test 10
Crash

## Test 11
Pause

## Test 12
Resume

## Test 13
Restart

## Test 14
Save

## Test 15
Load

## Test 16
Mission/Event

## Test 17
Audio

## Test 18
Voice Hook

## Test 19
Settings

## Test 20
Mobile Controls

## Test 21
Asset Loading Failure

## Test 22
Long Session

حداقل یک تست Long Session انجام بده تا:

- memory leak
- FPS degradation
- object accumulation

مشخص شود.

---

# بخش AH — Visual QA

حداقل این نماها را بررسی کن:

### Shot 1
Main Menu

### Shot 2
Player close-up

### Shot 3
Normal driving

### Shot 4
Traffic

### Shot 5
City street

### Shot 6
Gas station

### Shot 7
Shop area

### Shot 8
Night/evening اگر وجود دارد

### Shot 9
Crash

### Shot 10
Graphics Benchmark

در هر Shot بررسی کن:

- lighting
- shadows
- texture quality
- geometry
- aliasing
- clipping
- pop-in
- LOD transition
- camera
- UI
- visual consistency

---

# بخش AI / GLM Execution Rules

اگر به Asset واقعی نیاز داری و امکان تولید مستقیم مدل وجود ندارد:

1. Blender generator بساز.
2. خروجی GLB تولید کن.
3. GLB را به پروژه متصل کن.
4. Loader را تست کن.
5. fallback قرار بده.
6. screenshot بگیر.
7. performance را بررسی کن.

هرگز به جای Asset واقعی، چند primitive را صرفاً rename نکن.

---

# مرحله‌بندی اجباری

## PHASE 0 — Baseline

ثبت کن:

- build status
- current FPS
- current draw calls
- current triangle count
- current asset count
- current runtime errors
- current visual screenshots

---

## PHASE 1 — Bug Fix Pass

تمام باگ‌های واضح و Regressionهای فعلی را رفع کن.

خروجی:

```text
BUG_FIX_REPORT.md
```

شامل:

```text
Bug
Location
Cause
Fix
Test
Status
```

---

## PHASE 2 — Renderer Foundation

اصلاح:

- color management
- renderer configuration
- lighting
- shadows
- tone mapping
- fog
- camera
- resize handling
- device pixel ratio

---

## PHASE 3 — Asset Pipeline

پیاده‌سازی:

- GLTFLoader
- AssetManager
- GLB loading
- caching
- error fallback
- optional compression support

---

## PHASE 4 — Vehicle Overhaul

اول فقط این‌ها:

1. Player Car
2. Taxi
3. Police
4. Traffic Car
5. Pickup

بعد از تأیید کیفیت، سایر Vehicleها.

---

## PHASE 5 — City Overhaul

اول:

- Road
- Sidewalk
- Apartment
- Shop
- Gas Station
- Street Props

بعد گسترش Map.

---

## PHASE 6 — Effects

- crash
- smoke
- dust
- skid
- lights
- particles

---

## PHASE 7 — Performance

- LOD
- Instancing
- pooling
- culling
- texture optimization
- memory optimization

---

## PHASE 8 — Android Validation

Build Android را بررسی کن.

اگر Capacitor یا Android wrapper وجود دارد:

- build
- launch
- touch
- orientation
- audio
- performance
- asset loading

بررسی شود.

---

# Quality Gate

کار را «تمام‌شده» اعلام نکن مگر اینکه:

## Code

- build موفق
- no critical runtime error
- no broken imports
- no obvious memory leak

## Gameplay

- core gameplay سالم
- input سالم
- collision سالم
- traffic سالم
- save/load سالم
- pause/restart سالم

## Graphics

- اصلی‌ترین خودروها primitive نباشند
- GLB/GLTF pipeline سالم باشد
- PBR برای Assetهای اصلی وجود داشته باشد
- LOD وجود داشته باشد
- lighting مناسب باشد
- shadow مناسب باشد
- city detail افزایش محسوس داشته باشد
- camera حرفه‌ای‌تر شده باشد

## Performance

- FPS پایدار
- draw call کنترل‌شده
- texture memory کنترل‌شده
- no runaway allocations

## Mobile

- Android build سالم
- touch سالم
- asset loading سالم
- performance قابل قبول

---

# Acceptance Criteria

در پایان باید بتوانی این جمله را با شواهد ثابت کنی:

> «پروژه فقط ظاهرش تغییر نکرده؛ باگ‌های موجود رفع شده‌اند، Graphics Pipeline به GLB/GLTF و PBR/LOD ارتقا یافته، محیط و خودروها واقعاً 3D و باکیفیت‌تر شده‌اند و Gameplay قبلی بدون Regression باقی مانده است.»

---

# Final Deliverables

در پایان این فایل‌ها/گزارش‌ها را ارائه کن:

```text
BUG_FIX_REPORT.md
GRAPHICS_OVERHAUL_REPORT.md
PERFORMANCE_REPORT.md
ASSET_INVENTORY.md
TEST_REPORT.md
```

در گزارش نهایی برای هر مورد بنویس:

```text
Status:
Changed:
Why:
Files:
Tests:
Result:
```

---

# Final Rule

اگر بین:

```text
Visual Quality
```

و

```text
Gameplay Stability
```

تعارض ایجاد شد:

اول Gameplay را سالم نگه دار و سپس Graphics را اصلاح کن.

اگر بین:

```text
Graphics Quality
```

و

```text
Mobile Performance
```

تعارض ایجاد شد:

Asset و Renderer را Optimize کن؛
قابلیت اصلی بازی را حذف نکن.

اگر یک Asset واقعاً با کیفیت کافی قابل تولید نیست:

> آن را به عنوان Final Asset اعلام نکن.

شفاف گزارش بده و مسیر تولید واقعی آن را مشخص کن.

---

# دستور نهایی به GLM

از همین پروژه فعلی شروع کن.

**اول Audit و Bug Fix.**

**دوم Renderer و Asset Pipeline.**

**سوم Vehicle Quality.**

**چهارم City Quality.**

**پنجم Effects.**

**ششم Performance.**

**هفتم Android Validation.**

هر مرحله باید بعد از تست موفق وارد مرحله بعد شود.

هیچ قابلیت فعلی را بدون دلیل حذف نکن.

هیچ Placeholder را Final اعلام نکن.

هیچ Primitive را به عنوان مدل سه‌بعدی حرفه‌ای نهایی قبول نکن.

هدف نهایی:

> یک بازی ماشین 3D فارسی، طنز، ایرانی‌الهام، چشم‌نواز، روان، قابل اجرا روی Android و دارای معماری قابل توسعه؛ نه یک Prototype با چند Box سه‌بعدی.
