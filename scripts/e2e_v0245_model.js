// probe: ساختار مدل بازیکن + تست گشتاور با حلقهٔ کامل
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 780, height: 360 } });
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('رانندگی آزاد')), null, { timeout: 90000 });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'))?.click());
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const g = window.__funnycar;
    const v = g.vehicle;
    const pm = g.renderer3d.playerModel;
    const names = [];
    pm.group.traverse((o) => { if (o.name) names.push(o.name); });
    const wheelNames = names.filter((n) => n.toLowerCase().includes('wheel') || n.toLowerCase().includes('charkh') || n.includes('چرخ'));

    // تست گشتاور: حلقهٔ کامل تا برخورد
    v.reset(1750, 5000, Math.PI / 2); // رو به شرق
    v.speed = 300; v.fuel = 100;
    const wall = { x: 2100, y: 4300, w: 120, h: 1400 }; // دیوار شرقی
    let res = null, steps = 0;
    for (let i = 0; i < 400; i++) {
      res = v.update(1 / 120, { steer: 0, gas: false, brake: false }, [wall]);
      steps++;
      if (res.crashed) break;
    }
    return {
      modelKeys: Object.keys(pm),
      wheelMeshes: pm.wheels?.length ?? 0,
      extWheels: pm.extWheels?.length ?? 0,
      steerable: pm.steerable?.length ?? 0,
      wheelNames: wheelNames.slice(0, 12),
      kick: { crashed: res?.crashed, steps, impact: Math.round(res?.impactSpeed ?? 0), dAngleDeg: +((v.angle - Math.PI / 2) * 180 / Math.PI).toFixed(1) },
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1); });
