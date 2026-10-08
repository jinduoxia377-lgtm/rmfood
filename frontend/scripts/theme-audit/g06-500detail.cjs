const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.on('response', async (r) => {
    if (r.status() >= 400 && r.url().includes('LoginPage')) {
      const body = await r.text();
      console.log('=== HTTP ' + r.status() + ' ' + r.url().split('/').pop() + ' ===');
      console.log(body.slice(0, 600));
    }
  });
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(4000);
  // 直接 GET 该 CSS
  const resp = await p.evaluate(async () => {
    const r = await fetch('/src/pages/auth/LoginPage.css');
    const text = await r.text();
    return { status: r.status, head: text.slice(0, 400) };
  });
  console.log('\nGET /src/pages/auth/LoginPage.css → ' + resp.status);
  console.log(resp.head);
  await b.close();
})();
