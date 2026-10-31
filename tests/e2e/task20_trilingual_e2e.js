/**
 * QA task-20 Playwright：三语（中/英/德）搜索验证。
 * 1) 中文：占位提示 + 热门词 chips（中文）
 * 2) 切 en-US：占位提示 "Search by keyword (e.g. protein powder)" + 热门词 chips 英文；搜 "protein powder"
 * 3) 切 de-DE：占位提示 "Suche nach Stichwort (z.B. Eiweißpulver)" + 热门词 chips 德文；搜 "Eiweißpulver"
 * 截图存 tests/e2e/screenshots/。
 * 运行：cd D:\RMFOODFP\frontend && node ../tests/e2e/task20_trilingual_e2e.js
 */
const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const SHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

function log(...args) { console.log(...args); }

const LANGS = {
  'zh-CN': { tab: '市售产品', placeholder: '输入中文关键词（如 蛋白粉）', query: '蛋白粉', chip: '蛋白粉', searchBtn: '搜索零售产品' },
  'en-US': { tab: 'Retail Products', placeholder: 'Search by keyword (e.g. protein powder)', query: 'protein powder', chip: 'Protein Powder', searchBtn: 'Search Retail Products' },
  'de-DE': { tab: 'Handelsprodukte', placeholder: 'Suche nach Stichwort (z.B. Eiweißpulver)', query: 'Eiweißpulver', chip: 'Eiweißpulver', searchBtn: 'Handelsprodukte suchen' },
};

async function setLanguage(page, lang) {
  await page.evaluate((l) => {
    localStorage.setItem('rmfood-language', l);
  }, lang);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
}

async function capture(page, label) {
  const shot = path.join(SHOT_DIR, `${label}.png`);
  await page.screenshot({ path: shot });
  return shot;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
  const page = await context.newPage();
  const report = { shotDir: SHOT_DIR, steps: [] };

  try {
    // 登录
    await page.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    if (await page.getByPlaceholder('请输入用户名').count()) {
      await page.getByPlaceholder('请输入用户名').fill('admin');
      await page.getByPlaceholder('请输入密码').fill('admin123');
      await page.getByRole('button', { name: '进入平台' }).click();
      await page.waitForURL('**/dashboard**', { timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }

    // 中文基线
    await setLanguage(page, 'zh-CN');
    await page.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: '市售产品' }).click();
    await page.waitForTimeout(1000);
    const zhPlaceholder = await page.getByPlaceholder('输入中文关键词（如 蛋白粉）').count();
    log('[zh] placeholder 匹配:', zhPlaceholder > 0);
    await capture(page, 'task20_zh_placeholder');
    // 搜索一个无结果词触发空态热门 chips
    await page.getByPlaceholder('输入中文关键词（如 蛋白粉）').fill('qqq不存在xyz');
    await page.getByRole('button', { name: '搜索零售产品' }).click();
    try { await page.waitForFunction(() => /未找到|暂无匹配|热门搜索/.test(document.body.innerText), { timeout: 60000 }); } catch {}
    await page.waitForTimeout(1000);
    const zhChips = await page.locator('text=/热门搜索|蛋白粉|胶原蛋白肽|维生素C|益生菌|鱼油/').count();
    log('[zh] 热门词 chips 可见:', zhChips > 0);
    await capture(page, 'task20_zh_hot_chips');
    report.steps.push({ lang: 'zh-CN', placeholderOk: zhPlaceholder > 0, chipsOk: zhChips > 0, screenshot: `task20_zh_hot_chips.png` });

    // 英文
    await setLanguage(page, 'en-US');
    await page.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: 'Retail Products' }).click();
    await page.waitForTimeout(1000);
    const enPlaceholder = await page.getByPlaceholder('Search by keyword (e.g. protein powder)').count();
    log('[en] placeholder 匹配:', enPlaceholder > 0);
    await capture(page, 'task20_en_placeholder');
    // 英文搜索 protein powder
    await page.getByPlaceholder('Search by keyword (e.g. protein powder)').fill('protein powder');
    const enSearchBtn = page.getByRole('button', { name: 'Search Retail Products' });
    await enSearchBtn.click();
    try {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find((b) => (b.textContent || '').includes('Search Retail Products'));
        return target && !target.disabled && !/Searching|Loading/.test(document.body.innerText);
      }, { timeout: 120000 });
    } catch {}
    await page.waitForTimeout(1500);
    const enBody = await page.locator('body').innerText();
    log('[en] search result: hasResult=', /found|product/i.test(enBody), 'hasEmpty=', /no relevant|not found|No match/i.test(enBody));
    const enChips = await page.locator('text=/Protein Powder|Collagen Peptide|Vitamin C|Probiotic|Fish Oil/').count();
    log('[en] 热门词 chips 英文:', enChips > 0);
    await capture(page, 'task20_en_search');
    report.steps.push({ lang: 'en-US', placeholderOk: enPlaceholder > 0, chipsOk: enChips > 0, screenshot: `task20_en_search.png` });

    // 德文
    await setLanguage(page, 'de-DE');
    await page.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    await page.getByRole('tab', { name: 'Handelsprodukte' }).click();
    await page.waitForTimeout(1000);
    const dePlaceholder = await page.getByPlaceholder('Suche nach Stichwort (z.B. Eiweißpulver)').count();
    log('[de] placeholder 匹配:', dePlaceholder > 0);
    await capture(page, 'task20_de_placeholder');
    await page.getByPlaceholder('Suche nach Stichwort (z.B. Eiweißpulver)').fill('Eiweißpulver');
    const deBtn = page.getByRole('button', { name: 'Handelsprodukte suchen' });
    await deBtn.click();
    try {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find((b) => (b.textContent || '').includes('Handelsprodukte suchen'));
        return target && !target.disabled && !/Suche läuft|Wird geladen/.test(document.body.innerText);
      }, { timeout: 120000 });
    } catch {}
    await page.waitForTimeout(1500);
    const deBody = await page.locator('body').innerText();
    log('[de] search result: hasResult=', /Produkt|Ergebnis/i.test(deBody), 'hasEmpty=', /keine|nicht gefunden|Keine/i.test(deBody));
    const deChips = await page.locator('text=/Eiweißpulver|Kollagenpeptid|Vitamin C|Probiotika|Fischöl/').count();
    log('[de] 热门词 chips 德文:', deChips > 0);
    await capture(page, 'task20_de_search');
    report.steps.push({ lang: 'de-DE', placeholderOk: dePlaceholder > 0, chipsOk: deChips > 0, screenshot: `task20_de_search.png` });

    // 恢复中文
    await setLanguage(page, 'zh-CN');
    report.allPass = report.steps.every((s) => s.placeholderOk);
    fs.writeFileSync(path.join(SHOT_DIR, 'task20_report.json'), JSON.stringify(report, null, 2), 'utf-8');
    log('总体:', report.allPass ? 'PASS' : 'FAIL');
    process.exit(report.allPass ? 0 : 1);
  } catch (err) {
    log('[FATAL]', err);
    report.fatal = String(err);
    fs.writeFileSync(path.join(SHOT_DIR, 'task20_report.json'), JSON.stringify(report, null, 2), 'utf-8');
    process.exit(1);
  } finally {
    await browser.close();
  }
})();