const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:3000/ai', { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(8000);
  const r = await p.evaluate(() => ({
    url: location.href,
    rootChildren: document.querySelector('#root') ? document.querySelector('#root').children.length : -1,
    bodyText: (document.body.innerText || '').slice(0, 300),
    styleSheets: document.styleSheets.length,
    mainFound: !!document.querySelector('main'),
  }));
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
