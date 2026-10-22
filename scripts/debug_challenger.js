// دیباگ سریع — وضعیت دکمه‌ها و ترافیک بعد از رانندگی آزاد
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 780, height: 360 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 160)); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('رانندگی آزاد')), null, { timeout: 90000 });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'));
    b.click();
  });
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('button[aria-label]')).map((b) => b.getAttribute('aria-label'));
    const gm = window.__funnycar;
    const ids = gm?.traffic?.cars ? gm.traffic.cars.map((c) => c.assetId) : null;
    const state = gm ? gm.state : 'NO_GM';
    return { labels, ids, state, hasRenderer: !!gm?.renderer3d };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
