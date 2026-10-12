// 聚焦验证三件事：① mode 持久化 ② --text-muted 实际计算色 ③ 未注入主色阶档位
const { chromium } = require('@playwright/test');
const GROUP = (l) => `[role="radiogroup"][aria-label="${l}"] [role="radio"]`;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.fill('input[type="text"]', 'admin');
  await p.fill('input[type="password"]', 'admin123');
  await p.click('button[type="submit"], button:has-text("进入平台")');
  await p.waitForTimeout(3000);
  await p.goto('http://localhost:3000/settings?tab=theme', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);

  const R = {};
  R.modeBefore = await p.evaluate(() => ({
    html: document.documentElement.classList.contains('dark'),
    lsMode: (JSON.parse(localStorage.getItem('rmfood-theme-storage') || '{}').state || {}).mode,
  }));

  await p.locator(GROUP('明暗模式')).nth(1).click();
  await p.waitForTimeout(800);
  R.afterClick = await p.evaluate(() => ({
    html: document.documentElement.classList.contains('dark'),
    lsMode: (JSON.parse(localStorage.getItem('rmfood-theme-storage') || '{}').state || {}).mode,
  }));

  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  R.afterReload = await p.evaluate(() => ({
    html: document.documentElement.classList.contains('dark'),
    lsMode: (JSON.parse(localStorage.getItem('rmfood-theme-storage') || '{}').state || {}).mode,
    primary500: getComputedStyle(document.documentElement).getPropertyValue('--color-primary-500').trim(),
  }));

  // 切到深色态，测量面板内文字对比度真实值
  await p.locator(GROUP('明暗模式')).nth(1).click();
  await p.waitForTimeout(900);
  R.tokensDark = await p.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return ['--text-muted','--text-secondary','--color-neutral-700','--color-neutral-400','--color-neutral-300']
      .reduce((a,t)=>(a[t]=s.getPropertyValue(t).trim(),a),{});
  });
  R.mutedSample = await p.evaluate(() => {
    const spans = [...document.querySelectorAll('span,p')]
      .filter(e => (e.className||'').toString().includes('var(--text-muted)'));
    return spans.slice(0,4).map(s => ({
      text: (s.innerText||'').slice(0,20),
      color: getComputedStyle(s).color,
    }));
  });

  await b.close();
  console.log(JSON.stringify(R, null, 2));
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
