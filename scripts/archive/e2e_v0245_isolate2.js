// isolate2: zone refill/repair با polling طولانی (هدلس اسلوموشن است)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 780, height: 360 } });
  page.on('crash', () => console.log('[PAGE CRASHED]'));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('رانندگی آزاد')), null, { timeout: 90000 });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'))?.click());
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رد کردن'));
    if (b) b.click();
  });

  // ---------- سوخت‌گیری با polling ----------
  await page.evaluate(() => {
    const g = window.__funnycar;
    const z = g.world.repairZones.find((zz) => zz.kind === 'fuel');
    g.vehicle.x = z.x; g.vehicle.y = z.y; g.vehicle.speed = 0; g.vehicle.fuel = 25;
    g.camera.snapTo(z.x, z.y);
  });
  let fuel = 25, tries = 0;
  while (fuel < 100 && tries < 26) {
    await page.waitForTimeout(3000);
    fuel = await page.evaluate(() => Math.round(window.__funnyカr?.vehicle?.fuel ?? window.__funnycar.vehicle.fuel));
    tries++;
  }
  console.log('FUEL_REFILLED', fuel >= 100, 'fuel=', fuel, 'tries=', tries);
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_fuel_zone.png' });

  // ---------- مصرف بنزین: دور از زون + گاز ----------
  await page.evaluate(() => {
    const g = window.__funnycar;
    g.vehicle.x = 875 + 420; g.vehicle.y = 875 + 420; // وسط بلوک جاده؟ روی جاده بگذاریم: roadCenter(1)
    const rc = g.world.roadCenter ? 0 : 0;
    g.vehicle.speed = 0;
  });
  // روی جادهٔ عمودی اول بگذار
  await page.evaluate(() => {
    const g = window.__funnycar;
    const pitch = 1400, roadW = 560;
    g.vehicle.x = pitch + roadW / 2 + 70; g.vehicle.y = pitch + roadW / 2 + 400; g.vehicle.angle = 0; g.vehicle.speed = 0;
    g.camera.snapTo(g.vehicle.x, g.vehicle.y);
  });
  // نگه داشتن گاز از راه InputManager مستقیم
  const f0 = await page.evaluate(() => {
    const g = window.__funnycar;
    g.input.setVirtualGas(true);
    return Math.round(g.vehicle.fuel * 10) / 10;
  });
  await page.waitForTimeout(12000);
  const f1 = await page.evaluate(() => {
    const g = window.__funnycar;
    g.input.setVirtualGas(false);
    return Math.round(g.vehicle.fuel * 10) / 10;
  });
  console.log('FUEL_DRAINS', f1 < f0, JSON.stringify({ f0, f1 }));

  // ---------- تعمیرگاه با polling ----------
  await page.evaluate(() => {
    const g = window.__funnycar;
    const z = g.world.repairZones.find((zz) => zz.kind === 'repair');
    g.vehicle.x = z.x; g.vehicle.y = z.y; g.vehicle.speed = 0; g.vehicle.input = undefined;
    g.vehicle.applyDamage(45, true);
    g.camera.snapTo(z.x, z.y);
  });
  let hp = 55, tries2 = 0;
  while (hp < 100 && tries2 < 26) {
    await page.waitForTimeout(3000);
    hp = await page.evaluate(() => Math.round(window.__funnycar.vehicle.health));
    tries2++;
  }
  console.log('REPAIR_ZONE_HEALED', hp >= 100, 'health=', hp, 'tries=', tries2);
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_repair_zone.png' });

  await browser.close();
  console.log('ISOLATE2_DONE');
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1); });
