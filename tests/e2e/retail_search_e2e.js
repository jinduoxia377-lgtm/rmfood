/**
 * QA task-9 端到端验证脚本（tests/e2e 目录，属 task-9 交付物）
 *
 * 验证「市售产品」搜索"胶原蛋白肽"：
 *  - 打开 http://localhost:3000/databases → 切到「市售产品」Tab
 *  - 输入"胶原蛋白肽"，先以默认（本地库）搜索，再开启实时数据源搜索
 *  - 断言：页面出现产品卡片/表格或"未找到"提示，不得出现"搜索失败"
 *  - 截图保存到系统 temp 目录
 *
 * 运行方式（在 frontend 目录下，使其能解析 @playwright/test）：
 *   cd D:\RMFOODFP\frontend
 *   node ../tests/e2e/retail_search_e2e.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000/databases';
const QUERY = '胶原蛋白肽';
const REGRESSION_QUERIES = ['蛋白', '维生素', 'Nutella'];
const LOGIN_USERNAME = 'admin';
const LOGIN_PASSWORD = 'admin123';

const tempDir = process.env.TEMP || '/tmp';
const shotDir = path.join(tempDir, 'rmfoodfp_qa_task9');
fs.mkdirSync(shotDir, { recursive: true });

function log(...args) {
  console.log(...args);
}

async function searchAndCapture(page, label, query, { realtime }) {
  const result = { label, query, realtime, consoleErrors: [], pageErrors: [], failedRequests: [], bodyText: '' };

  // 收集浏览器错误
  const onConsole = (msg) => { if (msg.type() === 'error') result.consoleErrors.push(msg.text()); };
  const onPageError = (err) => result.pageErrors.push(String(err));
  const onReqFailed = (req) => result.failedRequests.push(`${req.method()} ${req.url()} -> ${req.failure()?.errorText}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  page.on('requestfailed', onReqFailed);

  try {
    // 填入查询词
    const input = page.getByPlaceholder('搜索零售产品');
    await input.fill(query);

    if (realtime) {
      // 开启实时数据源开关
      const sw = page.getByRole('switch', { name: '实时数据源' });
      const checked = await sw.isChecked();
      if (!checked) await sw.click();
    } else {
      const sw = page.getByRole('switch', { name: '实时数据源' });
      const checked = await sw.isChecked();
      if (checked) await sw.click();
    }

    // 点击搜索按钮（文案随 realtime 变化）
    const btn = page.getByRole('button', { name: realtime ? '实时搜索 OpenFoodFacts' : '搜索零售产品' });
    await btn.click();

    // 等待搜索请求结束：目标按钮恢复可用 且 页面不再显示"正在查询/正在搜索"
    try {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find((b) => {
          const t = (b.textContent || '').trim();
          return t.includes('实时搜索 OpenFoodFacts') || t.includes('搜索零售产品');
        });
        const loadingText = /正在查询 OpenFoodFacts|正在搜索/.test(document.body.innerText);
        return target && !target.disabled && !loadingText;
      }, { timeout: 120000 });
    } catch { /* 忽略等待超时，继续采集页面状态 */ }

    // 等待结果区出现关键文本
    try {
      await page.waitForFunction(() => {
        return /找到 \d+ 款产品|未找到匹配的产品|搜索失败/.test(document.body.innerText);
      }, { timeout: 30000 });
    } catch { /* 忽略等待超时，继续采集页面状态 */ }

    // 额外等待渲染稳定
    await page.waitForTimeout(1500);

    // 截图
    const shotName = `${label}_${realtime ? 'realtime' : 'local'}.png`;
    const shotPath = path.join(shotDir, shotName);
    await page.screenshot({ path: shotPath, fullPage: false });
    result.screenshot = shotPath;

    // 采集页面文本
    result.bodyText = (await page.locator('body').innerText()).slice(0, 3000);

    // 关键断言
    const hasSearchFail = (await page.getByText('搜索失败', { exact: false }).count()) > 0;
    const hasNotFound = (await page.getByText('未找到匹配的产品', { exact: false }).count()) > 0;
    const hasResults = (await page.getByText(/找到 \d+ 款产品/).count()) > 0;
    const hasProductName = (await page.getByText(QUERY, { exact: false }).count()) > 0;
    result.assertions = {
      hasSearchFail,
      hasNotFound,
      hasResults,
      hasProductName,
      pass: !hasSearchFail && (hasResults || hasNotFound || hasProductName),
    };
    result.dataSourceBadge = (await page.locator('text=/数据源:/').first().textContent().catch(() => null));
  } catch (err) {
    result.error = String(err);
    result.assertions = { pass: false, hasSearchFail: true, reason: String(err) };
    try {
      const shotPath = path.join(shotDir, `${label}_${realtime ? 'realtime' : 'local'}_error.png`);
      await page.screenshot({ path: shotPath });
      result.screenshot = shotPath;
    } catch { /* 忽略 */ }
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onReqFailed);
  }
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();

  const report = { baseUrl: BASE_URL, shotDir, steps: [] };

  try {
    log(`[1] 打开 ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // 若出现登录页则登录（默认测试账号 admin/admin123）
    const loginVisible = await page.getByPlaceholder('请输入用户名').count().catch(() => 0);
    if (loginVisible > 0) {
      log('[1.1] 检测到登录页，使用测试账号登录');
      await page.getByPlaceholder('请输入用户名').fill(LOGIN_USERNAME);
      await page.getByPlaceholder('请输入密码').fill(LOGIN_PASSWORD);
      await page.getByRole('button', { name: '进入平台' }).click();
      // 等待登录完成并跳转
      await page.waitForURL('**/dashboard**', { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(3000);
      // 登录后默认跳 /dashboard，需显式回到 /databases
      log('[1.2] 登录成功，导航到 /databases');
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);
    }

    // 切换到「市售产品」Tab
    log('[2] 切换到「市售产品」Tab');
    await page.getByRole('tab', { name: '市售产品' }).click();
    await page.getByPlaceholder('搜索零售产品').waitFor({ state: 'visible', timeout: 30000 });
    log('[OK] 「市售产品」面板已加载');

    // 主用例：胶原蛋白肽（本地库模式）
    log(`[3] 搜索 "${QUERY}"（默认本地库）`);
    const localResult = await searchAndCapture(page, '胶原蛋白肽', QUERY, { realtime: false });
    report.steps.push(localResult);
    log(`  -> pass=${localResult.assertions.pass} hasSearchFail=${localResult.assertions.hasSearchFail} hasResults=${localResult.assertions.hasResults} hasNotFound=${localResult.assertions.hasNotFound}`);
    log(`  -> dataSource=${localResult.dataSourceBadge} screenshot=${localResult.screenshot}`);

    // 主用例：胶原蛋白肽（实时数据源）
    log(`[4] 搜索 "${QUERY}"（实时数据源）`);
    const realtimeResult = await searchAndCapture(page, '胶原蛋白肽', QUERY, { realtime: true });
    report.steps.push(realtimeResult);
    log(`  -> pass=${realtimeResult.assertions.pass} hasSearchFail=${realtimeResult.assertions.hasSearchFail} hasResults=${realtimeResult.assertions.hasResults} hasNotFound=${realtimeResult.assertions.hasNotFound}`);
    log(`  -> dataSource=${realtimeResult.dataSourceBadge} screenshot=${realtimeResult.screenshot}`);

    // 回归查询（实时数据源）
    for (const q of REGRESSION_QUERIES) {
      log(`[5] 回归搜索 "${q}"（实时数据源）`);
      const r = await searchAndCapture(page, `回归_${q}`, q, { realtime: true });
      report.steps.push(r);
      log(`  -> pass=${r.assertions.pass} hasSearchFail=${r.assertions.hasSearchFail} hasResults=${r.assertions.hasResults} hasNotFound=${r.assertions.hasNotFound}`);
      log(`  -> dataSource=${r.dataSourceBadge} screenshot=${r.screenshot}`);
    }
  } catch (err) {
    log('[FATAL]', err);
    report.fatal = String(err);
  } finally {
    await browser.close();
  }

  const reportPath = path.join(shotDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  log(`报告已写入 ${reportPath}`);
  log(`截图目录 ${shotDir}`);

  // 汇总
  const allPass = report.steps.length > 0 && report.steps.every((s) => s.assertions && s.assertions.pass);
  log(`\n总体结果: ${allPass ? 'PASS' : 'FAIL'}`);
  process.exit(allPass ? 0 : 1);
})();