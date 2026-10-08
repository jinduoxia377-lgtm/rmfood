const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.on('response', async (r) => {
    if (r.url().includes('LoginPage.css') && r.status() === 500) {
      try {
        const body = await r.text();
        console.log('=== 500 响应体 ===');
        console.log(body.slice(0, 1500));
      } catch (e) {}
    }
  });
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(4000);
  await b.close();
})();
