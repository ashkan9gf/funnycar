import { chromium } from 'playwright';
const car = process.argv[2] || 'pride_raw_tex';
const out = process.argv[3] || `/tmp/rawtex_${car}.png`;
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 580, height: 460 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
await page.goto(`http://localhost:8899/rawtex_render_page.html?car=${car}`, { waitUntil: 'load', timeout: 30000 });
try { await page.waitForFunction('window.__DONE === 1', { timeout: 20000 }); } catch { console.log('timeout'); }
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
