// E2E v0.2.45 — بخش ۱: HUD جدید (گیج بالا-راست، ریفرش/مأموریت، باک بنزین، بدون بوق)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 780, height: 360 } }); // لنداسکیپ موبایل
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  // صبر برای منو (بوت کامل)
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.some((b) => b.textContent?.includes('رانندگی آزاد'));
  }, null, { timeout: 90000 });
  console.log('MENU_OK');

  // رانندگی آزاد (دکمهٔ منو onClick معمولی است)
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'));
    b.click();
  });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: '/home/z/my-project/scripts/v0245_play_default.png' });

  // ---------- ۱) دکمه‌های بالای صفحه سمت چپ: توقف + ریفرش + مأموریت ----------
  const topLeft = await page.evaluate(() => {
    const find = (label) => {
      const el = document.querySelector(`button[aria-label="${label}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 };
    };
    return {
      pause: find('توقف بازی'),
      respawn: find('ریفرش ماشین — آزاد شدن از گیرکردن'),
      mission: find('شروع مأموریت بعدی'),
    };
  });
  console.log('TOP_LEFT', JSON.stringify(topLeft));
  const tlOk = topLeft.pause && topLeft.pause.x < 80 && topLeft.respawn && topLeft.respawn.x < 140 && topLeft.mission && topLeft.mission.x < 200;
  console.log('TOP_LEFT_POS_OK', tlOk);

  // ---------- ۲) بوق حذف شده؟ ----------
  const hornGone = await page.evaluate(() => !document.querySelector('button[aria-label="بوق"]'));
  console.log('HORN_REMOVED', hornGone);

  // ---------- ۳) سرعت‌سنج بالا-راست زیر مینی‌مپ + روی ماشین نیست ----------
  const gauge = await page.evaluate(() => {
    const svgs = Array.from(document.querySelectorAll('svg'));
    // گیج داخل پنل fc-panel با aria-hidden
    for (const s of svgs) {
      const panel = s.closest('div.fc-panel');
      if (!panel) continue;
      const r = panel.getBoundingClientRect();
      if (r.width > 60 && r.width < 130 && r.height > 40) {
        return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      }
    }
    return null;
  });
  console.log('GAUGE', JSON.stringify(gauge));
  const gOk = gauge && gauge.x > 780 - 140 && gauge.y < 200;
  console.log('GAUGE_TOPRIGHT_OK', gOk);

  // ---------- ۴) باک بنزین در نوار بالا ----------
  const fuelPill = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('.fc-panel'));
    for (const el of els) {
      if (el.querySelector('svg.lucide-fuel')) {
        const bar = el.querySelector('div.h-2\\.5');
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), barW: bar ? Math.round(bar.getBoundingClientRect().width) : 0 };
      }
    }
    return null;
  });
  console.log('FUEL_PILL', JSON.stringify(fuelPill), 'OK', !!fuelPill);

  // ---------- ۵) ماشین واقعاً وسط است و گیج روی آن نیست (چک هندسی) ----------
  const centerFree = await page.evaluate(() => {
    // گیج نباید با ناحیهٔ مرکز صفحه (جایی که ماشین رندر می‌شود) هم‌پوشانی داشته باشد
    const svgs = Array.from(document.querySelectorAll('svg'));
    for (const s of svgs) {
      const panel = s.closest('div.fc-panel');
      if (!panel) continue;
      const r = panel.getBoundingClientRect();
      if (r.width > 60 && r.width < 130 && r.height > 40) {
        const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
        const inside = cx > r.x && cx < r.x + r.width && cy > r.y && cy < r.y + r.height;
        return !inside;
      }
    }
    return false;
  });
  console.log('GAUGE_NOT_ON_CAR', centerFree);

  await browser.close();
  console.log('PART1_DONE');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
