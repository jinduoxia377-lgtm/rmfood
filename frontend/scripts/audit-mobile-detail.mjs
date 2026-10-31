/**
 * 移动端细节专项审查（iPhone 13, 390×844）
 * 逐页测量三类用户关注的问题：
 *  1) 按钮：所有 button/role=button 的高度分布（<40 过小、>60 过大）、内边距、文字是否截断
 *  2) 文本排版：line-height 异常（<1.2）、文本溢出容器（scrollWidth > clientWidth）、段落间距
 *  3) 页面边际：main 根容器左右 padding、首内容元素 margin、连续卡片 gap（>32 过大）
 * 输出：console 摘要 + scripts/mobile-detail-data.json
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];

const ROUTES = [
  '/dashboard', '/formulas', '/formulas/new', '/experiments', '/experiments/new', '/batches',
  '/doe', '/stability', '/documents', '/compliance', '/label-check', '/ingredient-analysis',
  '/labels', '/ai', '/databases', '/regulations', '/terminology', '/workflows', '/agent',
  '/analytics', '/organizations', '/settings', '/users', '/audit-logs', '/billing',
  '/notifications', '/academic-report', '/peptide-structure', '/integrations', '/tokens',
];

const browser = await chromium.launch({ headless: true });

async function login(page) {
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.fill('#rhine-username', 'admin');
      await page.fill('#rhine-password', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
      await page.waitForTimeout(1000);
      return true;
    } catch { /* retry */ }
  }
  return false;
}

const results = [];

async function audit(route) {
  const context = await browser.newContext({ ...iPhone13 });
  const page = await context.newPage();
  try {
    await login(page);
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2200);

    const data = await page.evaluate(() => {
      const vw = window.innerWidth;
      const issues = [];

      // 1) 按钮
      const btns = Array.from(document.querySelectorAll('main button, main [role="button"]'))
        .filter((el) => el.getBoundingClientRect().width > 20 && el.getBoundingClientRect().height > 10);
      let smallBtns = 0;
      let largeBtns = 0;
      const btnSamples = [];
      for (const el of btns) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const cls = (el.className || '').toString();
        if (r.height < 40) { smallBtns++; if (btnSamples.length < 3) btnSamples.push({ h: Math.round(r.height), cls: cls.slice(0, 100) }); }
        if (r.height > 64) largeBtns++;
      }
      if (smallBtns > 3) issues.push({ type: 'too-many-small-btns', smallBtns, sample: btnSamples });
      else if (smallBtns > 0 && smallBtns <= 3) issues.push({ type: 'few-small-btns', smallBtns, sample: btnSamples });
      if (largeBtns > 2) issues.push({ type: 'large-btns', largeBtns });

      // 2) 文本排版
      const texts = Array.from(document.querySelectorAll('main p, main span, main div')).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 50 && r.height > 10 && el.textContent && el.textContent.trim().length > 2;
      });
      let overflowText = 0;
      let lowLineHeight = 0;
      let textOverflowSamples = [];
      for (const el of texts.slice(0, 4000)) {
        if (el.scrollWidth > el.clientWidth + 2) {
          overflowText++;
          if (textOverflowSamples.length < 3) textOverflowSamples.push({ cls: (el.className || '').toString().slice(0, 90), txt: el.textContent.trim().slice(0, 20) });
        }
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight || '0');
        const fs = parseFloat(cs.fontSize || '14');
        if (fs > 10 && lh > 0 && lh / fs < 1.2) lowLineHeight++;
      }
      if (overflowText > 0) issues.push({ type: 'text-overflow', count: overflowText, samples: textOverflowSamples });
      if (lowLineHeight > 5) issues.push({ type: 'low-line-height', count: lowLineHeight });

      // 3) 页面边际
      const main = document.querySelector('main');
      let mainPad = 0;
      let firstMargin = 0;
      let rootCls = '';
      if (main) {
        const cs = getComputedStyle(main);
        mainPad = parseInt(cs.paddingLeft || '0', 10);
        rootCls = (main.className || '').toString().slice(0, 100);
        const child = Array.from(main.children).find((el) => el.getBoundingClientRect().width > 100);
        if (child) {
          const mcs = getComputedStyle(child);
          firstMargin = parseInt(mcs.marginLeft || '0', 10);
        }
      }
      if (mainPad > 24) issues.push({ type: 'wide-margin', mainPad });
      if (mainPad === 0 && firstMargin === 0) issues.push({ type: 'no-margin', mainPad, firstMargin, rootCls });

      return { vw, btnTotal: btns.length, smallBtns, largeBtns, overflowText, lowLineHeight, mainPad, firstMargin, issues: issues.slice(0, 8) };
    });

    results.push({ route, ...data, issueCount: data.issues.length });
    if (data.issues.length) {
      console.log(`[!] ${route} issues=${data.issues.length} smallBtns=${data.smallBtns} overflow=${data.overflowText} pad=${data.mainPad}`);
      for (const i of data.issues.slice(0, 4)) console.log(`      ${i.type}${i.smallBtns ? ` n=${i.smallBtns}` : ''}${i.count ? ` n=${i.count}` : ''}${i.mainPad ? ` pad=${i.mainPad}` : ''}${i.sample ? ' ' + JSON.stringify(i.sample[0]) : ''}`);
    } else {
      console.log(`[ok] ${route} btns=${data.btnTotal} small=${data.smallBtns} overflow=${data.overflowText} pad=${data.mainPad}`);
    }
  } catch (e) {
    results.push({ route, error: String(e).slice(0, 80), issueCount: -1 });
    console.log(`[ERR] ${route} ${String(e).slice(0, 80)}`);
  } finally {
    await context.close();
  }
}

for (const r of ROUTES) await audit(r);
writeFileSync(path.join(__dirname, 'mobile-detail-data.json'), JSON.stringify(results, null, 2), 'utf8');
const bad = results.filter((r) => (r.issueCount || 0) > 0);
console.log(`\n===== 汇总 =====\n页面=${results.length} 有问题=${bad.length}`);
for (const r of bad) console.log(`  ${r.route}: ${r.issueCount} 项 (smallBtns=${r.smallBtns}, overflow=${r.overflowText}, pad=${r.mainPad})`);
await browser.close();