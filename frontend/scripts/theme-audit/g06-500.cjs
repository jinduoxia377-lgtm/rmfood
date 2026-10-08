const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const resp = [];
  p.on('requestfailed', r => resp.push('FAIL ' + r.url() + ' :: ' + (r.failure()?.errorText || '')));
  p.on('response', r => { if (r.status() >= 400) resp.push(r.status() + ' ' + r.url().split('/').slice(-2).join('/')); });
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(4000);
  const body = await p.evaluate(() => (document.body.innerText || '').slice(0, 400));
  console.log('HTTP 异常响应：');
  resp.slice(0, 15).forEach(x => console.log('  ' + x));
  console.log('\n页面正文片段：\n' + body);
  await b.close();
})();
