/**
 * gen_batch2.mjs — تولید تصاویر Batch 2 با هوش مصنوعی
 * ============================================================
 * طبق docs/ASSET_GENERATION_GUIDE_FA.md بخش ۴ و ۵ (Promptهای رسمی):
 *   VEH-002 تاکسی، VEH-003 پلیس، VEH-004 وانت، VEH-007 سدان کپری
 *   ENV-005 مغازه، ENV-006 خانه، ENV-007 تعمیرگاه، ENV-008 پمپ بنزین
 * خروجی خام → scripts/raw_assets/ → پردازش با process_batch2.py
 *
 * اجرا: cd /home/z/my-project && node scripts/gen_batch2.mjs
 */

import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'scripts', 'raw_assets');
fs.mkdirSync(OUT, { recursive: true });

const STYLE =
  'flat 2D cartoon style for a funny Persian mobile game, thick bold dark brown outline, ' +
  'rounded cute shapes, warm cheerful palette, soft simple shading, minimal details, ' +
  'clean vector look, mobile game asset, high quality';

// نمای مشترک همه Vehicleها (مطابق قاعده VEH سند Inventory)
const VEHICLE_VIEW =
  'Top-down three-quarter view game sprite, bird eye view tilted about 20 degrees, ' +
  'vehicle pointing straight UP toward the top of frame, small soft shadow directly ' +
  'under the vehicle, tiny round headlights, ';

const JOBS = [
  // ================= vehicles (نسبت 4:7 مثل VEH-001) =================
  {
    name: 'veh_taxi_01',
    size: '768x1344',
    prompt:
      VEHICLE_VIEW +
      'small cute orange taxi car, taxi orange body, white doors, empty orange taxi sign ' +
      'box on the roof with NO text, funny mustached driver visible through the windows, ' +
      'slightly worn look for humor with one crooked front bumper, ' +
      STYLE +
      ', isolated on plain pure white background, nothing else in frame, no text, no road, no environment',
  },
  {
    name: 'veh_police_01',
    size: '768x1344',
    prompt:
      VEHICLE_VIEW +
      'cute cartoon police car, white body with turquoise-blue doors, empty light bar on ' +
      'the roof made of two small blank boxes one red and one blue NOT glowing, funny tiny ' +
      'police officer with peaked cap visible inside, no text, no real emblem, fully ' +
      'original design, ' +
      STYLE +
      ', isolated on plain pure white background, nothing else in frame, no text',
  },
  {
    name: 'veh_pickup_01',
    size: '768x1344',
    prompt:
      VEHICLE_VIEW +
      'small cute red pickup truck with an open cargo bed carrying two tied cardboard ' +
      'boxes and one watermelon, cheerful driver with a flat cap visible through the ' +
      'cabin windows, ' +
      STYLE +
      ', isolated on plain pure white background, nothing else in frame, no text, no road, no environment',
  },
  {
    name: 'veh_sedan_01',
    size: '768x1344',
    prompt:
      VEHICLE_VIEW +
      'old cute faded turquoise-blue compact sedan with a dusty worn look, roof rack with ' +
      'a tied blanket bundle on top for classic road trip humor, bored sleepy driver ' +
      'visible through the windows, ' +
      STYLE +
      ', isolated on plain pure white background, nothing else in frame, no text, no road, no environment',
  },

  // ================= buildings (نمای top-down 3/4 — سایه خودش) =================
  {
    name: 'env_building_shop_01',
    size: '768x1024',
    prompt:
      'Top-down three-quarter view game sprite of a two-story cartoon corner shop ' +
      'building, turquoise striped awning over the storefront, empty blank sign board ' +
      'above the door with NO text, flat roof with a small round water tank, warm cream ' +
      'walls, soft shadow directly under the building, ' +
      STYLE +
      ', isolated on plain pure white background, single object, no text',
  },
  {
    name: 'env_building_home_01',
    size: '768x1024',
    prompt:
      'Top-down three-quarter view game sprite of a small cute cartoon brick house, flat ' +
      'roof with a round water tank and one satellite dish, two windows with tiny flower ' +
      'boxes, warm red brick walls, small green yard patch in front, soft shadow directly ' +
      'under the building, ' +
      STYLE +
      ', isolated on plain pure white background, single object, no text',
  },
  {
    name: 'env_building_garage_01',
    size: '768x1024',
    prompt:
      'Top-down three-quarter view game sprite of a cartoon auto repair garage building, ' +
      'big open garage door showing tire stacks and simple tools inside, grey corrugated ' +
      'metal roof, two oil barrels beside the wall, soft shadow directly under the ' +
      'building, ' +
      STYLE +
      ', isolated on plain pure white background, single object, no text',
  },
  {
    name: 'env_gas_station_01',
    size: '1024x1024',
    prompt:
      'Top-down three-quarter view game sprite of a cute cartoon gas station, the largest ' +
      'building of the set: big flat white-and-orange canopy roof on two columns with two ' +
      'small cartoon fuel pumps underneath, tiny kiosk building beside it, one empty ' +
      'price sign board with NO text, soft shadow directly under it, ' +
      STYLE +
      ', isolated on plain pure white background, single object, no text',
  },
];

async function main() {
  const zai = await ZAI.create();
  const report = [];
  for (const job of JOBS) {
    const outPath = path.join(OUT, `${job.name}.png`);
    // اگر خروجی موفق قبلی موجود است، دوباره تولید نکن (Idempotent — برای ری‌ران)
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 20000) {
      console.log(`↷ skip ${job.name} (already exists)`);
      report.push({ name: job.name, ok: true });
      continue;
    }
    let ok = false;
    let lastErr = '';
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const res = await zai.images.generations.create({ prompt: job.prompt, size: job.size });
        const b64 = res?.data?.[0]?.base64;
        if (!b64) throw new Error('empty base64');
        fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
        const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
        console.log(`✓ ${job.name}.png (${kb}KB)`);
        ok = true;
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        console.warn(`✗ attempt ${attempt} failed for ${job.name}: ${lastErr}`);
        await new Promise((r) => setTimeout(r, 1200 * attempt));
      }
    }
    report.push({ name: job.name, ok, error: ok ? '' : lastErr });
  }
  const failed = report.filter((r) => !r.ok);
  console.log(`\nDone: ${report.length - failed.length}/${report.length}`);
  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.name).join(', '));
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
