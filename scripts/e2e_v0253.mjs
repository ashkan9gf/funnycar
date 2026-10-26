// e2e_v0253.mjs — تأیید پراید قرمز AI در بازی (playwright)
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

// ۱) GLB جدید سرو شده؟
const glb = await page.evaluate(async () => {
  const r = await fetch('/assets/models/vehicles/player.glb');
  const b = await r.arrayBuffer();
  return { status: r.status, size: b.byteLength };
});
ok(glb.status === 200 && glb.size > 900_000, `GLB قرمز سرو شد (${(glb.size / 1024) | 0}KB)`);

// ۲) منتظر منو بمان (لودینگ شهر تا ~۱ دقیقه)
let state0 = null;
for (let i = 0; i < 40; i++) {
  state0 = await page.evaluate(() => window.__funnycar?.getState?.() ?? null);
  if (state0 === 'menu' || state0 === 'garage') break;
  await sleep(2000);
}
ok(state0 === 'menu' || state0 === 'garage', 'منو/گاراژ رسید', String(state0));
await sleep(2500);
await page.screenshot({ path: '/tmp/e2e_53_menu.png' });

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

// ۴) اسکرین‌شات گیم‌پلی (ماشین قرمز از پشت)
await page.screenshot({ path: '/tmp/e2e_53_drive.png' });
await sleep(2500);
await page.screenshot({ path: '/tmp/e2e_53_drive2.png' });

ok(errs.length === 0, 'بدون خطای کنسول', errs.slice(0, 3).join(' | '));
await browser.close();
console.log(fails === 0 ? 'ALL PASS' : `FAILS: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
