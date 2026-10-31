/**
 * QA task-23 Playwright：数据来源徽标 + "仅看互联网产品"开关。
 * 1) 搜索"蛋白粉"（默认）→ 断言页面出现来源徽标（平台参考数据/OFF 缓存/实时互联网）与来源统计。
 * 2) 切换"仅看互联网产品"开关 → 断言列表不再出现"平台参考数据"徽标，仅 OFF 产品。
 * 截图存 tests/e2e/screenshots/。
 * 运行：cd D:\RMFOODFP\frontend && node ../tests/e2e/task23_origin_e2e.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });
const QUERY = '蛋白粉';

function log(...args) { console.log(...args); }

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
    await page.getByPlaceholder('输入中文关键词（如 蛋白粉）').waitFor({ state: 'visible', timeout: 30000 });

    // 场景1：默认搜索（origin=all）
    log('[场景1] 搜索蛋白粉（默认）');
    await page.getByPlaceholder('输入中文关键词（如 蛋白粉）').fill(QUERY);
    await page.getByRole('button', { name: '搜索零售产品' }).click();
    try {
      await page.waitForFunction(() => /找到|共 \d+ 款|平台参考数据|OFF 缓存/.test(document.body.innerText), { timeout: 60000 });
    } catch {}
    await page.waitForTimeout(1500);
    const body1 = await page.locator('body').innerText();
    const statsMatch1 = body1.match(/共 (\d+) 款（其中 (\d+) 款互联网真实产品 \/ (\d+) 款平台参考数据）/);
    const badges1 = {
      local: body1.includes('平台参考数据'),
      cache: body1.includes('OFF 缓存'),
      realtime: body1.includes('实时互联网'),
    };
    const stats1 = statsMatch1 ? { total: +statsMatch1[1], internet: +statsMatch1[2], local: +statsMatch1[3] } : null;
    log('  徽标:', JSON.stringify(badges1), '| 来源统计:', JSON.stringify(stats1));
    const shot1 = path.join(SHOT_DIR, 'task23_origin_all.png');
    await page.screenshot({ path: shot1 });
    report.steps.push({ name: 'origin_all', badges: badges1, stats: stats1, screenshot: shot1 });

    // 场景2：切换"仅看互联网产品"
    log('[场景2] 切换"仅看互联网产品"');
    const sw = page.getByRole('switch', { name: '仅看互联网产品' });
    await sw.click();
    try {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find((b) => (b.textContent || '').includes('搜索零售产品') || (b.textContent || '').includes('实时搜索'));
        return target && !target.disabled && !/正在搜索|正在查询/.test(document.body.innerText);
      }, { timeout: 120000 });
    } catch {}
    await page.waitForTimeout(1500);
    const body2 = await page.locator('body').innerText();
    const statsMatch2 = body2.match(/共 (\d+) 款（其中 (\d+) 款互联网真实产品 \/ (\d+) 款平台参考数据）/);
    const stats2 = statsMatch2 ? { total: +statsMatch2[1], internet: +statsMatch2[2], local: +statsMatch2[3] } : null;
    // 列表内"平台参考数据"徽标（排除统计行）：统计行是唯一的"0 款平台参考数据"文本
    const localBadgeCount2 = await page.locator('text=平台参考数据').count();
    const hasLocalBadgeInList2 = stats2 ? stats2.local > 0 : localBadgeCount2 > 1;
    log('  统计:', JSON.stringify(stats2), '| local>0 仍存在:', hasLocalBadgeInList2);
    const shot2 = path.join(SHOT_DIR, 'task23_origin_internet.png');
    await page.screenshot({ path: shot2 });
    report.steps.push({ name: 'origin_internet', stats: stats2, hasLocalBadge: hasLocalBadgeInList2, screenshot: shot2 });

    report.allPass = !!(report.steps[0].stats && report.steps[0].stats.local > 0) && !!(report.steps[1].stats && report.steps[1].stats.local === 0);
    fs.writeFileSync(path.join(SHOT_DIR, 'task23_report.json'), JSON.stringify(report, null, 2), 'utf-8');
    log('总体:', report.allPass ? 'PASS' : 'FAIL');
    process.exit(report.allPass ? 0 : 1);
  } catch (err) {
    log('[FATAL]', err);
    report.fatal = String(err);
    fs.writeFileSync(path.join(SHOT_DIR, 'task23_report.json'), JSON.stringify(report, null, 2), 'utf-8');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();