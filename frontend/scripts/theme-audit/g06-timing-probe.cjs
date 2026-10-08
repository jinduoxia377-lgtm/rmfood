const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'load', timeout: 60000 });
  // 关键：等待所有样式表真正加载
  await p.waitForTimeout(500);
  const stylesLoaded = await p.evaluate(() => document.styleSheets.length);
  console.log('document.styleSheets 数量: ' + stylesLoaded);

  // 等 3 个不同时长，看 :root 令牌何时出现
  for (const wait of [1000, 3000, 6000]) {
    await p.waitForTimeout(wait);
    const r = await p.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const d = document.createElement('div');
      d.className = 'badge-draft'; d.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(d);
      return {
        sheetCount: document.styleSheets.length,
        badgeToken: root.getPropertyValue('--badge-draft-text').trim() || '(空)',
        badgeColor: getComputedStyle(d).color,
        bodyHasBadgeRule: [...document.styleSheets].some(s => {
          try { return [...s.cssRules].some(r => r.selectorText && r.selectorText.includes('badge-draft')); } catch { return false; }
        }),
      };
    });
    console.log('wait+' + wait + 'ms → ' + JSON.stringify(r));
  }
  await b.close();
})();
