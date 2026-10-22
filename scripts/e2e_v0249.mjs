// e2e_v0249.mjs — تست E2E پنج صدای نو v0.2.49
// رادیو ۲ ایستگاه + باران (صدا/تصویر) + پرنده صبحگاهی + راچت تعمیر + دم‌گذار مسافر
import { chromium } from 'puppeteer';

const BASE = 'http://localhost:8899/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, name, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) fails++;
};

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--window-size=390,844'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 180)); });
page.on('pageerror', (e) => errs.push('PAGE: ' + String(e).slice(0, 180)));

await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 });
await sleep(4000);

async function tapByText(txt) {
  return page.evaluate((t) => {
    const els = [...document.querySelectorAll('button, [role=button], div')];
    const el = els.find((e) => (e.textContent || '').trim().startsWith(t) && e.offsetParent !== null);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const ev = (type) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }));
    ev('pointerdown'); ev('pointerup');
    if (el.tagName === 'BUTTON') el.click();
    return true;
  }, txt);
}

// ---------- شروع بازی ----------
ok(await tapByText('شروع'), 'منو: دکمه شروع');
await sleep(3000);

const st = await page.evaluate(() => {
  const fc = window.__funnycar;
  if (!fc) return null;
  return {
    state: fc.getState(),
    amb: fc.audio.ambienceActive,
    radio: fc.audio.radioPlaying,
    station: fc.audio.radioStationId,
    rainActive: fc.audio.rainActive,
    weather: fc.weather,
  };
});
ok(!!st, 'بوت: __funnycar در دسترس');
ok(st?.state === 'playing', 'وضعیت playing', st?.state);
ok(st?.amb === true, 'آمبرینس پرنده/شهر روشن', String(st?.amb));
ok(st?.radio === true, 'رادیو پیش‌فرض روشن', String(st?.radio));
ok(st?.station === 1, 'ایستگاه پیش‌فرض ۱', String(st?.station));

// ---------- رادیو: تعویض ایستگاه + ذخیره ----------
await page.evaluate(() => { window.__funnycar.setRadioStation(2); });
await sleep(700);
const st2 = await page.evaluate(() => ({
  station: window.__funnycar.audio.radioStationId,
  radio: window.__funnycar.audio.radioPlaying,
  saved: JSON.parse(window.localStorage.getItem('funnycar_save') || localStorage.getItem('fc_save') || 'null')?.settings?.radioStation ?? 'n/a',
}));
ok(st2.station === 2, 'تعویض به ایستگاه ۲', String(st2.station));
ok(st2.radio === true, 'رادیو بعد از تعویض پخش می‌شود', String(st2.radio));
ok(st2.saved === 2 || st2.saved === 'n/a', 'ایستگاه در سیو ذخیره شد', String(st2.saved));

// fallback سیو: مستقیم از منبع سیو بخوان
const savedRaw = await page.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.settings && 'radioStation' in v.settings) return v.settings.radioStation; } catch {}
  }
  return 'missing';
});
ok(savedRaw === 2, 'سیو: radioStation=2', String(savedRaw));

// ---------- باران: اجبار + صدا + جمله ----------
await page.evaluate(() => { window.__funnycar.forceWeather('rain'); });
await sleep(1000);
const rainInfo1 = await page.evaluate(() => {
  const fc = window.__funnycar;
  return { weather: fc.weather, rainActive: fc.audio.rainActive, line: fc.voice.current?.key ?? null };
});
ok(rainInfo1.weather === 'rain', 'هوا: باران شد', rainInfo1.weather);
ok(rainInfo1.rainActive === true, 'حلقهٔ صدای باران روشن', String(rainInfo1.rainActive));
ok(rainInfo1.line === 'rain_start', 'جملهٔ طنز شروع باران', rainInfo1.line ?? '(none)');
await sleep(3200);
await page.screenshot({ path: 'scripts/v0249_rain.png' });
const rainInfo2 = await page.evaluate(() => {
  const fc = window.__funnycar;
  const r3 = fc.renderer3d;
  return { rainVis: r3 ? !!(r3.rainMesh && r3.rainMesh.visible) : false, factor: r3 ? r3.rainFactor : -1 };
});
ok(rainInfo2.rainVis === true, 'رگه‌های سه‌بعدی باران نمایان', JSON.stringify(rainInfo2));

// ---------- پایان باران ----------
await page.evaluate(() => { window.__funnycar.forceWeather('clear'); });
await sleep(600);
const clearInfo = await page.evaluate(() => ({
  weather: window.__funnycar.weather,
  line: window.__funnycar.voice.current?.key ?? null,
}));
ok(clearInfo.weather === 'clear', 'هوا: صاف شد', clearInfo.weather);
ok(clearInfo.line === 'rain_stop', 'جملهٔ پایان باران', clearInfo.line ?? '(none)');
await sleep(2600);
const rainOff = await page.evaluate(() => window.__funnycar.audio.rainActive);
ok(rainOff === false, 'صدای باران با فید قطع شد', String(rainOff));

// ---------- راچت در زون تعمیر: انتقال ماشین به زون ----------
const rep = await page.evaluate(() => {
  const fc = window.__funnycar;
  const z = fc.world.repairZones.find((z) => z.kind === 'repair');
  if (!z) return { found: false };
  fc.vehicle.x = z.x;
  fc.vehicle.y = z.y;
  fc.vehicle.speed = 0;
  fc.vehicle.health = 40;
  return { found: true, x: z.x, y: z.y };
});
ok(rep.found, 'زون تعمیر پیدا شد');
await sleep(2500);
const repState = await page.evaluate(() => {
  const fc = window.__funnycar;
  return {
    health: Math.round(fc.vehicle.health),
    ratchetAt: fc.lastRatchetSfxAt,
    repairAt: fc.lastRepairSfxAt,
    zone: fc.zoneActive,
  };
});
ok(repState.zone === 'repair', 'زون تعمیر فعال', String(repState.zone));
ok(repState.health > 40, 'ترمیم جریان دارد', String(repState.health));
ok(repState.ratchetAt > 0 && repState.repairAt > 0, 'راچت + آچارباد پخش شد', JSON.stringify({ r: repState.ratchetAt, a: repState.repairAt }));

// ---------- دم‌گذار مسافر: صدا + جمله ----------
const drop = await page.evaluate(() => {
  const fc = window.__funnycar;
  fc.audio.dropoffDoor();
  const info = fc.voice.trigger('taxi_dropoff', performance.now());
  return { line: info?.line ?? null, speaker: info?.speaker ?? null };
});
ok(!!drop.line, 'جملهٔ دم‌گذار مسافر تریگر شد', drop.line ?? '(none)');
ok(drop.speaker === 'passenger', 'گوینده: مسافر', drop.speaker ?? '(none)');

// ---------- fallback سیفت: منو → تنظیمات رادیو (سیو persist بعد رفرش) ----------
await page.reload({ waitUntil: 'networkidle2' });
await sleep(3500);
const persisted = await page.evaluate(() => {
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    try { const v = JSON.parse(localStorage.getItem(k)); if (v && v.settings && 'radioStation' in v.settings) return { st: v.settings.radioStation, radio: v.settings.radio }; } catch {}
  }
  return null;
});
ok(persisted?.st === 2, 'بعد از رفرش: ایستگاه ۲ ماند', JSON.stringify(persisted));

// بازگشت به ایستگاه ۱ (برای رفتار پیش‌فرض کاربران واقعی بی‌اثر است؛ سیو مرورگر تست است)
await page.evaluate(() => { window.__funnycar.setRadioStation(1); });
await sleep(400);
const backTo1 = await page.evaluate(() => window.__funnycar.audio.radioStationId);
ok(backTo1 === 1, 'برگشت به ایستگاه ۱', String(backTo1));

const realErrs = errs.filter((e) => !e.includes('favicon') && !e.includes('WebSocket') && !e.includes('DevTools'));
ok(realErrs.length === 0, 'کنسول بدون خطا', realErrs.slice(0, 3).join(' | '));

await page.screenshot({ path: 'scripts/v0249_final.png' });
await browser.close();
console.log(fails === 0 ? 'E2E v0.2.49 ALL PASS' : `E2E v0.2.49 FAILURES: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
