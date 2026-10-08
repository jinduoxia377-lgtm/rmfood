const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1680, height: 1050 }, locale: 'zh-CN', colorScheme: 'light' })).newPage();
  const logs = [];
  p.on('console', m => logs.push('[' + m.type() + '] ' + m.text().slice(0, 200)));
  p.on('pageerror', e => logs.push('[pageerror] ' + String(e.message || e).slice(0, 300)));
  const reqs = [];
  p.on('response', r => { if (r.status() >= 400) reqs.push(r.status() + ' ' + r.url().split('/').slice(-2).join('/')); });
  await p.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle', timeout: 90000 });
  await p.waitForTimeout(12000);
  const state = await p.evaluate(() => ({
    url: location.pathname,
    rootChildren: document.querySelector('#root') ? document.querySelector('#root').children.length : -1,
    bodyText: (document.body.innerText || '').slice(0, 100),
    styleSheets: document.styleSheets.length,
  }));
  console.log('终态 URL: ' + state.url);
  console.log('rootChildren: ' + state.rootChildren + ' | styleSheets: ' + state.styleSheets);
  console.log('body 文本: ' + state.bodyText);
  console.log('\nHTTP 异常: ' + (reqs.length ? reqs.join(' | ') : '(无)'));
  console.log('\n控制台/pageerror:');
  logs.slice(0, 25).forEach(l => console.log('  ' + l));
  await b.close();
})();
