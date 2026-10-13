// 复核 v2：先验证认证与真实内容加载，再谈任何对比度结论
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const codes = [];
  page.on('response', r => {
    if (r.status() >= 400) codes.push(`${r.status()} ${r.url().replace('http://localhost:3000', '')}`);
  });
  page.on('pageerror', e => codes.push('[pageerror] ' + String(e).slice(0, 120)));

  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // 登录：重试直到成功
  let ok = false;
  for (let i = 1; i <= 3; i++) {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"], button:has-text("进入平台")');
    await page.waitForTimeout(3500);
    const url = page.url();
    if (!/\/login/.test(url)) { ok = true; console.log(`  登录成功（第 ${i} 次），跳转 ${url.replace('http://localhost:3000', '')}`); break; }
    console.log(`  第 ${i} 次登录未跳转，仍在 ${url.replace('http://localhost:3000', '')}`);
  }

  const auth = await page.evaluate(() => {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (/token|auth|user/i.test(k)) ls[k] = (localStorage.getItem(k) || '').slice(0, 40) + '…';
    }
    return ls;
  });
  console.log('\n── localStorage 认证态 ──');
  console.log(auth.length ? JSON.stringify(auth, null, 2) : '  ⚠️  无任何 token/auth/user 键 → 认证未生效');

  await page.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  console.log('\n══ ① 数据库页真实内容加载校验 ══');
  const diag = await page.evaluate(() => {
    const txt = document.body.innerText || '';
    return {
      elCount: document.querySelectorAll('body *').length,
      tabCount: document.querySelectorAll('[role="tab"]').length,
      tabLabels: [...document.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim()).slice(0, 12),
      hasSkeleton: /加载|载入|Loading|loading/i.test(txt),
      hasEmpty: /暂无数据|暂无|无数据|No data/i.test(txt),
      hasError: /加载失败|请求失败|无法连接|出错|Error/i.test(txt),
      textLen: txt.length,
      head: txt.slice(0, 180).replace(/\s+/g, ' '),
    };
  });
  console.log(`  元素数 ${diag.elCount} | 文本长度 ${diag.textLen} | role=tab ${diag.tabCount} 个`);
  console.log(`  加载态=${diag.hasSkeleton} 空态=${diag.hasEmpty} 错误态=${diag.hasError}`);
  console.log(`  Tab 标签: ${JSON.stringify(diag.tabLabels)}`);
  console.log(`  页面文本开头: "${diag.head}"`);

  console.log('\n══ ② Tab 切换是否真的生效 ══');
  const switchProbe = [];
  const labels = diag.tabLabels.slice(0, 6);
  for (const lb of labels) {
    const el = page.locator('[role="tab"]', { hasText: lb }).first();
    if (await el.count() === 0) { switchProbe.push([lb, 'NO_ELEMENT']); continue; }
    await el.click();
    await page.waitForTimeout(2600);
    const s = await page.evaluate(() => ({
      n: document.querySelectorAll('body *').length,
      h: (document.querySelector('main, [class*="tab-content"], [role="tabpanel"]')?.textContent || '').trim().slice(0, 50).replace(/\s+/g, ' '),
    }));
    switchProbe.push([lb, s.n, s.h]);
  }
  for (const r of switchProbe) console.log(`  ${(r[0] || '').padEnd(10)} ${typeof r[1] === 'number' ? '元素' + r[1] : r[1]}  "${(r[2] || '').slice(0, 46)}"`);

  console.log('\n══ ③ 关键缺陷面是否真实渲染 ══');
  const surfaces = await page.evaluate(() => ({
    warningGradient: document.querySelectorAll('[class*="from-warning"]').length,
    primaryContainer: document.querySelectorAll('[class*="primary-container"]').length,
    aaGrid: document.querySelectorAll('[class*="w-6"][class*="h-7"]').length,
    statGradientCards: document.querySelectorAll('[class*="from-\\[var"]').length,
    chartCanvas: document.querySelectorAll('canvas').length,
    svgCount: document.querySelectorAll('svg').length,
    tableCount: document.querySelectorAll('table').length,
  }));
  for (const [k, v] of Object.entries(surfaces)) console.log(`  ${k.padEnd(22)} ${v}`);

  console.log('\n══ ④ 本次会话全部错误响应 ══');
  for (const c of [...new Set(codes)].slice(0, 12)) console.log(`  ${c}`);

  await page.screenshot({ path: 'scripts/theme-audit/recheck-state.png' });
  await browser.close();
})();
