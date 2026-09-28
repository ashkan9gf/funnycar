/**
 * gen_batch2_fix.mjs — بازتولید ۴ خودروی Batch 2 که در بازبینی رد شدند
 * ============================================================
 * دلایل رد:
 *  - veh_taxi_01: متن TAXI روی تابلو (نقض قانون «بدون متن»)
 *  - veh_police_01: متن POLICE روی بدنه (نقض قانون «بدون متن»)
 *  - veh_pickup_01 / veh_sedan_01: زاویه خیلی سه‌ربع از زمین (ناهماهنگ با VEH-001)
 *
 * اجرا: cd /home/z/my-project && node scripts/gen_batch2_fix.mjs
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

// نگاه از بالا مثل پهپاد — هماهنگ با VEH-001 فاز 1
const VEHICLE_VIEW =
  'Game sprite seen from high above like a drone looking almost straight down (about 75 ' +
  'degree downward angle), roof of the vehicle is the most visible part, windshield and ' +
  'hood slightly visible at the top edge, vehicle pointing straight UP toward the top of ' +
  'frame, small soft shadow directly under the vehicle, tiny round headlights, ';

const NO_TEXT =
  ', absolutely no letters, no words, no writing, no numbers, no labels anywhere on the ' +
  'image, blank empty signs only';

const JOBS = [
  {
    name: 'veh_taxi_01',
    prompt:
      VEHICLE_VIEW +
      'small cute orange taxi car, taxi orange body with white doors, completely blank ' +
      'empty white-orange sign box on the roof with nothing written on it, funny ' +
      'mustached driver visible through the windshield, slightly worn look for humor with ' +
      'one crooked front bumper, ' +
      STYLE +
      NO_TEXT +
      ', isolated on plain pure white background, nothing else in frame, no road, no environment',
  },
  {
    name: 'veh_police_01',
    prompt:
      VEHICLE_VIEW +
      'cute cartoon police car, plain white body with turquoise-blue doors, roof light bar ' +
      'made of one small blank red box and one small blank blue box not glowing, funny ' +
      'tiny police officer with peaked cap visible through the windshield, simple generic ' +
      'toy-like design with no emblem, ' +
      STYLE +
      NO_TEXT +
      ', isolated on plain pure white background, nothing else in frame',
  },
  {
    name: 'veh_pickup_01',
    prompt:
      VEHICLE_VIEW +
      'small cute red pickup truck with an open cargo bed carrying two tied cardboard ' +
      'boxes and one green watermelon, cheerful driver with a flat cap visible through ' +
      'the windshield, ' +
      STYLE +
      NO_TEXT +
      ', isolated on plain pure white background, nothing else in frame, no road, no environment',
  },
  {
    name: 'veh_sedan_01',
    prompt:
      VEHICLE_VIEW +
      'old cute faded turquoise-blue compact sedan with dusty worn look, roof rack with a ' +
      'rolled beige blanket bundle tied on top for classic road trip humor, bored sleepy ' +
      'driver visible through the windshield, simple generic design, ' +
      STYLE +
      NO_TEXT +
      ', isolated on plain pure white background, nothing else in frame, no road, no environment',
  },
];

async function main() {
  const zai = await ZAI.create();
  const report = [];
  for (const job of JOBS) {
    const outPath = path.join(OUT, `${job.name}.png`);
    // فایل قبلیِ ردشده حذف می‌شود تا بازتولید انجام شود
    if (fs.existsSync(outPath)) fs.rmSync(outPath);
    let ok = false;
    let lastErr = '';
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const res = await zai.images.generations.create({ prompt: job.prompt, size: '768x1344' });
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
