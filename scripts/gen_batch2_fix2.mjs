/**
 * gen_batch2_fix2.mjs — تلاش دوم برای تاکسی (متن TAXI) و وانت (چیدمان اشتباه)
 * ============================================================
 * تاکسی: کلمه taxi از پرامپت حذف شد — «جعبه تخت نارنجی روی سقف»
 * وانت: راننده باید داخل کابین پشت شیشه باشد، بار در بستر عقب
 * اجرا: cd /home/z/my-project && node scripts/gen_batch2_fix2.mjs
 */

import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'scripts', 'raw_assets');
const STYLE =
  'flat 2D cartoon style for a funny Persian mobile game, thick bold dark brown outline, ' +
  'rounded cute shapes, warm cheerful palette, soft simple shading, minimal details, ' +
  'clean vector look, mobile game asset, high quality';

const VEHICLE_VIEW =
  'Game sprite seen from high above like a drone looking almost straight down (about 75 ' +
  'degree downward angle), roof of the vehicle is the most visible part, windshield and ' +
  'hood slightly visible at the top edge, vehicle pointing straight UP toward the top of ' +
  'frame, small soft shadow directly under the vehicle, tiny round headlights, ';

const NO_TEXT =
  ', absolutely no letters, no words, no writing, no numbers, no labels anywhere, all signs and plates blank';

const JOBS = [
  {
    name: 'veh_taxi_01',
    prompt:
      VEHICLE_VIEW +
      'small cute compact car with bright orange body and white doors, on the roof sits a ' +
      'small plain solid-orange rectangular box that is completely featureless and empty, ' +
      'funny mustached driver visible through the windshield, slightly worn look for ' +
      'humor with one crooked front bumper, ' +
      STYLE +
      NO_TEXT +
      ', isolated on plain pure white background, nothing else in frame, no road, no environment',
  },
  {
    name: 'veh_pickup_01',
    prompt:
      VEHICLE_VIEW +
      'small cute red pickup truck seen from above: at the TOP of the vehicle is the cab ' +
      'with a cheerful flat-cap driver sitting inside visible through the windshield and ' +
      'a solid red roof above him, at the BOTTOM behind the cab is the open cargo bed ' +
      'holding two tied cardboard boxes and one green watermelon, ' +
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
  if (failed.length) process.exitCode = 2;
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
