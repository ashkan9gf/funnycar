// e2e_v0255.mjs — تأیید v0.2.55: ۹ خودروی AI جدید + تفکیک چرخ + رنگ گاراژ رأسی
import { chromium } from 'playwright';

const BASE = 'http://localhost:8899/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, name, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fails++;
};

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => errs.push('PAGE: ' + String(e).slice(0, 160)));

await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
await sleep(5000);

// ۱) همهٔ GLBها سرو شدند؟
const glbs = await page.evaluate(async () => {
  const files = ['player.glb', 'pride.glb', 'tiba.glb', 'peugeot405.glb', 'samand.glb', 'taxi.glb',
    'police.glb', 'renault4.glb', 'vintage.glb', 'challenger.glb', 'nissan.glb'];
  const out = {};
  for (const f of files) {
    const r = await fetch('/assets/models/vehicles/' + f);
    out[f] = { status: r.status, size: (await r.arrayBuffer()).byteLength };
  }
  return out;
});
for (const [f, v] of Object.entries(glbs)) {
  ok(v.status === 200 && v.size > 300_000, `${f} سرو شد (${(v.size / 1024) | 0}KB)`);
}

// ۲) منو
let state0 = null;
for (let i = 0; i < 40; i++) {
  state0 = await page.evaluate(() => window.__funnycar?.getState?.() ?? null);
  if (state0 === 'menu' || state0 === 'garage') break;
  await sleep(2000);
}
ok(state0 === 'menu' || state0 === 'garage', 'منو/گاراژ رسید', String(state0));
await sleep(2500);

async function tapByText(txt) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, [role=button], div')];
    const el = els.find((e) => (e.textContent || '').trim().startsWith(t) && e.offsetParent !== null);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const ev = (type) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    ev('pointerdown'); ev('pointerup');
    if (el.tagName === 'BUTTON') el.click();
    return true;
  }, txt);
}

// ۳) شروع بازی
ok(await tapByText('رانندگی آزاد'), 'دکمه شروع');
await sleep(6000);
const st = await page.evaluate(() => {
  const fc = window.__funnycar;
  return fc ? { state: fc.getState(), speed: fc.vehicle?.speed } : null;
});
ok(st?.state === 'playing', 'وضعیت playing', String(st?.state));
await page.screenshot({ path: '/tmp/e2e_55_drive.png' });

// ۴) خرید تیبا (مدل AI جدید) + رانندگی
const buy = await page.evaluate(() => {
  const fc = window.__funnycar;
  fc.save.mutate((s) => { s.coins = 5000; });
  const r = fc.buyVehicle('veh_tiba_01');
  return { ok: r.ok, coins: r.coins, msg: r.msg };
});
ok(buy.ok, 'خرید تیبا', buy.msg);
await sleep(5000);
const vinfo = await page.evaluate(() => {
  const fc = window.__funnycar;
  return { state: fc.getState(), speed: fc.vehicle?.speed };
});
ok(vinfo.state === 'playing', 'بعد از خرید تیبا playing', String(vinfo.state));
await page.screenshot({ path: '/tmp/e2e_55_tiba.png' });

// ۵) رنگ گاراژ رأسی — تغییر رنگ بدنهٔ تیبا (مدل بیک‌شده)
const paint = await page.evaluate(() => {
  const fc = window.__funnycar;
  fc.renderer3d?.setPlayerPaint?.('#f2c230');
  return fc.renderer3d?.playerPaint ?? null;
});
ok(paint === '#f2c230', 'رنگ گاراژ ست شد (رأسی)', String(paint));
await sleep(2000);
await page.screenshot({ path: '/tmp/e2e_55_tiba_yellow.png' });

const realErrs = errs.filter((e) => !e.includes('favicon') && !e.includes('websocket'));
ok(realErrs.length === 0, 'بدون خطای کنسول', realErrs.slice(0, 3).join(' | '));
await browser.close();
console.log(fails === 0 ? 'ALL PASS' : `FAILS: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
