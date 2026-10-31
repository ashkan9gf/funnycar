// car_render_pw.mjs — playwright render of scripts/render_car_page.html (6 views)
// usage: node scripts/car_render_pw.mjs <car> <outprefix> [zoom=0|1]
import { chromium } from 'playwright';
import { execSync } from 'child_process';

const car = process.argv[2] || 'player';
const prefix = process.argv[3] || 'pw_car';
const zoom = process.argv[4] === '1' ? '&zoompage=1' : '';

const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGE: ' + String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CON: ' + m.text().slice(0, 160)); });

await page.goto(`http://localhost:8899/render_car_page.html?car=${car}${zoom}`, { waitUntil: 'load', timeout: 30000 });
let n = 0;
for (let i = 0; i < 40; i++) {
  n = await page.evaluate(() => document.querySelectorAll('img').length);
  if (n >= 6) break;
  await page.waitForTimeout(800);
}
await page.waitForTimeout(700);
await page.screenshot({ path: `scripts/${prefix}_views.png`, fullPage: true });
console.log(`imgs=${n} errors=${errs.length ? errs.join(' | ') : 'none'}`);
await browser.close();
