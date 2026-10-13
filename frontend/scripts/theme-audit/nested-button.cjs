const { chromium } = require('@playwright/test');

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const warns = [];
  p.on('console', m => {
    const t = m.text();
    if (/cannot be a descendant|cannot contain|hydration/i.test(t)) warns.push(t.slice(0, 140));
  });
  await p.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);
  await p.fill('input[type=text]', 'admin');
  await p.fill('input[type=password]', 'admin123');
  await p.click('button[type=submit]');
  await p.waitForTimeout(3500);
  await p.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded' });
  for (let w = 0; w < 15; w++) {
    await p.waitForTimeout(1000);
    if ((await p.locator('[role=tab]').count()) >= 8) break;
  }

  const TABS = ['实时概览', '中药材', '活性肽', '知识图谱', '药食同源', '食品原料', '零售产品', '搜索分析', '数据管理'];
  for (const t of TABS) {
    const el = p.locator('[role=tab]', { hasText: t }).first();
    if (await el.count() === 0) continue;
    await el.click();
    await p.waitForTimeout(2200);
    const out = await p.evaluate(() => {
      // 交互式元素 = 原生 button/a + role=button（含 div/span 伪装）
      const isInteractive = e => e.tagName === 'BUTTON' || e.tagName === 'A'
        || e.getAttribute('role') === 'button';
      const res = [];
      for (const el of document.querySelectorAll('*')) {
        if (!isInteractive(el)) continue;
        const inner = [...el.querySelectorAll('*')].filter(isInteractive);
        if (!inner.length) continue;
        const chain = [];
        let e = el;
        for (let i = 0; i < 6 && e; i++) {
          const cls = e.className && typeof e.className === 'string'
            ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.')
            : '';
          const role = e.getAttribute && e.getAttribute('role');
          chain.push('<' + e.tagName.toLowerCase() + cls + (role ? '[role=' + role + ']' : '') + '>');
          e = e.parentElement;
        }
        res.push({
          kind: el.tagName === 'BUTTON' ? 'native' : 'role',
          text: (el.textContent || '').trim().slice(0, 36),
          chain: chain.join(' > '),
          inner: inner.length,
          innerText: inner.slice(0, 3).map(x => (x.textContent || '').trim().slice(0, 14)),
          html: el.outerHTML.replace(/\s+/g, ' ').slice(0, 320),
        });
      }
      return res;
    });
    const inDialog = out.filter(o => /role=dialog/.test(o.chain));
    const inPage = out.filter(o => !/role=dialog/.test(o.chain));
    if (inDialog.length) console.log('\n【' + t + '】全局设置弹窗内（非本页面）' + inDialog.length + ' 处，已排除');
    if (!inPage.length) continue;
    console.log('\n【' + t + '】页面内嵌套 ' + inPage.length + ' 处');
    for (const o of inPage) {
      console.log('  [' + o.kind + '] 外层: ' + JSON.stringify(o.text) + '  内层 ' + o.inner + ' 个 ' + JSON.stringify(o.innerText));
      console.log('  祖先链: ' + o.chain);
      console.log('  HTML: ' + o.html);
    }
  }
  console.log('\n【React 控制台警告】');
  console.log(warns.length ? [...new Set(warns)].join('\n') : '  (无嵌套/水合警告)');
  await b.close();
})();
