const { chromium } = require('@playwright/test');

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const logs = [];
  p.on('console', m => { if (m.type() === 'error') logs.push('[' + m.type() + '] ' + m.text().slice(0, 150)); });
  p.on('pageerror', e => logs.push('[pageerror] ' + String(e.message || e).slice(0, 200)));

  await p.goto('http://127.0.0.1:3000/ai', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(6000);

  // 页面结构诊断
  const diag = await p.evaluate(() => {
    const out = {};
    // 1. 各 tab 内容区实际渲染状态（默认 chat tab）
    const main = document.querySelector('main');
    out.mainFound = !!main;
    // 2. 搜索框是否可见
    const search = document.querySelector('input[type="search"]');
    out.searchVisible = search ? search.getBoundingClientRect().height > 0 : false;
    // 3. stat card 数值
    out.statValues = [...document.querySelectorAll('section[aria-label="功能模块统计"] .text-2xl, section[aria-label="功能模块统计"] [class*="text-3xl"]')].map(e => e.textContent.trim()).slice(0, 8);
    // 4. 当前激活 tab 面板
    out.activeTabPanel = document.querySelector('[role="tabpanel"]') ? 'tabpanel' : '(无 role=tabpanel，条件渲染)';
    // 5. 长内容区
    out.pageHeight = document.documentElement.scrollHeight;
    // 6. 重复的 accentColors 定义处数（代码级已确认 2 处）
    // 7. h-180 硬编码高度
    const agentWrap = document.querySelector('[class*="h-[calc(100vh-12rem)]"]');
    out.agentTabFixedHeight = !!agentWrap;
    return out;
  });
  console.log('页面结构诊断:');
  Object.entries(diag).forEach(([k, v]) => console.log('  ' + k + ': ' + JSON.stringify(v)));

  // 检查所有 tab 切换是否都有 panel（role=tabpanel 缺失 = 条件渲染但 tab 无 panel 容器）
  console.log('\n控制台错误（过滤 401/网络）:');
  const real = logs.filter(l => !l.includes('401') && !l.includes('auth/me') && !l.includes('ECONNREFUSED'));
  if (real.length === 0) console.log('  (无)');
  real.slice(0, 10).forEach(l => console.log('  ' + l));

  await b.close();
})();
