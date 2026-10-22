// E2E چلنجر — ترافیک + نمایشگاه + خرید + چرخش چرخ
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 780, height: 360 } });
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 300)));

  const tapByLabel = (label) => page.evaluate((lb) => {
    const b = document.querySelector(`button[aria-label="${lb}"]`);
    if (!b) return 'NOT_FOUND';
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    return 'OK';
  }, label);
  const tapByText = (text) => page.evaluate((tx) => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => (x.textContent || '').includes(tx) || (x.getAttribute('aria-label') || '').includes(tx));
    if (!b) return 'NOT_FOUND';
    // TapButton فقط pointerdown؛ دکمه معمولی فقط click — هر دو را بفرست
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    try { b.click(); } catch { /* noop */ }
    return 'OK';
  }, text);

  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.some((b) => b.textContent?.includes('رانندگی آزاد'));
  }, null, { timeout: 90000 });
  console.log('MENU_OK');

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'));
    b.click();
  });
  await page.waitForTimeout(5000);

  // ---------- ۱) چلنجر در ترافیک + مدل GLB خارجی با ۴ چرخ ----------
  const trafficInfo = await page.waitForFunction(() => {
    const gm = window.__funnycar;
    if (!gm?.traffic?.cars || !gm.renderer3d?.trafficModels) return null;
    const ch = gm.traffic.cars.filter((c) => c.assetId === 'veh_challenger_01');
    if (ch.length === 0) return null;
    const model = gm.renderer3d.trafficModels.get(ch[0]);
    if (!model) return null;
    return JSON.stringify({
      count: ch.length,
      extWheels: model.extWheels?.length ?? -1,
      len: model.len,
      scale: +(model.group?.scale?.x?.toFixed(3) ?? 0),
    });
  }, { timeout: 30000 });
  console.log('TRAFFIC_CHALLENGER', await trafficInfo.jsonValue());

  await page.evaluate(() => {
    const gm = window.__funnycar;
    const ch = gm.traffic.cars.find((c) => c.assetId === 'veh_challenger_01');
    const v = gm.vehicle;
    ch.x = v.x + 30;
    ch.y = v.y - 150;
    ch.angle = 0;
    ch.speed = 0;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ timeout: 60000, path: '/home/z/my-project/scripts/v0245_challenger_traffic.png' });
  console.log('SHOT_TRAFFIC');

  // ---------- ۲) منوی اصلی → گاراژ → کارت چلنجر ----------
  console.log('PAUSE', await tapByLabel('توقف بازی'));
  await page.waitForTimeout(800);
  console.log('MAIN_MENU', await tapByText('منوی اصلی'));
  await page.waitForTimeout(1200);
  console.log('GARAGE_OPEN', await tapByText('گاراژ'));
  await page.waitForTimeout(2000);
  const cardFound = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find((e) => e.children.length === 0 && e.textContent?.trim() === 'چلنجر موسکل');
    return el ? 'FOUND' : 'MISSING';
  });
  console.log('GARAGE_CARD', cardFound);
  await page.screenshot({ timeout: 60000, path: '/home/z/my-project/scripts/v0245_challenger_garage.png' });

  // ---------- ۳) خرید + رنگ قرمز ----------
  const buy = await page.evaluate(() => {
    const gm = window.__funnycar;
    gm.save.mutate((s) => { s.coins = 9000; });
    const r = gm.buyVehicle('veh_challenger_01', '#b03a2e');
    return JSON.stringify(r);
  });
  console.log('BUY', buy);
  await page.waitForTimeout(1000);
  await page.screenshot({ timeout: 60000, path: '/home/z/my-project/scripts/v0245_challenger_garage_owned.png' });

  // ---------- ۴) بستن گاراژ → رانندگی آزاد → چرخش چرخ چلنجر قرمز ----------
  console.log('GARAGE_CLOSE', await tapByLabel('بستن گاراژ'));
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes('رانندگی آزاد'));
    b.click();
  });
  await page.waitForTimeout(3500);

  const playerCheck = await page.evaluate(() => {
    const gm = window.__funnycar;
    const pm = gm.renderer3d?.playerModel;
    return JSON.stringify({
      variant: gm.renderer3d?.playerVariant,
      extWheels: pm?.extWheels?.length ?? -1,
      paint: pm?.bodyColor,
      isGLB: !!(pm?.group?.children?.some?.((c) => c.name === '__static') ?? false) || (pm?.extWheels?.length ?? 0) > 0,
    });
  });
  console.log('PLAYER_MODEL', playerCheck);

  // گاز با کیبورد (HoldButton با pointerId جعلی setPointerCapture می‌بَرد)
  await page.keyboard.down('w');
  await page.waitForTimeout(3000);
  const spinCheck = await page.evaluate(() => {
    const pm = window.__funnycar.renderer3d.playerModel;
    return JSON.stringify({
      speed: +window.__funnycar.vehicle.speed.toFixed(1),
      wheelAngle: +(pm?.extWheels?.[0]?.angle?.toFixed(2) ?? 0),
    });
  });
  console.log('SPIN', spinCheck);
  await page.keyboard.up('w');
  await page.screenshot({ timeout: 60000, path: '/home/z/my-project/scripts/v0245_challenger_player.png' });

  await browser.close();
  console.log('E2E_DONE');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
