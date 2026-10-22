// دیباگ چرخش چرخ — نمونه‌برداری پیوسته
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 780, height: 360 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('رانندگی آزاد')), null, { timeout: 90000 });
  await page.evaluate(() => {
    const gm = window.__funnycar;
    gm.save.mutate((d) => { d.coins = 9000; });
    gm.buyVehicle('veh_challenger_01', '#b03a2e');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('رانندگی آزاد')), null, { timeout: 90000 });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد')).click();
  });
  await page.waitForTimeout(4000);
  const model0 = await page.evaluate(() => {
    const pm = window.__funnycar.renderer3d.playerModel;
    return JSON.stringify({ variant: window.__funnycar.renderer3d.playerVariant, ext: pm.extWheels?.length, wheels: pm.wheels?.length });
  });
  console.log('MODEL', model0);
  await page.keyboard.down('w');
  for (let i = 0; i < 4; i++) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(() => {
      const pm = window.__funnycar.renderer3d.playerModel;
      return JSON.stringify({
        speed: +window.__funnycar.vehicle.speed.toFixed(1),
        angles: (pm?.extWheels ?? []).map((w) => +w.angle.toFixed(2)),
        wheelRot: (pm?.wheels ?? []).map((w) => +w.rotation.x.toFixed(2)),
        drawH: window.__funnycar.vehicle.drawH,
      });
    });
    console.log('t+' + (i + 1) + 's', s);
  }
  await page.keyboard.up('w');
  await page.screenshot({ timeout: 60000, path: '/home/z/my-project/scripts/v0245_challenger_player.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
