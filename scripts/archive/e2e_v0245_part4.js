// E2E v0.2.45 — بخش ۴: پرتره + زون بنزین (چیپ سوخت‌گیری) + نهایی لنداسکیپ
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // پورت‌ریت
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('رانندگی آزاد')), null, { timeout: 90000 });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'))?.click());
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رد کردن'));
    if (b) b.click();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_portrait.png' });

  // هندسه: گیج زیر مینی‌مپ، بدون هم‌پوشانی با ستون چپ و پنل مأموریت
  const geo = await page.evaluate(() => {
    const findGauge = () => {
      for (const s of document.querySelectorAll('svg')) {
        const panel = s.closest('div.fc-panel');
        if (!panel) continue;
        const r = panel.getBoundingClientRect();
        if (r.width > 60 && r.width < 130 && r.height > 40) return r;
      }
      return null;
    };
    const g = findGauge();
    const pause = document.querySelector('button[aria-label="توقف بازی"]')?.getBoundingClientRect();
    const fuelSvg = document.querySelector('svg.lucide-fuel')?.getBoundingClientRect();
    const mmW = Math.min(112, window.innerWidth * 0.24);
    return {
      gauge: g ? { x: Math.round(g.x), y: Math.round(g.y), w: Math.round(g.width) } : null,
      gaugeUnderMinimap: g ? g.y >= mmW + 8 : false,
      gaugeXRight: g ? g.x > window.innerWidth - mmW - 20 : false,
      noOverlapWithLeft: g && pause ? g.x > pause.x + 200 : null,
      fuelPillY: fuelSvg ? Math.round(fuelSvg.y) : null,
      respBtn: !!document.querySelector('button[aria-label="ریفرش ماشین — آزاد شدن از گیرکردن"]'),
      missionBtn: !!document.querySelector('button[aria-label="شروع مأموریت بعدی"]'),
    };
  });
  console.log('PORTRAIT_GEO', JSON.stringify(geo));

  // زون سوخت‌گیری: تلپورت + چیپ
  await page.evaluate(() => {
    const g = window.__funnycar;
    const z = g.world.repairZones.find((zz) => zz.kind === 'fuel');
    g.vehicle.x = z.x; g.vehicle.y = z.y; g.vehicle.speed = 0; g.vehicle.fuel = 55;
    g.camera.snapTo(z.x, z.y);
  });
  await page.waitForTimeout(5000);
  const zoneChip = await page.evaluate(() => {
    const chip = Array.from(document.querySelectorAll('.fc-panel')).find((p) => p.textContent?.includes('سوخت‌گیری'));
    return { chip: !!chip, text: chip?.textContent ?? null };
  });
  console.log('ZONE_CHIP', JSON.stringify(zoneChip));
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_fuel_zone.png' });

  await browser.close();
  console.log('PART4_DONE');
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1); });
