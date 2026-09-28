# راهنمای تولید Asset با هوش مصنوعی — FunnyCarIR

> نسخه: 1.0 | فاز: Phase 0
>
> این سند Promptهای آماده برای تولید تصویر با AI دارد. کافی است کپی کنید، در ابزار تولید تصویر بچسبانید، خروجی را طبق چک‌لیست بررسی و طبق ASSET_HANDBOOK_FA.md (گام ۴ تا ۱۰) وارد بازی کنید.

---

## 1. ⭐ بلاک ثابت سبک (Style Block) — به همه Promptها می‌چسبد

برای «هماهنگی سبک» (قانون بخش ۸ سند مادر)، این بلاک در **انتهای همه** Promptها تکرار می‌شود:

```text
STYLE BLOCK (copy this into every prompt):
Flat 2D cartoon style for a funny Persian mobile game, thick bold dark outline
(~8px relative), rounded cute shapes, warm cheerful palette (mustard yellow,
persian turquoise, brick red, cream), soft simple shading, high readability
on small mobile screen, minimal details, no gradients, no photorealism,
no text, clean vector look, consistent art direction, top-down three-quarter
view (for vehicles/props) — mobile game asset requirement.
```

**پالت رسمی پروژه:**
| نقش | کد رنگ | استفاده |
|---|---|---|
| زرد خردلی | `#F2B705` | تاکسی، سکه، هایلایت |
| فیروزه ایرانی | `#2A9D8F` | ساختمان‌ها، دکمه‌ها |
| قرمز فرشی | `#D64545` | خطر، وانت، قرمزی‌ها |
| کرم | `#FFF3D6` | پس‌زمینه‌های روشن |
| خط دور | `#3A2E2A` (قهوه‌ای تیره) | همه خطوط |
| آسفالت | `#575757` | جاده |
| سبز نعنایی | `#8AC926` | درخت، موفقیت |

**چک‌لیست بررسی خروجی AI (قبل از ورود به پروژه — قانون بخش ۳۷):**
- [ ] زاویه درست است (از بالا سه‌ربع برای ماشین/پروپ — نمای روبه‌رو برای پرتره)
- [ ] سبک کارتونی فلت است، نه واقع‌گرا
- [ ] خط دور ضخیم دارد
- [ ] رنگ‌ها با پالت بالا هم‌خوانی دارد
- [ ] پس‌زمینه تک‌رنگ و ساده است (برای حذف آسان)
- [ ] Proportion منطقی است (چرخ‌ها، درها...)
- [ ] متن/حروف اضافه در تصویر نیست (AI متن فارسی را خراب می‌کند — هیچ‌وقت نگذارید متن بنویسد)
- [ ] Scale مقایسه شده با یک Asset تأییدشده قبلی

---

## 2. Workflow کامل تولید (بخش ۳۵ سند مادر)

```text
Idea (از Inventory یکی انتخاب کن)
  ↓
Asset Specification (جدول Inventory: ابعاد/فرمت/نام/مسیر)
  ↓
AI Prompt (از همین سند کپی کن)
  ↓
Image Generation (چند خروجی بگیر، بهترین را انتخاب کن)
  ↓
Background Removal (Photopea — هندبوک گام ۴)
  ↓
Resize (به ابعاد جدول — فقط کوچک کردن، هرگز بزرگ‌سازی)
  ↓
Compression (squoosh.app)
  ↓
Naming (نام دقیق جدول — بخش ۳.۱ هندبوک)
  ↓
Import (کپی در مسیر جدول)
  ↓
Test (بازی را باز کن + چک‌لیست گام ۱۰ هندبوک)
  ↓
Optimization (validate_assets + به‌روزرسانی وضعیت Inventory)
  ↓
Final Build
```

---

## 3. Promptهای آماده (Batch 1)

### VEH-001 — ماشین بازیکن «پرنده ۱۳۱»

```text
-----------------------------------
ASSET ID: VEH-001

SUBJECT:
A small cute white compact hatchback car, inspired by classic Iranian city
cars but fully cartoon and original, tiny round headlights, slightly oversized
cabin with a visible funny mustached driver inside, sunroof, small scratch
detail on bumper for humor

TYPE: 2D cartoon vehicle sprite
CAMERA / PERSPECTIVE: top-down three-quarter view (bird's eye tilted ~20°,
car pointing UP), whole car visible and centered
LIGHTING: soft ambient, single soft shadow UNDER the car baked into the sprite
COLOR: white body, mustard-yellow roof stripe, turquoise door mirror
BACKGROUND: solid pure white background (#FFFFFF), no scene, no road
TRANSPARENCY: will be removed later — keep edges clean and crisp
CONSISTENCY: follow STYLE BLOCK, thick outline, rounded shapes
MOBILE: minimal details, readable at 140px width

REQUIREMENTS:
single object only, no wheels outside body silhouette, full car inside frame
with 10px margin, PNG-ready composition
-----------------------------------
```

### ENV-001 — کاشی جاده آسفالت (Seamless)

```text
-----------------------------------
ASSET ID: ENV-001

SUBJECT:
Seamless tileable asphalt road texture for a top-down 2D city driving game:
dark warm grey asphalt, one dashed white center line running vertically
through the middle (clean cartoon dashes), subtle lighter asphalt patches,
tiny cartoon cracks (2-3 max)

TYPE: seamless tile texture
CAMERA: straight top-down (90°, NO tilt for this one!)
LIGHTING: flat, NO shadows, NO directional light
COLOR: asphalt #575757, dashes cream white
BACKGROUND: fills entire canvas — must tile seamlessly on all 4 edges
TRANSPARENCY: none (opaque)

REQUIREMENTS:
texture must repeat without visible seams; dashes must start/end exactly at
edges so tiles continue each other; mobile game style per STYLE BLOCK
-----------------------------------
```

### CHAR-001 — پرتره راننده (بازیکن)

```text
-----------------------------------
ASSET ID: CHAR-001

SUBJECT:
Funny cartoon bust portrait of a middle-aged Iranian taxi driver: round face,
big friendly eyes, thick black mustache, tiny flat cap, striped polo shirt,
cheerful confident smile, one eyebrow slightly raised (comedic charm)

TYPE: 2D cartoon character portrait
CAMERA: front-facing bust (head + shoulders), centered
LIGHTING: flat soft light, no dramatic shadows
COLOR: warm skin tone, cream shirt with turquoise stripes
BACKGROUND: solid pure white (#FFFFFF), nothing else
TRANSPARENCY: edges must be crisp for background removal
CONSISTENCY: STYLE BLOCK — thick outline, rounded shapes, cute
MOBILE: readable at 120px display size, minimal detail

REQUIREMENTS:
single character only, no hands, no props, no text
-----------------------------------
```

> 🔁 الگوی همان Prompt برای حالت‌های دیگر راننده: فقط SUBJECT را عوض کنید →
> `_happy`: "big open joyful smile, eyes squinting with joy, small sweat drop
> none, thumbs-up pose NOT allowed (bust only)"
> `_shock`: "shocked face, wide round eyes, tiny open mouth, raised eyebrows"

---

## 4. Promptهای آماده (Batch 2 — برای فاز بعدی، از الان مستند می‌شود)

### VEH-002 — تاکسی نارنجی

```text
-----------------------------------
ASSET ID: VEH-002
SUBJECT: small cartoon orange taxi, same proportions as VEH-001, roof taxi
sign (empty orange box, NO text), driver silhouette visible, slightly worn
look for humor (one crooked bumper)
CAMERA / PERSPECTIVE / STYLE: identical to VEH-001 prompt + STYLE BLOCK
COLOR: taxi orange #F2B705 body, white doors, dark outline
BACKGROUND: solid pure white, single object, 10px margins
-----------------------------------
```

### VEH-003 — ماشین پلیس

```text
-----------------------------------
ASSET ID: VEH-003
SUBJECT: cartoon police car, white body with turquoise-blue doors, empty
light bar on roof (two blank boxes, red+blue, NOT glowing), funny tiny
police officer visible inside, no text, no real emblem — fully original design
CAMERA / PERSPECTIVE / STYLE: identical to VEH-001 + STYLE BLOCK
BACKGROUND: solid pure white, single object
-----------------------------------
```

### VEH-007 — سدان کپری (ترافیک)

```text
-----------------------------------
ASSET ID: VEH-007
SUBJECT: old cartoon beige sedan with dusty look, roof rack with a tied
blanket bundle (classic Iranian road-trip humor), visible bored driver
CAMERA / PERSPECTIVE / STYLE: identical to VEH-001 + STYLE BLOCK
BACKGROUND: solid pure white, single object
-----------------------------------
```

---

## 5. Promptهای Batch 3+ (محیط، Prop، UI — خلاصهٔ آماده)

| ID | Subject (بدنه پرامپت) | نکته ویژه |
|---|---|---|
| ENV-002 | seamless crossroad tile: asphalt + 4 white stop lines + zebra stripes on 4 sides | straight top-down 90° |
| ENV-003 | seamless sidewalk tile: cream concrete squares with thin joint lines | no shadows |
| ENV-004 | seamless courtyard ground: warm sand color with tiny pebbles | no shadows |
| ENV-005 | two-story cartoon corner shop building, turquoise awning, empty sign board (no text) | top-down 3/4، سایه خودش |
| ENV-006 | small brick cartoon house, flat roof with water tank + satellite dish | top-down 3/4 |
| ENV-007 | cartoon auto repair garage, big open door, tire stacks inside | top-down 3/4 |
| ENV-008 | cartoon gas station: canopy on 2 columns, 2 fuel pumps | top-down 3/4، بزرگ‌ترین |
| PROP-001 | cartoon green trash bin with banana peel beside it | top-down 3/4 |
| PROP-002 | orange-white cartoon traffic cone | top-down 3/4 |
| PROP-003 | cute round cartoon tree (chinar + pine, 2 variants) | top-down 3/4 |
| PROP-008 | cartoon pothole: dark asphalt hole with funny cracked edges | straight top-down |
| UI-003 | shiny cartoon gold coin with star emboss | front view |
| UI-004 | cartoon cup of tea in estekan (persian glass) with steam = "reputation" icon | front view |
| FX-001 | 6-frame sprite sheet of cartoon smoke puff growing & fading, arranged in a horizontal row | frames equal size 128×128 |

> برای همه: STYLE BLOCK انتهای Prompt + پس‌زمینه سفید + تک‌شیء.

---

## 6. اگر خروجی AI خوب نشد چه؟ (عیب‌یابی)

| مشکل | راه‌حل |
|---|---|
| زاویه اشتباه شد (نمای پهلو) | عبارت "top-down bird's eye view" را اول Subject بیاورید + "side view, front view are WRONG" |
| سبک واقع‌گرا شد | "photorealistic, realistic, 3D render" را در Negative Prompt بگذارید + "flat cartoon vector" را تقویت کنید |
| پس‌زمینه شلوغ شد | "isolated object on plain white background, no environment" اضافه کنید |
| خط دور نازک است | "very thick dark outline, bold contour lines" را تکرار کنید |
| رنگ‌ها پراکنده شد | کد رنگ دقیق بدهید (body color #RRGGBB) |
| چند شیء تولید شد | "single object only, nothing else in frame" |

---

## 7. ثبت منبع (قانون بخش ۵۷ سند مادر)

برای هر Asset تولیدشده با AI، این ردیف در انتهای ASSET_INVENTORY_FA.md (جدول مجوز) اضافه/تأیید می‌شود:

```text
Asset: VEH-001 | Source: AI-generated (ابزار: ______) | License: متعلق به پروژه |
Commercial: ✅ | Attribution: ✖ | Modification: ✅ | تاریخ: ____ | تولیدکننده Prompt: فایل docs/ASSET_GENERATION_GUIDE_FA.md
```
