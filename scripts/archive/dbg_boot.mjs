import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errs.push('PAGE: ' + String(e).slice(0, 200)));
await page.goto('http://localhost:8899/', { waitUntil: 'load', timeout: 60000 });
for (let i = 0; i < 15; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const st = await page.evaluate(() => window.__funnycar?.getState?.() ?? null).catch(() => 'EVAL_ERR');
  console.log(`[${(i + 1) * 2}s] state=`, st);
  if (st === 'menu' || st === 'garage') break;
}
console.log('console errors:', errs.slice(0, 8));
await browser.close();
