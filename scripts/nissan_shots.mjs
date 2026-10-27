import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:8899/', { waitUntil: 'load', timeout: 60000 });
await sleep(5000);
let st = null;
for (let i = 0; i < 40; i++) { st = await page.evaluate(() => window.__funnycar?.getState?.() ?? null); if (st === 'menu' || st === 'garage') break; await sleep(2000); }
await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, [role=button], div')];
  const el = els.find((e) => (e.textContent || '').trim().startsWith('رانندگی آزاد') && e.offsetParent !== null);
  const r = el.getBoundingClientRect();
  const ev = (t) => el.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
  ev('pointerdown'); ev('pointerup'); if (el.tagName === 'BUTTON') el.click();
});
await sleep(6000);
await page.evaluate(() => { const fc = window.__funnycar; fc.save.mutate((s) => { s.coins = 5000; }); fc.buyVehicle('veh_nissan_01'); });
for (let i = 0; i < 6; i++) {
  await sleep(2500);
  await page.screenshot({ path: `/tmp/nn_${i}.png` });
}
await browser.close();
console.log('done');
