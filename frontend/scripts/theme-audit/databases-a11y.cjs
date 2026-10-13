// 定位嵌套 button + 验证 PeptideDetailContent 可达性
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  for (let i = 1; i <= 3; i++) {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"], button:has-text("进入平台")');
    await page.waitForTimeout(3500);
    if (!/\/login/.test(page.url())) break;
  }
  await page.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded' });
  for (let w = 0; w < 20; w++) {
    await page.waitForTimeout(1000);
    if ((await page.locator('[role="tab"]').count()) >= 8) break;
  }

  console.log('══ ① 嵌套 <button> 定位 ══');
  const nested = await page.evaluate(() => {
    const out = [];
    for (const b of document.querySelectorAll('button')) {
      const inner = b.querySelectorAll('button');
      if (inner.length) {
        out.push({
          outerText: (b.textContent || '').trim().slice(0, 32),
          outerCls: (b.className || '').toString().slice(0, 60),
          innerCount: inner.length,
          innerTexts: [...inner].slice(0, 3).map(x => (x.textContent || '').trim().slice(0, 20)),
          outerRole: b.getAttribute('role'),
        });
      }
    }
    return out;
  });
  console.log(`  嵌套按钮 ${nested.length} 处`);
  for (const n of nested.slice(0, 6)) {
    console.log(`  外层 "${n.outerText}" role=${n.outerRole}\n    类 ${n.outerCls}\n    内层 ${n.innerCount} 个: ${JSON.stringify(n.innerTexts)}`);
  }

  console.log('\n══ ② 各 Tab 的嵌套按钮分布 ══');
  const TABS = ['实时概览', '中药材', '活性肽', '知识图谱', '药食同源', '食品原料', '零售产品', '搜索分析', '数据管理'];
  for (const lb of TABS) {
    const el = page.locator('[role="tab"]', { hasText: lb }).first();
    if (await el.count() === 0) continue;
    await el.click();
    await page.waitForTimeout(1600);
    const c = await page.evaluate(() => {
      let n = 0;
      for (const b of document.querySelectorAll('button')) if (b.querySelectorAll('button').length) n++;
      return n;
    });
    if (c) console.log(`  ${lb.padEnd(10)} ${c} 处`);
  }

  console.log('\n══ ③ PeptideDetailContent 可达性（点击活性肽条目）══');
  await page.locator('[role="tab"]', { hasText: '活性肽' }).first().click();
  await page.waitForTimeout(2200);
  const before = await page.evaluate(() => ({
    rows: document.querySelectorAll('table tbody tr, [class*="cursor-pointer"][class*="hover"]').length,
    aa: document.querySelectorAll('[class*="w-6"][class*="h-7"]').length,
  }));
  console.log(`  可点击行 ${before.rows} | 氨基酸网格 ${before.aa}`);
  const clickTarget = page.locator('table tbody tr').first();
  if (await clickTarget.count()) {
    await clickTarget.click();
    await page.waitForTimeout(2500);
    const after = await page.evaluate(() => ({
      aa: document.querySelectorAll('[class*="w-6"][class*="h-7"]').length,
      badges: [...document.querySelectorAll('span[title*="("]')].slice(0, 3).map(e => ({
        t: e.textContent, title: e.getAttribute('title'),
        bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color,
      })),
    }));
    console.log(`  点击后氨基酸网格 ${after.aa}`);
    for (const b of after.badges) {
      console.log(`    "${b.t}" title=${b.title}  bg=${b.bg}  color=${b.color}`);
    }
  } else {
    console.log('  无可点击行，尝试第一张卡片');
  }

  await browser.close();
})();
