// aaa_night.mjs — اسکرین‌شات شب/غروب: پرش زمان via renderer time (t در update)
import { chromium } from 'playwright';

const BASE = 'http://localhost:8899/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  headless: true,
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
for (let i = 0; i < 5; i++) {
  await tapByText('رانندگی آزاد');
  await sleep(3500);
  const s = await page.evaluate(() => window.__funnycar?.getState?.());
  if (s === 'playing') break;
}
await sleep(2500);

// غروب (t≈170) و شب (t≈210): پرش زمان چرخهٔ ۳۶۰ثانیه‌ای — اگر فیلد time رندرر در دسترس بود
const probe = await page.evaluate(() => {
  const fc = window.__funnycar;
  const keys = fc ? Object.keys(fc) : [];
  return { keys: keys.filter((k) => /time|clock|render|3d|world/i.test(k)), state: fc?.getState?.() };
});
console.log('probe=', JSON.stringify(probe));

// راه ساده: صبر واقعی — غروب در ~۱۵۰ث، شب در ~۱۸۵ث چرخه. صبر فشرده تا ۱۶۵ث
await sleep(165000 - 8000);
await page.screenshot({ path: '/tmp/aaa_dusk.png' });
await sleep(25000);
await page.screenshot({ path: '/tmp/aaa_night.png' });
console.log('errors=', errs.length ? errs : 'none');
await browser.close();
