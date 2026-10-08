const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(2000);
  const r = await p.evaluate(() => {
    // 检查 link[rel=stylesheet] 是否被 Vite 注入（dev 模式可能是 <link> 而非 inline）
    const links = [...document.querySelectorAll('link[rel=stylesheet]')].map(l => l.href);
    const styleTags = document.querySelectorAll('style').length;
    const root = getComputedStyle(document.documentElement);
    const d = document.createElement('div');
    d.className = 'badge-draft'; d.style.cssText = 'position:fixed;left:-9999px';
    document.body.appendChild(d);
    // 看 body 背景
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    return {
      linkStylesheets: links,
      styleTagCount: styleTags,
      sheetCount: document.styleSheets.length,
      sheetsInfo: [...document.styleSheets].map(s => s.href ? s.href.split('/').pop() : '(inline)').slice(0, 5),
      badgeToken: root.getPropertyValue('--badge-draft-text').trim() || '(空)',
      textSecondary: root.getPropertyValue('--text-secondary').trim() || '(空)',
      badgeColor: getComputedStyle(d).color,
      bodyBg,
      badgeRule: (() => { for (const s of document.styleSheets) { try { for (const r of s.cssRules) { if (r.selectorText && r.selectorText.includes('badge-draft')) return r.selectorText + ' { ' + r.style.color + ' }'; } } catch {} } return '(未找到)'; })(),
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
