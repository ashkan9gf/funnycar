// aaa_look.mjs — اسکرین‌شات کیفی از حالت رانندگی (روز) برای ممیزی بصری AAA
import { chromium } from 'playwright';

const BASE = 'http://localhost:8899/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = process.argv[2] || 'base';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
page.on('pageerror', (e) => errs.push('PAGE: ' + String(e).slice(0, 120)));

await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
await sleep(4500);

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

// رانندگی آزاد (retry تا وقتی playing شود)
let st0 = null;
for (let i = 0; i < 5; i++) {
  await tapByText('رانندگی آزاد');
  await sleep(4000);
  st0 = await page.evaluate(() => window.__funnycar?.getState?.());
  if (st0 === 'playing') break;
}
console.log('after-tap state=', st0);
await sleep(3000);

// راندن جلو برای دیدن خیابان
await page.keyboard.down('ArrowUp');
await sleep(5200);
await page.keyboard.up('ArrowUp');
await sleep(900);
await page.screenshot({ path: `/tmp/aaa_${tag}_1_drive.png` });

// زاویهٔ دستی دوربین + ادامه راندن
await page.keyboard.down('ArrowUp');
await sleep(4200);
await page.keyboard.up('ArrowUp');
await page.screenshot({ path: `/tmp/aaa_${tag}_2_street.png` });

// نزدیک ظهر: صبر تا فاز روز کامل (سیکل ۳۶۰ثانیه‌ای، ظهر ~۹۰ث) — به‌جای صبر، از saveTime استفاده نمی‌کنیم؛ فقط دو نمای شب هم بگیریم
const st = await page.evaluate(() => window.__funnycar?.getState?.());
console.log('state=', st, 'errors=', errs.length ? errs : 'none');
await browser.close();
