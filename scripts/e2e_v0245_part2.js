// E2E v0.2.45 — بخش ۲: ریفرش (سقوط از آسمان)، دکمهٔ مأموریت، زون بنزین، دوربین ۳۶۰°
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 780, height: 360 } });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('رانندگی آزاد')), null, { timeout: 90000 });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'))?.click());
  await page.waitForTimeout(2500);
  // رد کردن آموزش
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رد کردن'));
    if (b) b.click();
  });
  await page.waitForTimeout(600);

  // ---------- ۱) ریفرش: ماشین باید بالا برود و همان‌جا بیفتد ----------
  const pos0 = await page.evaluate(() => {
    const g = window.__funnycar;
    return { x: g.vehicle.x, y: g.vehicle.y, speed: g.vehicle.speed };
  });
  await page.evaluate(() => document.querySelector('button[aria-label="ریفرش ماشین — آزاد شدن از گیرکردن"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(350); // وسط بالا رفتن
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_drop_mid.png' });
  const dropState = await page.evaluate(() => {
    const g = window.__funnycar;
    // dropT خصوصی است؛ از رفتار بیرونی می‌سنجیم: سرعت صفر و موتور آرام
    return { speed: g.vehicle.speed, x: g.vehicle.x, y: g.vehicle.y };
  });
  await page.waitForTimeout(1100); // پایان سقوط
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_drop_landed.png' });
  const pos1 = await page.evaluate(() => {
    const g = window.__funnycar;
    return { x: g.vehicle.x, y: g.vehicle.y, speed: g.vehicle.speed };
  });
  const samePlace = Math.abs(pos1.x - pos0.x) < 30 && Math.abs(pos1.y - pos0.y) < 30;
  console.log('RESPAWN_SAME_PLACE', samePlace, JSON.stringify({ pos0, dropState, pos1 }));

  // ---------- ۲) دوربین ۳۶۰°: کشیدن افقی روی صحنه (PointerEvent مصنوعی — بدون CDP mouse) ----------
  page.on('crash', () => console.log('[PAGE CRASHED]'));
  const cam0 = await page.evaluate(() => ({ angle: window.__funnycar.renderer3d.camAngle, orbit: window.__funnycar.renderer3d.camOrbit }));
  await page.evaluate(() => {
    const cv = document.querySelector('canvas');
    const opts = (x) => ({ bubbles: true, pointerId: 7, clientX: x, clientY: 180, isPrimary: true });
    cv.dispatchEvent(new PointerEvent('pointerdown', opts(390)));
    let x = 390;
    for (let i = 0; i < 10; i++) { x += 15; cv.dispatchEvent(new PointerEvent('pointermove', opts(x))); }
    cv.dispatchEvent(new PointerEvent('pointerup', opts(x)));
  });
  await page.waitForTimeout(250);
  const cam1 = await page.evaluate(() => ({ angle: window.__funnycar.renderer3d.camAngle, orbit: window.__funnycar.renderer3d.camOrbit }));
  console.log('ORBIT_DRAG', JSON.stringify({ cam0, cam1 }), 'ORBITED', Math.abs(cam1.orbit) > 0.3);
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_orbit.png' });
  // بعد از ~۲٫۶ ثانیه باید نرم به پشت ماشین برگردد
  await page.waitForTimeout(4000);
  const cam2 = await page.evaluate(() => ({ orbit: window.__funnycar.renderer3d.camOrbit }));
  console.log('ORBIT_RETURNED', Math.abs(cam2.orbit) < cam1.orbit * 0.55, JSON.stringify({ orbit: cam2.orbit, was: cam1.orbit }));

  // ---------- ۳) دکمهٔ شروع مأموریت در رانندگی آزاد ----------
  await page.evaluate(() => document.querySelector('button[aria-label="شروع مأموریت بعدی"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(2200);
  const missionHud = await page.evaluate(() => {
    const panel = Array.from(document.querySelectorAll('.fc-panel')).find((p) => p.textContent?.includes('ثانیه') || p.textContent?.includes('متر'));
    return { hasMissionPanel: !!panel, text: panel ? panel.textContent.slice(0, 60) : null };
  });
  console.log('MISSION_BTN_STARTS_MISSION', JSON.stringify(missionHud));
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_mission_started.png' });
  // انصراف
  await page.evaluate(() => document.querySelector('button[aria-label="انصراف از مأموریت"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(500);

  // ---------- ۴) زون پمپ بنزین: تلپورت به زون سوخت‌گیری مبدأ ----------
  await page.evaluate(() => {
    const g = window.__funnycar;
    // زون پمپ بنزین مبدأ: 3*pitch+roadW+420، roadCenter(3)
    const W = g.world;
    const z = W.repairZones.find((zz) => zz.kind === 'fuel');
    g.vehicle.x = z.x; g.vehicle.y = z.y; g.vehicle.speed = 0; g.vehicle.fuel = 30;
    g.camera.snapTo(z.x, z.y);
  });
  await page.waitForTimeout(3200); // چند ثانیه سوخت‌گیری
  const fuelState = await page.evaluate(() => {
    const g = window.__funnycar;
    return { fuel: Math.round(g.vehicle.fuel) };
  });
  console.log('FUEL_REFILLED', fuelState.fuel > 90, JSON.stringify(fuelState));
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_fuel_zone.png' });

  // ---------- ۵) زون تعمیرگاه مبدأ: آسیب → ترمیم ----------
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
  console.log('PART2_DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
