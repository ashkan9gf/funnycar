// render_car_shot.mjs — playwright shot of render_car_page.html (v0.2.54: puppeteer→playwright)
// usage: node scripts/render_car_shot.mjs <carName> <outPrefix> [spins]
import { chromium } from 'playwright';

const car = process.argv[2] || 'police';
const prefix = process.argv[3] || `v0254_${car}`;
const spins = process.argv[4] === '1' ? '1' : '0';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 600, height: 1300 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await page.goto(`http://localhost:8899/render_car_page.html?car=${car}&spins=${spins}`, { waitUntil: 'load', timeout: 30000 }).catch((e) => console.log('nav', e.message));
try {
  await page.waitForFunction(`window.__RENDER_DONE === 6`, { timeout: 30000 });
} catch { console.log('timeout waiting renders, images so far:', await page.evaluate(() => document.querySelectorAll('img').length)); }
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `scripts/${prefix}_views.png`, fullPage: true });
console.log('saved', `scripts/${prefix}_views.png`);
await browser.close();
