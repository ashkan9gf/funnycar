// render_car_shot.mjs — puppeteer shot of render_car_page.html
// usage: node scripts/render_car_shot.mjs <carName> <outPrefix> [spins]
import puppeteer from '/usr/local/lib/node_modules/agent-browser/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const car = process.argv[2] || 'police';
const prefix = process.argv[3] || `v0248_${car}`;
const spins = process.argv[4] === '1' ? '1' : '0';

// find any puppeteer-core install
let chrom;
const candidates = [
  '/home/z/.cache/puppeteer/chrome/*/chrome-linux64/chrome',
  '/home/z/.cache/puppeteer/chromium/*/chrome-linux/chrome',
];
import { globSync } from 'node:fs';
import { execSync } from 'node:child_process';
try { chrom = execSync('ls /home/z/.cache/puppeteer/chrome/*/chrome-linux64/chrome 2>/dev/null | head -1').toString().trim(); } catch {}
if (!chrom) { console.error('no chrome found'); process.exit(1); }
console.log('chrome:', chrom);

const browser = await puppeteer.launch({
  executablePath: chrom,
  headless: 'new',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=700,1400'],
});
const page = await browser.newPage();
await page.setViewport({ width: 600, height: 1300 });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await page.goto(`http://localhost:8899/render_car_page.html`, { waitUntil: 'networkidle0', timeout: 30000 }).catch((e) => console.log('nav', e.message));
// wait for 6 images
try {
  await page.waitForFunction(`document.querySelectorAll('img').length >= 6 && window.__RENDER_DONE === 6`, { timeout: 30000 });
} catch { console.log('timeout waiting renders, images so far:', await page.evaluate(() => document.querySelectorAll('img').length)); }
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `scripts/${prefix}_views.png`, fullPage: true });
console.log('saved', `scripts/${prefix}_views.png`);
await browser.close();
