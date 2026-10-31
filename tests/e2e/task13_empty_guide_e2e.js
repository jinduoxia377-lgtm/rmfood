/**
 * QA task-13 补充：捕获"本地库暂无匹配"引导场景（dataSource=postgresql_ilike_empty）。
 * 当 OFF 返回 503 且 DB 无命中时，前端应显示引导。
 * 运行：cd D:\RMFOODFP\frontend && node ../tests/e2e/task13_empty_guide_e2e.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const QUERY = 'qqqzzz不存在xyz';
const MAX_ATTEMPTS = 8;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();

  try {
    await page.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    if (await page.getByPlaceholder('请输入用户名').count()) {
      await page.getByPlaceholder('请输入用户名').fill('admin');
      await page.getByPlaceholder('请输入密码').fill('admin123');
      await page.getByRole('button', { name: '进入平台' }).click();
      await page.waitForURL('**/dashboard**', { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(3000);
      await page.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
    }
    await page.getByRole('tab', { name: '市售产品' }).click();
    await page.getByPlaceholder('搜索零售产品').waitFor({ state: 'visible', timeout: 30000 });

    const input = page.getByPlaceholder('搜索零售产品');
    const sw = page.getByRole('switch', { name: '实时数据源' });
    if (await sw.isChecked()) await sw.click(); // 确保 realtime=false

    let captured = false;
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      await input.fill(QUERY);
      await page.getByRole('button', { name: '搜索零售产品' }).click();
      try {
        await page.waitForFunction(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find((b) => (b.textContent || '').trim().includes('搜索零售产品'));
          return target && !target.disabled && !/正在查询 OpenFoodFacts|正在搜索/.test(document.body.innerText);
        }, { timeout: 120000 });
      } catch { /* 忽略 */ }
      try {
        await page.waitForFunction(() => {
          return /找到 \d+ 款产品|未找到匹配的产品|本地库暂无匹配|搜索失败/.test(document.body.innerText);
        }, { timeout: 30000 });
      } catch { /* 忽略 */ }
      await page.waitForTimeout(1000);

      const body = await page.locator('body').innerText();
      const dataSource = await page.locator('text=/数据源:/').first().textContent().catch(() => null);
      console.log(`attempt ${i}: guide=${body.includes('本地库暂无匹配')} notFound=${body.includes('未找到匹配的产品')} dataSource=${dataSource}`);
      if (body.includes('本地库暂无匹配')) {
        const shot = path.join(SHOT_DIR, `task13_空结果引导_local.png`);
        await page.screenshot({ path: shot });
        console.log('captured:', shot);
        captured = true;
        break;
      }
      if (body.includes('搜索失败')) {
        console.log('unexpected 搜索失败');
        break;
      }
    }
    if (!captured) {
      const shot = path.join(SHOT_DIR, `task13_空结果引导_local_last.png`);
      await page.screenshot({ path: shot });
      console.log('guide not captured in', MAX_ATTEMPTS, 'attempts; last screenshot:', shot);
    }
  } finally {
    await browser.close();
  }
})();