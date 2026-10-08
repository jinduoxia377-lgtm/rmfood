const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(3500);
  const r = await p.evaluate(() => ({
    url: location.href,
    bodyChildren: document.body.children.length,
    bodyText: (document.body.innerText || '').slice(0, 80),
    styleTags: document.querySelectorAll('style').length,
    links: document.querySelectorAll('link').length,
    hasRootVar: !!getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
  }));
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
