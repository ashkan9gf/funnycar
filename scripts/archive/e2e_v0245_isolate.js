// isolate: teleport to fuel zone without mission
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 780, height: 360 } });
  page.on('crash', () => console.log('[PAGE CRASHED]'));
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('رانندگی آزاد')), null, { timeout: 90000 });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'))?.click());
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رد کردن'));
    if (b) b.click();
  });
  console.log('STEP: teleporting to fuel zone');
  await page.evaluate(() => {
    const g = window.__funnycar;
    const z = g.world.repairZones.find((zz) => zz.kind === 'fuel');
    g.vehicle.x = z.x; g.vehicle.y = z.y; g.vehicle.speed = 0; g.vehicle.fuel = 30;
    g.camera.snapTo(z.x, z.y);
  });
  await page.waitForTimeout(3500);
  const fuel = await page.evaluate(() => Math.round(window.__funnycar.vehicle.fuel));
  console.log('FUEL_REFILLED', fuel > 90, 'fuel=', fuel);
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_fuel_zone.png' });
  // تعمیرگاه
  await page.evaluate(() => {
    const g = window.__funnycar;
    const z = g.world.repairZones.find((zz) => zz.kind === 'repair');
    g.vehicle.x = z.x; g.vehicle.y = z.y; g.vehicle.speed = 0;
    g.vehicle.applyDamage(40, true);
    g.camera.snapTo(z.x, z.y);
  });
  await page.waitForTimeout(3500);
  const hp = await page.evaluate(() => Math.round(window.__funnycar.vehicle.health));
  console.log('REPAIR_ZONE_HEALED', hp > 95, 'health=', hp);
  await browser.close();
  console.log('ISOLATE_DONE');
})().catch((e) => { console.error('FATAL', String(e).slice(0, 200)); process.exit(1); });
