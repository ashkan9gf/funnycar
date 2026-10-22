// Playwright: render the two faces of a GLB and screenshot
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const url = process.argv[2] || '/upload/challenger/test.glb';
  const out = process.argv[3] || '/home/z/my-project/scripts/challenger_faces.png';
  const tint = process.argv[4] || '';
  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1100, height: 520 } });
  page.on('console', (m) => console.log('[page]', m.text()));
  page.on('pageerror', (e) => console.log('[err]', e.message));
  await page.goto("http://127.0.0.1:8898/scripts/model_test/index.html?url=" + encodeURIComponent(url) + (tint ? "&tint=" + encodeURIComponent(tint) : ""));
  await page.waitForFunction('window.__done === true', { timeout: 60000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out });
  const info = await page.textContent('#info');
  console.log(info);
  await browser.close();
  console.log('SAVED', out);
})().catch((e) => { console.error(e); process.exit(1); });
