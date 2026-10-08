const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const logs = [];
  p.on('console', m => logs.push('[' + m.type() + '] ' + m.text().slice(0, 120)));
  p.on('pageerror', e => logs.push('[pageerror] ' + String(e).slice(0, 200)));
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(5000);
  const r = await p.evaluate(() => ({
    styleSheets: document.styleSheets.length,
    bodyText: (document.body.innerText || '').slice(0, 60),
    bodyChildren: document.body.children.length,
    rootVar: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '(空)',
    title: document.title,
  }));
  console.log('DOM 状态: ' + JSON.stringify(r));
  console.log('console/pageerror 日志：');
  logs.slice(0, 15).forEach(l => console.log('  ' + l));
  await b.close();
})();
