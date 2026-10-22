// e2e_v0248_diag.mjs — visual diagnosis: garage cards (police + player) + city buildings
// usage: node scripts/e2e_v0248_diag.mjs <outPrefix>
import { chromium } from 'puppeteer';

const prefix = process.argv[2] || 'diag';
const BASE = 'http://localhost:8899/';

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--window-size=390,844'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') console.log('[console-err]', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, 3500));

// tap start / enter game menu (button with text)
async function tapByText(txt) {
  const ok = await page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, [role=button], div')];
    const el = els.find((e) => (e.textContent || '').trim().includes(t) && e.offsetParent !== null);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const ev = (type) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    ev('pointerdown'); ev('pointerup');
    if (el.tagName === 'BUTTON') el.click();
    return true;
  }, txt);
  if (!ok) console.log('  ! tap target not found:', txt);
  return ok;
}

await tapByText('شروع');
await new Promise((r) => setTimeout(r, 1200));

// open garage if there is a garage tab/button
const opened = await tapByText('نمایشگاه') || await tapByText('گاراژ');
await new Promise((r) => setTimeout(r, 3000));
await page.screenshot({ path: `scripts/${prefix}_garage.png` });
console.log('garage screenshot saved');

// scroll to find police + player cards; capture each card canvas
const cards = await page.evaluate(() => {
  const out = [];
  const canvases = [...document.querySelectorAll('canvas')];
  canvases.forEach((c, i) => {
    const r = c.getBoundingClientRect();
    const card = c.closest('div');
    const label = card ? (card.textContent || '').slice(0, 60) : '';
    out.push({ i, x: r.x, y: r.y, w: r.width, h: r.height, label });
  });
  return out;
});
console.log('canvases:', JSON.stringify(cards, null, 1).slice(0, 1200));

await browser.close();
console.log('done');
