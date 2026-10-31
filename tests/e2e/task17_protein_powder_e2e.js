/**
 * QA task-17 Playwright：搜索"蛋白粉"相关性验证。
 * 1) 默认本地库搜索"蛋白粉" → 断言页面出现蛋白粉相关产品，且【不出现】奶酪/矿泉水/牛奶/饼干等无关产品。
 * 2) 实时搜索"蛋白粉" → 记录当前基线（task-14 前可能混入无关产品）。
 * 截图存 tests/e2e/screenshots/。
 * 运行：cd D:\RMFOODFP\frontend && node ../tests/e2e/task17_protein_powder_e2e.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

// 已知无关产品名（task-14 基线中 OFF 返回的干扰项）—— 精确匹配，避免误伤"巧克力味"等口味词
const IRRELEVANT_PRODUCTS = [
  '原味白奶酪', '天然矿泉水', '西迪阿里', 'Perly', 'Jben',
  '荞麦脆面包片', 'Prince 全麦巧克力味', '特级精细黑巧克力', '可口可乐 原味 500',
  '奶油奶酪', '有机三明治面包', 'Ain Saïss', 'Sidi Ali',
];

function log(...args) { console.log(...args); }

async function searchAndCapture(page, { label, query, realtime }) {
  const rec = { label, query, realtime, consoleErrors: [] };
  const onConsole = (msg) => { if (msg.type() === 'error') rec.consoleErrors.push(msg.text()); };
  page.on('console', onConsole);
  try {
    await page.getByPlaceholder('搜索零售产品').fill(query);
    const sw = page.getByRole('switch', { name: '实时数据源' });
    if ((await sw.isChecked()) !== realtime) await sw.click();
    await page.getByRole('button', { name: realtime ? '实时搜索 OpenFoodFacts' : '搜索零售产品' }).click();
    try {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find((b) => {
          const t = (b.textContent || '').trim();
          return t.includes('实时搜索 OpenFoodFacts') || t.includes('搜索零售产品');
        });
        return target && !target.disabled && !/正在查询 OpenFoodFacts|正在搜索/.test(document.body.innerText);
      }, { timeout: 120000 });
    } catch { /* 忽略 */ }
    try {
      await page.waitForFunction(() => {
        return /找到 \d+ 款产品|未找到匹配的产品|搜索失败|本地库暂无匹配/.test(document.body.innerText);
      }, { timeout: 30000 });
    } catch { /* 忽略 */ }
    await page.waitForTimeout(1500);

    const body = await page.locator('body').innerText();
    const shot = path.join(SHOT_DIR, `${label}.png`);
    await page.screenshot({ path: shot });
    rec.screenshot = shot;
    rec.bodySnippet = body.slice(0, 800);
    rec.dataSource = await page.locator('text=/数据源:/').first().textContent().catch(() => null);

    const irrelevantFound = IRRELEVANT_PRODUCTS.filter((kw) => body.includes(kw));
    rec.irrelevantFound = irrelevantFound;
    rec.hasSearchFail = body.includes('搜索失败');
    rec.hasResults = /找到 \d+ 款产品/.test(body);
    // 相关产品：页面包含"蛋白粉"或"蛋白"相关字样
    rec.hasRelevant = /蛋白粉|乳清蛋白|大豆蛋白|植物蛋白|蛋白质/.test(body);
    rec.pass = !rec.hasSearchFail && irrelevantFound.length === 0 && rec.hasRelevant;
  } catch (err) {
    rec.error = String(err);
    rec.pass = false;
  } finally {
    page.off('console', onConsole);
  }
  return rec;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const report = { shotDir: SHOT_DIR, steps: [] };

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

    for (const sc of [
      { label: 'task17_蛋白粉_local', query: '蛋白粉', realtime: false },
      { label: 'task17_蛋白粉_realtime', query: '蛋白粉', realtime: true },
    ]) {
      log(`[场景] ${sc.label} (realtime=${sc.realtime})`);
      const rec = await searchAndCapture(page, sc);
      report.steps.push(rec);
      log(`  -> pass=${rec.pass} hasSearchFail=${rec.hasSearchFail} hasResults=${rec.hasResults} hasRelevant=${rec.hasRelevant} irrelevantFound=${JSON.stringify(rec.irrelevantFound)} dataSource=${rec.dataSource}`);
    }
  } catch (err) {
    log('[FATAL]', err);
    report.fatal = String(err);
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(SHOT_DIR, 'task17_report.json'), JSON.stringify(report, null, 2), 'utf-8');
  const allPass = report.steps.length > 0 && report.steps.every((s) => s.pass);
  log(`总体: ${allPass ? 'PASS' : 'FAIL'}（local 场景通过即代表页面不再出现无关产品）`);
  process.exit(allPass ? 0 : 1);
})();