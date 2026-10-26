import { chromium } from 'playwright';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto('http://localhost:8899/', { waitUntil: 'load', timeout: 60000 });
for (let i = 0; i < 30; i++) {
  const s = await page.evaluate(() => window.__funnycar?.getState?.() ?? null);
  if (s === 'menu' || s === 'garage') break;
  await sleep(2000);
}
await sleep(2000);
const texts = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('button, [role=button]')) {
    if (el.offsetParent !== null) out.push((el.textContent || '').trim().slice(0, 40));
  }
  return out;
});
console.log(JSON.stringify(texts, null, 1));
await browser.close();
