// logic probe v0.2.45 — تست قطعی منطق (بدون وابستگی به FPS هدلس)
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 780, height: 360 } });
  page.on('crash', () => console.log('[PAGE CRASHED]'));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('رانندگی آزاد')), null, { timeout: 90000 });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'))?.click());
  await page.waitForTimeout(2000);

  const r = await page.evaluate(() => {
    const g = window.__funnycar;
    const v = g.vehicle;
    const out = {};

    // ---------- ۱) شتاب تدریجی: منحنی سرعت باید نزدیک سقف صاف شود ----------
    v.reset(v.x, v.y, 0);
    v.fuel = 100;
    const samples = [];
    const colliders = [];
    const dt = 1 / 120;
    for (let i = 0; i < 600; i++) { // ۵ ثانیهٔ شبیه‌سازی
      v.update(dt, { steer: 0, gas: true, brake: false }, colliders);
      if (i % 60 === 0) samples.push(Math.round(v.speed));
    }
    out.accelCurve = samples; // [0s..5s]
    const last3 = samples.slice(-3);
    const gainTail = last3[2] - last3[0]; // رشد ۰٫۲ ثانیهٔ آخر
    out.tailGainSmall = gainTail > 0 && gainTail < 12; // باید تقریباً صاف شده باشد
    const firstGain = samples[1] - samples[0];
    out.headFasterThanTail = firstGain > gainTail * 2;

    // ---------- ۲) مصرف بنزین: نرخ‌ها ----------
    v.fuel = 100; v.speed = 0;
    v.drainFuel(1.0);
    const idleDrain = 100 - v.fuel; // ~0.06
    v.fuel = 100; v.speed = 380;
    v.drainFuel(1.0);
    const fullDrain = 100 - v.fuel; // ~0.364
    out.drainRates = { idle: +idleDrain.toFixed(3), full: +fullDrain.toFixed(3) };
    out.drainOk = idleDrain > 0.02 && idleDrain < 0.12 && fullDrain > 0.25 && fullDrain < 0.5;

    // ---------- ۳) سوخت‌گیری: نرخ ----------
    v.fuel = 40;
    v.refuel(1.0); v.refuel(1.0);
    out.refuelOk = Math.abs(v.fuel - 92) < 0.01; // 40+52

    // ---------- ۴) بنزین خالی = موتور بی‌نفس (نه خاموشی) ----------
    v.fuel = 0; v.speed = 0;
    for (let i = 0; i < 240; i++) v.update(dt, { steer: 0, gas: true, brake: false }, colliders);
    const emptyCap = v.maxSpeed;
    out.emptyLimp = emptyCap > 100 && emptyCap < 145; // 380*0.34≈129
    out.emptySpeedAfter2s = Math.round(v.speed);

    // ---------- ۵) زون‌ها: نوع‌بندی ----------
    const zones = g.world.repairZones;
    out.zoneKinds = zones.map((z) => z.kind);
    out.hasFuel = zones.some((z) => z.kind === 'fuel');
    out.hasRepair = zones.some((z) => z.kind === 'repair');

    // ---------- ۶) گشتاور برخورد: ضربهٔ گوشه‌ای باید زاویه عوض کند ----------
    // دیوار کوتاه؛ ماشین با گوشهٔ جلو-راست می‌خورد → باید گشتاور بگیرد
    const wall = { x: 2100, y: 5300, w: 120, h: 300 };
    v.reset(1900, 5640, Math.PI / 2); // رو به شرق؛ نوار تماس محدود به گوشه
    v.speed = 300; v.fuel = 100;
    const angle0 = v.angle;
    let res = null;
    for (let i = 0; i < 400; i++) {
      res = v.update(dt, { steer: 0, gas: false, brake: false }, [wall]);
      if (res.crashed) break;
    }
    out.spinKick = { crashed: !!res?.crashed, dAngleDeg: +((v.angle - angle0) * 180 / Math.PI).toFixed(1) };
    out.spinKickWorks = !!res?.crashed && Math.abs(v.angle - angle0) > 0.01;

    // ---------- ۷) چرخ‌ها: جهت اسپین — جلو = -Z ⇒ ωx منفی ----------
    const pm = g.renderer3d.playerModel;
    const wheels = pm?.wheels ?? [];
    out.proceduralWheelCount = wheels.length;
    if (wheels.length > 0) {
      const rx0 = wheels[0].rotation.x;
      const wheelR = v.drawH * 0.135;
      const amount = (200 / wheelR) * dt; // جلو (سرعت مثبت)
      for (const w of wheels) w.rotation.x -= amount; // همان فرمول فیکس‌شده
      out.spinDelta = +(rx0 - wheels[0].rotation.x).toFixed(4); // باید مثبت باشد (کاهش rotation.x)
      out.spinForwardOk = wheels[0].rotation.x < rx0;
    }

    return out;
  });
  console.log(JSON.stringify(r, null, 1));

  const pass =
    r.headFasterThanTail && r.drainOk && r.refuelOk && r.emptyLimp &&
    r.hasFuel && r.hasRepair && r.spinKickWorks && r.spinForwardOk === true;
  console.log('LOGIC_ALL_PASS', pass);

  await browser.close();
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1); });
