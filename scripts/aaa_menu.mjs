// aaa_menu.mjs — نمای منو/گاراژ: براق بودن رنگ خودرو در پیش‌نمایش
import { chromium } from 'playwright';
const BASE = 'http://localhost:8899/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });
await sleep(7000);
await page.screenshot({ path: '/tmp/aaa_menu.png' });
await browser.close();
console.log('done');
