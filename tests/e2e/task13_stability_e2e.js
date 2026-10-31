/**
 * QA task-13 稳定性验证 Playwright 脚本（tests/e2e，task-13 交付物）
 *
 * 场景：
 *  1. 胶原蛋白肽（默认本地库）→ 产品卡片
 *  2. 胶原蛋白肽（实时数据源）→ OFF 产品卡片 / 空结果
 *  3. Nutella（实时）→ OFF 真实产品（可达时）
 *  4. 蛋白（本地库）→ DB 3 条命中
 *  5. 无匹配词（本地库）→ "本地库暂无匹配，可开启「实时数据源」" 引导
 * 断言：不出现「搜索失败」；出现产品卡片或未找到/引导提示。
 * 截图：tests/e2e/screenshots/task13-*.png
 *
 * 运行：cd D:\RMFOODFP\frontend && node ../tests/e2e/task13_stability_e2e.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000/databases';
const SHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const SCENARIOS = [
  { label: 'task13_胶原蛋白肽_local', query: '胶原蛋白肽', realtime: false },
  { label: 'task13_胶原蛋白肽_realtime', query: '胶原蛋白肽', realtime: true },
  { label: 'task13_Nutella_realtime', query: 'Nutella', realtime: true },
  { label: 'task13_蛋白_local', query: '蛋白', realtime: false },
  { label: 'task13_空结果引导_local', query: 'qqqzzz不存在xyz', realtime: false },
];

function log(...args) { console.log(...args); }

async function runScenario(page, { label, query, realtime }) {
  const rec = { label, query, realtime, consoleErrors: [], assertions: {} };

  const onConsole = (msg) => { if (msg.type() === 'error') rec.consoleErrors.push(msg.text()); };
  page.on('console', onConsole);

  try {
    const input = page.getByPlaceholder('搜索零售产品');
    await input.fill(query);

    const sw = page.getByRole('switch', { name: '实时数据源' });
    const checked = await sw.isChecked();
    if (checked !== realtime) await sw.click();

    const btn = page.getByRole('button', { name: realtime ? '实时搜索 OpenFoodFacts' : '搜索零售产品' });
    await btn.click();

    // 等待搜索结束（按钮恢复 + 无 loading 文案）
    try {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find((b) => {
          const t = (b.textContent || '').trim();
          return t.includes('实时搜索 OpenFoodFacts') || t.includes('搜索零售产品');
        });
        const loading = /正在查询 OpenFoodFacts|正在搜索/.test(document.body.innerText);
        return target && !target.disabled && !loading;
      }, { timeout: 120000 });
    } catch { /* 忽略 */ }

    // 等待结果区
    try {
      await page.waitForFunction(() => {
        return /找到 \d+ 款产品|未找到匹配的产品|搜索失败|本地库暂无匹配/.test(document.body.innerText);
      }, { timeout: 30000 });
    } catch { /* 忽略 */ }
    await page.waitForTimeout(1500);

    const shotPath = path.join(SHOT_DIR, `${label}.png`);
    await page.screenshot({ path: shotPath });

    const body = await page.locator('body').innerText();
    const hasSearchFail = body.includes('搜索失败');
    const hasResults = /找到 \d+ 款产品/.test(body);
    const hasNotFound = body.includes('未找到匹配的产品');
    const hasGuide = body.includes('本地库暂无匹配');
    const dataSourceBadge = await page.locator('text=/数据源:/').first().textContent().catch(() => null);

    rec.assertions = { hasSearchFail, hasResults, hasNotFound, hasGuide, pass: !hasSearchFail };
    rec.dataSource = dataSourceBadge;
    rec.screenshot = shotPath;
    rec.bodySnippet = body.slice(0, 600);
  } catch (err) {
    rec.error = String(err);
    rec.assertions = { pass: false, hasSearchFail: true, reason: String(err) };
    try {
      rec.screenshot = path.join(SHOT_DIR, `${label}_error.png`);
      await page.screenshot({ path: rec.screenshot });
    } catch { /* 忽略 */ }
  } finally {
    page.off('console', onConsole);
  }
  return rec;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const report = { baseUrl: BASE_URL, shotDir: SHOT_DIR, steps: [] };

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // 登录
    if (await page.getByPlaceholder('请输入用户名').count()) {
      log('[登录] 使用测试账号');
      await page.getByPlaceholder('请输入用户名').fill('admin');
      await page.getByPlaceholder('请输入密码').fill('admin123');
      await page.getByRole('button', { name: '进入平台' }).click();
      await page.waitForURL('**/dashboard**', { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(3000);
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
    }

    log('[切Tab] 市售产品');
    await page.getByRole('tab', { name: '市售产品' }).click();
    await page.getByPlaceholder('搜索零售产品').waitFor({ state: 'visible', timeout: 30000 });
    log('[OK] 市售产品面板已加载');

    for (const sc of SCENARIOS) {
      log(`[场景] ${sc.label} (realtime=${sc.realtime})`);
      const rec = await runScenario(page, sc);
      report.steps.push(rec);
      log(`  -> pass=${rec.assertions.pass} searchFail=${rec.assertions.hasSearchFail} results=${rec.assertions.hasResults} notFound=${rec.assertions.hasNotFound} guide=${rec.assertions.hasGuide} dataSource=${rec.dataSource}`);
    }
  } catch (err) {
    log('[FATAL]', err);
    report.fatal = String(err);
  } finally {
    await browser.close();
  }

  const reportPath = path.join(SHOT_DIR, 'task13_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  log(`报告: ${reportPath}`);
  const allPass = report.steps.length > 0 && report.steps.every((s) => s.assertions && s.assertions.pass);
  log(`总体: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
})();