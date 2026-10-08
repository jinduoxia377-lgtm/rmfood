const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  p.on('response', async r => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url().split('/').slice(-2).join('/')); });
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(3000);
  const state = await p.evaluate(() => {
    const d = document.createElement('div');
    d.className = 'badge-draft'; d.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(d);
    return {
      styleSheets: document.styleSheets.length,
      hasRootVar: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') !== '',
      bodyClasses: document.body.className,
      htmlClasses: document.documentElement.className,
      badgeDraftColor: getComputedStyle(d).color,
      badgeDraftToken: getComputedStyle(document.documentElement).getPropertyValue('--badge-draft-text').trim() || '(空)',
      appMounted: document.querySelector('body > #root') ? 'yes' : 'no',
      rootChildren: document.querySelector('body > #root') ? document.querySelector('body > #root').children.length : 0,
    };
  });
  console.log('HTTP 异常: ' + (errors.length ? errors.join(', ') : '(无)'));
  console.log('DOM 状态: ' + JSON.stringify(state, null, 2));
  await b.close();
})();
