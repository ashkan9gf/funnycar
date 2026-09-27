#!/usr/bin/env node
/**
 * validate_assets.mjs — ابزار اعتبارسنجی Assetهای پروژه FunnyCarIR
 * ============================================================
 * (بخش ۳۰ سند مادر) گزارش خوانا از:
 *   Missing Assets / Unused Assets / Wrong Format / Wrong Size
 *   Invalid Name / Broken Reference / Oversized Texture
 *
 * اجرا:  node scripts/validate_assets.mjs
 * قانون: قبل از هر Release خروجی باید بدون خطای قرمز باشد.
 */

import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = join(process.cwd());
const PUBLIC_ASSETS = join(ROOT, 'public', 'assets');
const MANIFEST_PATH = join(ROOT, 'src', 'game', 'data', 'assets.manifest.ts');

// ---------- مشخصات رسمی (آینه ASSET_INVENTORY_FA.md) ----------
const SPEC = {
  'assets/vehicles/player/veh_player_01.png': { w: 256, h: 448, maxKB: 120 },
  'assets/vehicles/traffic/veh_taxi_01.png': { w: 256, h: 448, maxKB: 120 },
  'assets/npc/vehicles/veh_police_01.png': { w: 256, h: 448, maxKB: 120 },
  'assets/environments/roads/env_road_straight_01.png': { w: 512, h: 512, maxKB: 250 },
  'assets/environments/roads/env_road_cross_01.png': { w: 512, h: 512, maxKB: 250 },
  'assets/environments/roads/env_sidewalk_01.png': { w: 512, h: 512, maxKB: 200 },
  'assets/environments/roads/env_ground_01.png': { w: 512, h: 512, maxKB: 200 },
  'assets/characters/player/char_driver_01_idle.png': { w: 512, h: 512, maxKB: 200 },
  'assets/characters/player/char_driver_01_happy.png': { w: 512, h: 512, maxKB: 200 },
  'assets/characters/player/char_driver_01_shock.png': { w: 512, h: 512, maxKB: 200 },
};
/** سقف حجم عمومی بر اساس دسته */
const CATEGORY_LIMITS = [
  { test: /assets\/vehicles\//, maxKB: 150 },
  { test: /assets\/npc\//, maxKB: 150 },
  { test: /assets\/environments\//, maxKB: 300 },
  { test: /assets\/characters\//, maxKB: 200 },
  { test: /assets\/props\//, maxKB: 60 },
  { test: /assets\/(ui|icons)\//, maxKB: 60 },
  { test: /assets\/effects\//, maxKB: 120 },
  { test: /assets\/audio\/sfx\//, maxKB: 120 },
  { test: /assets\/audio\/voices\//, maxKB: 150 },
  { test: /assets\/audio\/music\//, maxKB: 2600 },
];
const NAME_REGEX = /^[a-z0-9]+(_[a-z0-9]+)*\.(png|webp|jpg|ogg|mp3|wav|woff2)$/;
const IMG_FOLDERS = /assets\/(vehicles|npc|environments|characters|props|ui|icons|effects|animations|loading)\//;
const AUDIO_FOLDERS = /assets\/audio\//;

const issues = { error: [], warn: [], info: [] };
const err = (m) => issues.error.push(m);
const warn = (m) => issues.warn.push(m);
const info = (m) => issues.info.push(m);

// ---------- خواندن manifest (پارس سبک فایل TS) ----------
function parseManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    err(`manifest پیدا نشد: ${relative(ROOT, MANIFEST_PATH)}`);
    return [];
  }
  const text = readFileSync(MANIFEST_PATH, 'utf8');
  const entries = [];
  // کلیدها بدون کوتیشن‌اند:  veh_player_01: {  ...  src: 'assets/...'
  const re = /^\s{2}([a-z0-9_]+):\s*\{$/gm;
  const srcRe = /^\s{4}src:\s*'([^']+)',$/gm;
  const srcs = [...text.matchAll(srcRe)].map((m) => m[1]);
  const ids = [...text.matchAll(re)].map((m) => m[1]);
  // تعداد کلیدها با تعداد src یکی است — به ترتیب جفت می‌شوند
  if (ids.length === srcs.length) {
    ids.forEach((id, i) => entries.push({ id, src: srcs[i] }));
  } else {
    // حالت احتیاط: فقط src ها
    srcs.forEach((src, i) => entries.push({ id: `#${i}`, src }));
  }
  return entries;
}

// ---------- پیمایش پوشه assets ----------
function walk(dir, base = dir) {
  let files = [];
  if (!existsSync(dir)) return files;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) files = files.concat(walk(p, base));
    else files.push(relative(base, p).replaceAll('\\', '/'));
  }
  return files;
}

// ---------- ابعاد PNG (IHDR) ----------
function pngSize(file) {
  try {
    const buf = readFileSync(file);
    if (buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452) return null; // IHDR
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
}

// ---------- اجرا ----------
const manifest = parseManifest();
const manifestSrcs = new Set(manifest.map((e) => e.src));
const actualFiles = walk(PUBLIC_ASSETS);

console.log('\n🚗 FunnyCarIR — اعتبارسنجی Assetها');
console.log('='.repeat(56));
console.log(`manifest: ${manifest.length} شناسه | فایل واقعی: ${actualFiles.length}`);

// 1) Missing / Broken Reference (Asset های manifest بدون فایل)
for (const e of manifest) {
  const p = join(ROOT, 'public', e.src);
  if (!existsSync(p)) {
    info(`MISSING (Placeholder فعال): ${e.id} → ${e.src}`);
  } else {
    const spec = SPEC[e.src];
    const kb = statSync(p).size / 1024;
    if (spec) {
      const size = pngSize(p);
      if (size && (size.w !== spec.w || size.h !== spec.h)) {
        err(`WRONG SIZE: ${e.src} → ${size.w}×${size.h} است، باید ${spec.w}×${spec.h} باشد`);
      }
    }
    const limit = CATEGORY_LIMITS.find((l) => l.test.test(e.src))?.maxKB;
    if (limit && kb > limit) err(`OVERSIZED: ${e.src} → ${kb.toFixed(0)}KB (سقف ${limit}KB)`);
  }
}

// 2) Unused Assets (فایل واقعی که manifest نمی‌شناسد)
for (const rel of actualFiles) {
  const src = `assets/${rel}`;
  if (!manifestSrcs.has(src)) {
    warn(`UNUSED: ${src} — قبل از حذف، Referenceها را چک کن (ASSET_IMPORT_GUIDE بخش ۵)`);
  }
  // 3) Invalid Name — فقط نام فایل (نه مسیر پوشه‌ها)
  const baseName = rel.split('/').pop() ?? rel;
  if (!NAME_REGEX.test(baseName)) {
    err(`INVALID NAME: ${rel} — الگو: {نوع}_{توضیح}_{شماره}.{فرمت} (حروف کوچک، فقط _)`);
  }
  // 4) Wrong Format per folder
  const full = join(PUBLIC_ASSETS, rel);
  if (IMG_FOLDERS.test(`assets/${rel}`) && !['.png', '.webp'].includes(extname(rel))) {
    err(`WRONG FORMAT: ${rel} — تصاویر بازی باید PNG/WebP باشند (JPG شفافیت ندارد)`);
  }
  if (AUDIO_FOLDERS.test(`assets/${rel}`) && !['.ogg', '.mp3', '.wav'].includes(extname(rel))) {
    err(`WRONG FORMAT: ${rel} — صداها باید OGG/MP3/WAV باشند`);
  }
}

// 5) خلاصه Placeholderها (قانون بخش ۳۲: هیچ Placeholder مخفی نمی‌ماند)
const placeholders = manifest.filter((e) => !existsSync(join(ROOT, 'public', e.src)));

console.log('\n---------- گزارش ----------');
if (issues.error.length === 0 && issues.warn.length === 0) console.log('✅ بدون خطا — Assetها سالم‌اند');
issues.error.forEach((m) => console.log(`❌ ${m}`));
issues.warn.forEach((m) => console.log(`⚠️  ${m}`));
issues.info.forEach((m) => console.log(`ℹ️  ${m}`));

console.log('\n---------- وضعیت Release ----------');
console.log(`Placeholderهای فعال: ${placeholders.length}`);
if (placeholders.length > 0) {
  console.log('⏳ هنوز برای Release آماده نیست — این‌ها باید با Asset واقعی جایگزین شوند:');
  placeholders.forEach((p) => console.log(`   - ${p.id} (${p.src})`));
} else {
  console.log('✅ همه Assetهای manifest واقعی‌اند');
}
console.log('');
process.exit(issues.error.length > 0 ? 1 : 0);
