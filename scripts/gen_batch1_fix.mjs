/**
 * gen_batch1_fix.mjs — بازتولید ۲ کاشی رد‌شده در بازبینی (قانون بخش ۳۷ سند مادر)
 * - env_road_straight_01: نسخه اول پرسپکتیو داشت → تأکید سخت بر موازی و عمود
 * - env_ground_01: نسخه اول قاب تزئینی داشت → تأکید سخت بر بدون قاب
 */

import ZAI from 'z-ai-web-dev-sdk';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'scripts', 'raw_assets');
fs.mkdirSync(OUT, { recursive: true });

const JOBS = [
  {
    name: 'env_road_straight_01',
    size: '1024x1024',
    prompt:
      '2D game texture pattern, perfectly orthographic straight 90 degree top-down view: a vertical ' +
      'asphalt road strip with PARALLEL straight edges of CONSTANT width running from the bottom ' +
      'edge to the top edge of the frame, dark warm grey asphalt, one dashed cream-white center ' +
      'line aligned with top and bottom edges, subtle asphalt patches, flat cartoon vector style, ' +
      'thick clean shapes, flat lighting, no shadows, STRICTLY NO PERSPECTIVE, no vanishing point, ' +
      'no horizon, no tapering, road width exactly identical at top and bottom, seamless tileable ' +
      'game texture, fills entire frame edge to edge, no vehicles, no objects, no text',
  },
  {
    name: 'env_ground_01',
    size: '1024x1024',
    prompt:
      '2D game texture pattern, perfectly orthographic straight 90 degree top-down view: warm sandy ' +
      'courtyard ground, light tan flat color base with scattered tiny pebbles and small dots as an ' +
      'UNIFORM ALLOVER repeating pattern, flat cartoon vector style, flat lighting, no shadows, ' +
      'STRICTLY NO BORDER, no frame, no ornamental edges, no rug pattern, no corner decorations, ' +
      'the pattern continues identically to all four edges for seamless tiling, fills entire frame ' +
      'edge to edge, no objects, no text',
  },
];

async function main() {
  const zai = await ZAI.create();
  for (const job of JOBS) {
    const outPath = path.join(OUT, `${job.name}.png`);
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        const res = await zai.images.generations.create({ prompt: job.prompt, size: job.size });
        const b64 = res?.data?.[0]?.base64;
        if (!b64) throw new Error('empty base64');
        fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
        console.log(`✓ ${job.name}.png (${(fs.statSync(outPath).size / 1024).toFixed(0)}KB)`);
        ok = true;
      } catch (e) {
        console.warn(`✗ attempt ${attempt} failed: ${e instanceof Error ? e.message : e}`);
        await new Promise((r) => setTimeout(r, 1200 * attempt));
      }
    }
    if (!ok) process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
