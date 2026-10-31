/**
 * QA task-33 Playwright：产品详情五 Tab 数据补全验证（健壮版）。
 * 1) 搜索 collagen → 打开 OFF 产品详情 → 五个 Tab 可切换且营养/成分/安全/市场有真实内容。
 * 2) 搜索 蛋白粉 → 打开 manual 产品详情 → 营养成分 Tab 显示"平台参考数据暂无营养声明"。
 * 截图存 tests/e2e/screenshots/。
 * 运行：cd D:\RMFOODFP\frontend && node ../tests/e2e/task33_detail_e2e.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

function log(...args) { console.log(...args); }

async function doSearch(page, query, { realtime = false, internetOnly = false } = {}) {
  const input = page.getByPlaceholder('输入中文关键词（如 蛋白粉）');
  await input.fill(query);
  const rtSw = page.getByRole('switch', { name: '实时数据源' });
  if ((await rtSw.count()) && (await rtSw.isChecked()) !== realtime) await rtSw.click();
  // 管理"仅看互联网产品"开关（搜索结果工具栏，搜索后出现；若已存在则按需切换）
  const originSw = page.getByRole('switch', { name: '仅看互联网产品' });
  if (await originSw.count()) {
    if ((await originSw.isChecked()) !== internetOnly) {
      await originSw.click();
      try {
        await page.waitForFunction(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const target = btns.find((b) => (b.textContent || '').includes('搜索零售产品'));
          return target && !target.disabled && !/正在搜索|正在查询/.test(document.body.innerText);
        }, { timeout: 150000 });
      } catch {}
      await page.waitForTimeout(1500);
    }
  }
  await page.getByRole('button', { name: realtime ? '实时搜索 OpenFoodFacts' : '搜索零售产品' }).click();
  try {
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find((b) => {
        const t = (b.textContent || '').trim();
        return t.includes('实时搜索 OpenFoodFacts') || t.includes('搜索零售产品');
      });
      return target && !target.disabled && !/正在搜索|正在查询/.test(document.body.innerText);
    }, { timeout: 150000 });
  } catch {}
  try {
    await page.waitForFunction(() => /找到 \d+ 款|共 \d+ 款|未找到|暂无匹配|实时互联网|OFF 缓存|平台参考数据/.test(document.body.innerText), { timeout: 30000 });
  } catch {}
  await page.waitForTimeout(1500);

  if (internetOnly) {
    const sw = page.getByRole('switch', { name: '仅看互联网产品' });
    if (await sw.count()) {
      if (!(await sw.isChecked())) {
        await sw.click();
        try {
          await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            const target = btns.find((b) => (b.textContent || '').includes('搜索零售产品'));
            return target && !target.disabled && !/正在搜索|正在查询/.test(document.body.innerText);
          }, { timeout: 150000 });
        } catch {}
        await page.waitForTimeout(1500);
      }
    }
  }
}

async function openFirstProduct(page) {
  // 关闭可能弹出的搜索建议
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
  // 点击第一个产品名按钮（产品名按钮 class 含 truncate）；force 点击绕过建议层拦截
  const nameBtn = page.locator('button.truncate').first();
  await nameBtn.scrollIntoViewIfNeeded({ timeout: 10000 }).catch(() => {});
  await nameBtn.click({ force: true, timeout: 10000 });
  await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1200);
}

async function clickTab(page, name) {
  const tab = page.getByRole('tab', { name });
  await tab.first().click({ force: true, timeout: 10000 });
  await page.waitForTimeout(500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
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
    await page.getByPlaceholder('输入中文关键词（如 蛋白粉）').waitFor({ state: 'visible', timeout: 30000 });

    // 场景1：搜索 collagen，优先 OFF 产品（尝试仅看互联网）
    log('[场景1] 搜索 collagen');
    await doSearch(page, 'collagen', { internetOnly: true });
    const bodyAfterSearch = await page.locator('body').innerText();
    if (!/实时互联网|OFF 缓存/.test(bodyAfterSearch)) {
      log('  默认结果无 OFF，切换实时数据源重试');
      await doSearch(page, 'collagen', { realtime: true, internetOnly: true });
    }
    await openFirstProduct(page);

    const tabs = ['基本信息', '营养成分', '食品安全', '成分表', '市场信息'];
    const tabResults = {};
    for (const t of tabs) {
      tabResults[t] = (await page.getByRole('tab', { name: t }).count()) > 0;
    }
    log('  五 Tab 存在:', JSON.stringify(tabResults));

    await clickTab(page, '营养成分');
    const nutritionBody = await page.locator('body').innerText();
    const nutritionHasContent = /每 100g|能量|蛋白质|脂肪|碳水|营养等级/.test(nutritionBody) && !nutritionBody.includes('平台参考数据暂无营养声明');
    await page.screenshot({ path: path.join(SHOT_DIR, 'task33_detail_nutrition.png') });
    log('  营养成分有真实内容:', nutritionHasContent);

    await clickTab(page, '成分表');
    const ingBody = await page.locator('body').innerText();
    const ingredientsHasContent = /配料表|成分|collagen|水解胶原|胶原蛋白|peptides/i.test(ingBody);
    await page.screenshot({ path: path.join(SHOT_DIR, 'task33_detail_ingredients.png') });
    log('  成分表有真实内容:', ingredientsHasContent);

    await clickTab(page, '食品安全');
    const safetyBody = await page.locator('body').innerText();
    const safetyHasContent = /过敏原|添加剂|NOVA|Eco-Score|生态|无安全警告/.test(safetyBody);
    await page.screenshot({ path: path.join(SHOT_DIR, 'task33_detail_safety.png') });
    log('  食品安全有内容:', safetyHasContent);

    await clickTab(page, '市场信息');
    const marketBody = await page.locator('body').innerText();
    const marketHasContent = /数据来源|实时互联网|OFF 缓存|条码|数据质量|销售|注册号/.test(marketBody);
    await page.screenshot({ path: path.join(SHOT_DIR, 'task33_detail_market.png') });
    log('  市场信息有内容:', marketHasContent);

    report.steps.push({ name: 'collagen_off_detail', tabs: tabResults, nutritionHasContent, ingredientsHasContent, safetyHasContent, marketHasContent });

    // 关闭详情
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    // 场景2：manual 产品详情显示"平台参考数据暂无营养声明"
    log('[场景2] 搜索蛋白粉（本地 manual）');
    await doSearch(page, '蛋白粉');
    await openFirstProduct(page);
    const basicBody = await page.locator('body').innerText();
    const manualSourceBadge = basicBody.includes('平台参考数据');
    await clickTab(page, '营养成分');
    const manualNutritionBody = await page.locator('body').innerText();
    const manualNoNutrition = manualNutritionBody.includes('平台参考数据暂无营养声明');
    await page.screenshot({ path: path.join(SHOT_DIR, 'task33_manual_no_nutrition.png') });
    log('  manual 来源徽标:', manualSourceBadge, '| 暂无营养声明:', manualNoNutrition);
    report.steps.push({ name: 'manual_detail', sourceBadge: manualSourceBadge, noNutritionNotice: manualNoNutrition });

    report.allPass = Object.values(tabResults).every(Boolean) && nutritionHasContent && ingredientsHasContent && safetyHasContent && marketHasContent && manualSourceBadge && manualNoNutrition;
    fs.writeFileSync(path.join(SHOT_DIR, 'task33_report.json'), JSON.stringify(report, null, 2), 'utf-8');
    log('总体:', report.allPass ? 'PASS' : 'FAIL');
    process.exit(report.allPass ? 0 : 1);
  } catch (err) {
    log('[FATAL]', err);
    report.fatal = String(err);
    fs.writeFileSync(path.join(SHOT_DIR, 'task33_report.json'), JSON.stringify(report, null, 2), 'utf-8');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();