// v063_look.mjs — اسکرین‌شات درون‌بازی v0.2.63 (رانندگی آزاد روز) — رنگ خودرو
const BASE = 'http://localhost:8899/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = process.argv[2] || 'v063';

// playwright crash می‌کند در این کانتینر — از CDP خود کروم agent-browser نمی‌شود؛
// این اسکریپت با playwright است ولی اگر کرش کرد، مسیر agent-browser جایگزین می‌شود.
import { chromium } from 'playwright';
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
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

let st = null;
for (let i = 0; i < 5; i++) {
  await tapByText('رانندگی آزاد');
  await sleep(4000);
  st = await page.evaluate(() => window.__funnycar?.getState?.());
  if (st === 'playing') break;
}
console.log('state=', st);
await page.keyboard.down('ArrowUp');
await sleep(5000);
await page.keyboard.up('ArrowUp');
await sleep(900);
await page.screenshot({ path: `/tmp/v063_${tag}_1_drive.png` });
console.log('errors:', errs.length ? errs.slice(0, 3).join(' | ') : 'none');
await browser.close();
