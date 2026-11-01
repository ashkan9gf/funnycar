import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const bad = [];
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().slice(0, 120)}`); });
await page.goto('http://localhost:8899/', { waitUntil: 'load', timeout: 60000 });
await new Promise((r) => setTimeout(r, 8000));
const info = await page.evaluate(() => ({
  title: document.title,
  bodyLen: document.body.innerHTML.length,
  hasCanvas: !!document.querySelector('canvas'),
  btns: [...document.querySelectorAll('button')].slice(0, 6).map((b) => (b.textContent || '').trim().slice(0, 30)),
  hasFc: typeof window.__funnycar,
}));
console.log(info);
console.log('bad responses:', bad.slice(0, 10));
await page.screenshot({ path: '/tmp/dbg_page.png' });
await browser.close();
