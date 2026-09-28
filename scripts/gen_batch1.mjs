/**
 * gen_batch1.mjs — تولید تصاویر Batch 1 با هوش مصنوعی
 * ============================================================
 * طبق docs/ASSET_GENERATION_GUIDE_FA.md (Promptهای رسمی پروژه)
 * خروجی خام → scripts/raw_assets/ → پردازش با process_batch1.py
 *
 * اجرا: cd /home/z/my-project && bun scripts/gen_batch1.mjs
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

const JOBS = [
  {
    name: 'veh_player_01',
    size: '768x1344',
    prompt:
      'Top-down three-quarter view game sprite of a small cute white compact hatchback car, ' +
      'bird eye view tilted about 20 degrees, car pointing straight UP toward the top of frame, ' +
      'mustard yellow roof stripe, turquoise side mirrors, funny mustached driver visible through ' +
      'the windows, tiny round headlights, small soft shadow directly under the car, ' +
      STYLE +
      ', isolated on plain pure white background, nothing else in frame, no text, no road, no environment',
  },
  {
    name: 'env_road_straight_01',
    size: '1024x1024',
    prompt:
      'Seamless tileable texture for a top-down 2D cartoon driving game: straight asphalt road ' +
      'segment running vertically through the middle of the frame, dark warm grey asphalt, one ' +
      'dashed cream-white center line aligned perfectly with top and bottom edges so tiles ' +
      'continue each other seamlessly, subtle lighter asphalt patches, flat lighting, no shadows, ' +
      'no perspective, straight 90 degree top-down view, ' +
      STYLE +
      ', texture fills the entire frame edge to edge, no vehicles, no objects, no text',
  },
  {
    name: 'env_road_cross_01',
    size: '1024x1024',
    prompt:
      'Seamless tileable texture for a top-down 2D cartoon driving game: asphalt road intersection ' +
      'tile, dark warm grey asphalt filling the middle, cream concrete sidewalk corner blocks at ' +
      'the four corners, short white stop line markings where roads meet, flat lighting, no ' +
      'shadows, no perspective, straight 90 degree top-down view, ' +
      STYLE +
      ', texture fills the entire frame edge to edge, no vehicles, no objects, no text',
  },
  {
    name: 'env_sidewalk_01',
    size: '1024x1024',
    prompt:
      'Seamless tileable texture: cream beige concrete sidewalk pavement, square slabs with thin ' +
      'darker joint lines forming a neat grid, flat lighting, no shadows, no perspective, straight ' +
      '90 degree top-down view, ' +
      STYLE +
      ', texture fills the entire frame edge to edge, no objects, no text',
  },
  {
    name: 'env_ground_01',
    size: '1024x1024',
    prompt:
      'Seamless tileable texture: warm sandy courtyard ground with tiny pebbles and subtle darker ' +
      'dots, light tan color, flat lighting, no shadows, no perspective, straight 90 degree ' +
      'top-down view, ' +
      STYLE +
      ', texture fills the entire frame edge to edge, no objects, no text',
  },
  {
    name: 'char_driver_01_idle',
    size: '1024x1024',
    prompt:
      'Funny cartoon bust portrait of a cheerful middle-aged Iranian taxi driver: round face, big ' +
      'friendly eyes, thick black mustache, tiny flat cap, cream shirt with turquoise stripes, ' +
      'confident smile, one eyebrow slightly raised for comedic charm, front-facing, centered, ' +
      'head and shoulders only, ' +
      STYLE +
      ', isolated on plain pure white background, no text, nothing else in frame',
  },
  {
    name: 'char_driver_01_happy',
    size: '1024x1024',
    prompt:
      'Funny cartoon bust portrait of a cheerful middle-aged Iranian taxi driver: round face, big ' +
      'open joyful smile, eyes squinting with happiness, rosy cheeks, thick black mustache, tiny ' +
      'flat cap, cream shirt with turquoise stripes, front-facing, centered, head and shoulders ' +
      'only, ' +
      STYLE +
      ', isolated on plain pure white background, no text, nothing else in frame',
  },
  {
    name: 'char_driver_01_shock',
    size: '1024x1024',
    prompt:
      'Funny cartoon bust portrait of a middle-aged Iranian taxi driver with a shocked face: wide ' +
      'round eyes, tiny open mouth, raised eyebrows, thick black mustache, tiny flat cap, cream ' +
      'shirt with turquoise stripes, front-facing, centered, head and shoulders only, ' +
      STYLE +
      ', isolated on plain pure white background, no text, nothing else in frame',
  },
];

async function main() {
  const zai = await ZAI.create();
  const report = [];
  for (const job of JOBS) {
    const outPath = path.join(OUT, `${job.name}.png`);
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
