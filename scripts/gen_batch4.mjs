/**
 * gen_batch4.mjs — تولید پرتره‌های شخصیت Batch 4
 * ============================================================
 * طبق docs/ASSET_INVENTORY_FA.md:
 *   NPC-001 پرتره پلیس → npc/police/npc_police_01.png
 *   CHAR-002 پرتره مکانیک → characters/mechanic/char_mechanic_01.png
 *   CHAR-003 پرتره مسافر مرد (عادی + عصبانی) → characters/passenger/char_pass_m_01_*.png
 * خروجی خام → scripts/raw_assets/ → پردازش با process_batch4.py
 *
 * اجرا: cd /home/z/my-project && node scripts/gen_batch4.mjs
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

// نمای مشترک همه پرتره‌ها (مثل CHAR-001 پرتره راننده)
const PORTRAIT_VIEW =
  'Cartoon character portrait bust, head and shoulders seen from slightly above, ' +
  'front facing, looking at viewer with a funny expressive face, big simple eyes, ' +
  'head fills most of the frame, ';

const JOBS = [
  {
    name: 'npc_police_01',
    size: '1024x1024',
    prompt:
      PORTRAIT_VIEW +
      'friendly chubby cartoon police officer with black peaked cap with blank round badge, ' +
      'dark uniform with shoulders, thick black mustache, one raised eyebrow suspicious look, ' +
      'no text, no real emblem, fully original design, ' +
      STYLE +
      ', isolated on plain pure white background, single character, no text, no border, no frame',
  },
  {
    name: 'char_mechanic_01',
    size: '1024x1024',
    prompt:
      PORTRAIT_VIEW +
      'friendly cartoon car mechanic with grey flat cap, big messy beard, dark blue overalls, ' +
      'a red wrench over the shoulder, smug confident grin, a few grease smudges on cheek, ' +
      STYLE +
      ', isolated on plain pure white background, single character, no text, no border, no frame',
  },
  {
    name: 'char_pass_m_01_idle',
    size: '1024x1024',
    prompt:
      PORTRAIT_VIEW +
      'cheerful young cartoon man passenger with messy black hair under a small white ' +
      'prayer cap, casual striped shirt, relaxed happy smile, calm friendly eyes, ' +
      STYLE +
      ', isolated on plain pure white background, single character, no text, no border, no frame',
  },
  {
    name: 'char_pass_m_01_angry',
    size: '1024x1024',
    prompt:
      PORTRAIT_VIEW +
      'same cheerful young cartoon man passenger now VERY angry and frustrated: red puffed ' +
      'cheeks, steam puff above head, furrowed thick eyebrows, gritted teeth, hands slightly ' +
      'raised in exasperation, messy black hair under a small white prayer cap, casual ' +
      'striped shirt, ' +
      STYLE +
      ', isolated on plain pure white background, single character, no text, no border, no frame',
  },
];

async function main() {
  const zai = await ZAI.create();
  const report = [];
  for (const job of JOBS) {
    const outPath = path.join(OUT, `${job.name}.png`);
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
