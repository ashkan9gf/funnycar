// e2e_nissan_v0254.mjs — خرید نیسان آبی از گاراژ + اسکرین‌شات مدل AI
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

let state0 = null;
for (let i = 0; i < 40; i++) {
  state0 = await page.evaluate(() => window.__funnycar?.getState?.() ?? null);
  if (state0 === 'menu' || state0 === 'garage') break;
  await sleep(2000);
}
ok(state0 === 'menu' || state0 === 'garage', 'منو رسید', String(state0));

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

ok(await tapByText('رانندگی آزاد'), 'دکمه شروع');
await sleep(6000);

// سکه بده و نیسان بخر (مدل AI خارجی)
const buy = await page.evaluate(() => {
  const fc = window.__funnycar;
  fc.save.mutate((s) => { s.coins = 5000; });
  const r = fc.buyVehicle('veh_nissan_01');
  return { ok: r.ok, coins: r.coins, msg: r.msg };
});
ok(buy.ok, 'خرید نیسان', buy.msg);
await sleep(5000); // صبر برای لود GLB نیسان و upgrade

const vinfo = await page.evaluate(() => {
  const fc = window.__funnycar;
  return { state: fc.getState(), speed: fc.vehicle?.speed };
});
ok(vinfo.state === 'playing', 'بعد از خرید playing', String(vinfo.state));

await page.screenshot({ path: '/tmp/e2e_54_nissan.png' });
await sleep(2000);
await page.screenshot({ path: '/tmp/e2e_54_nissan2.png' });

const realErrs = errs.filter((e) => !e.includes('favicon') && !e.includes('websocket'));
ok(realErrs.length === 0, 'بدون خطای کنسول', realErrs.slice(0, 3).join(' | '));
await browser.close();
console.log(fails === 0 ? 'ALL PASS' : `FAILS: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
