// E2E v0.2.45 — بخش ۳: سه مود رانندگی (دکمه‌ای/فرمان و پدال/ژیروسکوپ) + ذخیره
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 780, height: 360 } });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('رانندگی آزاد')), null, { timeout: 90000 });
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'))?.click());
  await page.waitForTimeout(2000);

  // باز کردن Pause → تنظیمات صدا (پنل تنظیمات داخل Pause است)
  await page.evaluate(() => document.querySelector('button[aria-label="توقف بازی"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('تنظیمات صدا'));
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  const hasModeSelector = await page.evaluate(() => !!document.querySelector('button[aria-label="مود رانندگی فرمان و پدال"]'));
  console.log('MODE_SELECTOR_IN_SETTINGS', hasModeSelector);

  // ---------- مود فرمان و پدال ----------
  await page.evaluate(() => document.querySelector('button[aria-label="مود رانندگی فرمان و پدال"]')?.click());
  await page.waitForTimeout(400);
  // ادامه بازی
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('ادامه بازی'));
    if (b) b.click();
  });
  await page.waitForTimeout(900);
  const wheelUi = await page.evaluate(() => {
    const wheel = document.querySelector('[role="slider"][aria-label="فرمان"]');
    const gas = document.querySelector('button[aria-label="گاز"]');
    const brake = document.querySelector('button[aria-label="ترمز"]');
    const buttons = document.querySelector('button[aria-label="فرمان چپ"]');
    const wr = wheel ? wheel.getBoundingClientRect() : null;
    return {
      wheel: wr ? { x: Math.round(wr.x), y: Math.round(wr.y), w: Math.round(wr.width) } : null,
      gas: !!gas, brake: !!brake, buttonsModeGone: !buttons,
    };
  });
  console.log('WHEEL_MODE_UI', JSON.stringify(wheelUi));
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_wheel_mode.png' });

  // چرخاندن فرمان با رویدادهای اشاره‌گر → خودرو باید بپیچد
  const steerTest = await page.evaluate(() => {
    const g = window.__funnycar;
    const wheel = document.querySelector('[role="slider"][aria-label="فرمان"]');
    const r = wheel.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const ev = (type, x, y) => wheel.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 5, clientX: x, clientY: y, isPrimary: true }));
    const a0 = g.vehicle.angle;
    ev('pointerdown', cx, cy - r.width / 2); // بالای فرمان
    for (let i = 1; i <= 8; i++) {
      const ang = -Math.PI / 2 + (i / 8) * (Math.PI / 2); // از بالا به سمت راست (−Y به +X)
      ev('pointermove', cx + Math.cos(ang) * r.width / 2, cy + Math.sin(ang) * r.width / 2);
    }
    ev('pointerup', cx + r.width / 2, cy);
    return { steerAfter: g.input.analogSteer !== undefined ? 'private' : 'private', a0 };
  });
  await page.waitForTimeout(400);
  const steerVal = await page.evaluate(() => {
    // steer آنالوگ خصوصی است — از طریق collect نمی‌شود؛ زاویهٔ بصری فرمان را می‌خوانیم
    const wheel = document.querySelector('[role="slider"][aria-label="فرمان"]');
    const inner = wheel.querySelector('div[style*="rotate"]');
    return inner ? inner.getAttribute('style') : null;
  });
  console.log('WHEEL_TURNED', JSON.stringify({ steerVal }));

  // ---------- مود ژیروسکوپ ----------
  await page.evaluate(() => document.querySelector('button[aria-label="توقف بازی"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    if (!document.querySelector('button[aria-label="مود رانندگی ژیروسکوپ"]')) {
      const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('تنظیمات صدا'));
      if (b) b.click();
    }
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('button[aria-label="مود رانندگی ژیروسکوپ"]')?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('ادامه بازی'));
    if (b) b.click();
  });
  await page.waitForTimeout(700);
  const tiltUi = await page.evaluate(() => {
    const gas = document.querySelector('button[aria-label="گاز"]');
    const wheel = document.querySelector('[role="slider"][aria-label="فرمان"]');
    const calib = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('ثبت مرکز'));
    return { gas: !!gas, wheelGone: !wheel, calibChip: !!calib };
  });
  console.log('TILT_MODE_UI', JSON.stringify(tiltUi));
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_tilt_mode.png' });

  // شبیه‌سازی رویداد ژیروسکوپ → فرمان آنالوگ باید روی ماشین اثر بگذارد
  const tiltSteer = await page.evaluate(() => {
    const g = window.__funnycar;
    const a0 = g.vehicle.angle;
    // رویداد اول = ثبت مرکز؛ بعد گاز + کج‌کردن
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { gamma: 10, beta: 0 }));
    g.input.setVirtualGas(true);
    return new Promise((res) => setTimeout(() => {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { gamma: 26, beta: 0 }));
      setTimeout(() => {
        g.input.setVirtualGas(false);
        res({ a0, a1: g.vehicle.angle, moved: Math.abs(g.vehicle.angle - a0) > 0.004 });
      }, 1200);
    }, 600));
  });
  console.log('TILT_STEERS_CAR', JSON.stringify(tiltSteer));

  // ---------- ذخیره شدن مود ----------
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('funnycarir_save')).settings.controlMode);
  console.log('CONTROL_MODE_SAVED', saved === 'tilt', saved);

  // ---------- برگشت به دکمه‌ای ----------
  await page.evaluate(() => document.querySelector('button[aria-label="توقف بازی"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    if (!document.querySelector('button[aria-label="مود رانندگی دکمه‌ای"]')) {
      const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('تنظیمات صدا'));
      if (b) b.click();
    }
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector('button[aria-label="مود رانندگی دکمه‌ای"]')?.click());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('ادامه بازی'));
    if (b) b.click();
  });
  await page.waitForTimeout(700);
  const backUi = await page.evaluate(() => ({
    steerLeft: !!document.querySelector('button[aria-label="فرمان چپ"]'),
    wheelGone: !document.querySelector('[role="slider"][aria-label="فرمان"]'),
  }));
  console.log('BACK_TO_BUTTONS', JSON.stringify(backUi));
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_buttons_mode.png' });

  await browser.close();
  console.log('PART3_DONE');
})().catch((e) => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1); });
