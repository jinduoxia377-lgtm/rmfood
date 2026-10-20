/**
 * 移动端深度布局诊断（iPhone 13, 390×844）
 * 逐页测量：
 *  - 内容区宽度 / 视口宽度比
 *  - 页面内 grid 容器列数（寻找移动端过窄的多列网格）
 *  - 表格列数（寻找移动端被挤压的表格）
 *  - 固定 min-width 元素（> 视口宽度可能导致挤压）
 *  - 主要卡片宽度与内边距
 * 输出：console 摘要 + scripts/layout-deep-data.json
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
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();

async function login() {
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.fill('#rhine-username', 'admin');
      await page.fill('#rhine-password', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
      await page.waitForTimeout(1200);
      return true;
    } catch { /* retry */ }
  }
  return false;
}

const results = [];

async function diagnose(route) {
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);
    if (page.url().includes('/login')) { await login(); await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(2000); }

    const data = await page.evaluate(() => {
      const vw = window.innerWidth;
      const main = document.querySelector('main');
      const mainEl = main || document.body;

      // 内容区：main 下第一个有宽度的 block 容器
      let contentWidth = 0;
      let contentCls = '';
      if (main) {
        const children = Array.from(main.children).filter((el) => el.getBoundingClientRect().width > 0);
        if (children.length > 0) {
          const first = children[0];
          contentWidth = Math.round(first.getBoundingClientRect().width);
          contentCls = (first.className || '').toString().slice(0, 120);
        }
      }

      // grid 容器：寻找列数 ≥3 且每列 < 130px 的网格
      const grids = Array.from(document.querySelectorAll('[class*="grid"]')).map((el) => {
        const cs = getComputedStyle(el);
        if (cs.display !== 'grid') return null;
        const rect = el.getBoundingClientRect();
        const cols = cs.gridTemplateColumns.split(' ').length;
        const colWidth = cols > 0 ? Math.round(rect.width / cols) : 0;
        return {
          cls: (el.className || '').toString().slice(0, 100),
          cols,
          colWidth,
          width: Math.round(rect.width),
          tag: el.tagName,
        };
      }).filter(Boolean).filter((g) => g.cols >= 3 && g.colWidth < 130);

      // 表格：列数
      const tables = Array.from(document.querySelectorAll('table')).map((t) => ({
        cols: t.querySelectorAll('thead th').length || t.querySelector('tr')?.children.length || 0,
        width: Math.round(t.getBoundingClientRect().width),
        cls: (t.className || '').toString().slice(0, 80),
      })).filter((t) => t.cols >= 5);

      // 固定 min-width 元素（可能造成挤压/横向滚动）
      const minWide = Array.from(document.querySelectorAll('*')).filter((el) => {
        const cs = getComputedStyle(el);
        const mw = parseFloat(cs.minWidth || '0');
        return mw > 320 && el.getBoundingClientRect().width > 0;
      }).slice(0, 5).map((el) => ({
        minW: parseFloat(getComputedStyle(el).minWidth || '0'),
        cls: (el.className || '').toString().slice(0, 100),
        tag: el.tagName,
      }));

      // 卡片宽度与 padding
      const cards = Array.from(document.querySelectorAll('main [class*="card"], main .surface-primary, main [class*="rounded-"]')).filter((el) => {
        const cs = getComputedStyle(el);
        return (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && el.getBoundingClientRect().width > 150);
      }).slice(0, 4).map((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          w: Math.round(r.width),
          pl: parseInt(cs.paddingLeft || '0', 10),
          pt: parseInt(cs.paddingTop || '0', 10),
          cls: (el.className || '').toString().slice(0, 80),
        };
      });

      return { vw, contentWidth, contentCls, grids, tables, minWide, cards };
    });

    const issueCount = data.grids.length + data.tables.length + data.minWide.length;
    results.push({ route, ...data, issueCount });
    console.log(`[${issueCount ? '!' : 'ok'}] ${route} vw=${data.vw} content=${data.contentWidth}(${Math.round(data.contentWidth / data.vw * 100)}%) grids=${data.grids.length} tables=${data.tables.length} minWide=${data.minWide.length}`);
    if (issueCount > 0) {
      if (data.grids.length) console.log(`      grids: ${data.grids.map(g => `${g.cols}col/${g.colWidth}px`).join(', ')}`);
      if (data.tables.length) console.log(`      tables: ${data.tables.map(t => `${t.cols}col/${t.width}px`).join(', ')}`);
      if (data.minWide.length) console.log(`      minWide: ${data.minWide.map(m => `${m.minW}px`).join(', ')}`);
    }
  } catch (e) {
    results.push({ route, error: String(e).slice(0, 100) });
    console.log(`[ERR] ${route} ${String(e).slice(0, 80)}`);
  }
}

const ok = await login();
if (!ok) { console.log('LOGIN_OK=false'); process.exit(1); }
console.log('LOGIN_OK=true');

for (const r of ROUTES) await diagnose(r);

writeFileSync(path.join(__dirname, 'layout-deep-data.json'), JSON.stringify(results, null, 2), 'utf8');
const withIssues = results.filter((r) => (r.issueCount || 0) > 0);
console.log(`\n===== 汇总 =====\n页面=${results.length} 有问题=${withIssues.length}`);
for (const r of withIssues) console.log(`  ${r.route}: grids=${r.grids?.length} tables=${r.tables?.length} minWide=${r.minWide?.length}`);
await browser.close();