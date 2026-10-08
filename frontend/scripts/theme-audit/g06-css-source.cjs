const { chromium } = require('@playwright/test');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(3500);
  const r = await p.evaluate(() => {
    const a = document.querySelector('a');
    return {
      bodyBg: a ? getComputedStyle(a).backgroundColor : '(无 a)',
      bodyClasses: document.body.className,
      // 检查是否有 <link> 标签及其样式表
      linkTags: [...document.querySelectorAll('link')].map(l => ({ rel: l.rel, href: (l.href || l.getAttribute('href') || '').split('/').pop() })),
      // 通过 document.styleSheets
      styleSheets: document.styleSheets.length,
      styleSheetInfo: [...document.styleSheets].map(s => s.href || '(inline)').slice(0, 8),
      // 直接取 <html> 的 className 与 inline style
      htmlClass: document.documentElement.className,
      htmlStyle: document.documentElement.getAttribute('style'),
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
