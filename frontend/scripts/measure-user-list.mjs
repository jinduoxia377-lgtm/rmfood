// 用户列表模块尺寸深度核查：多视口测量卡片/网格/表格列宽
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const OUT = 'D:\\RMFOODFP\\frontend\\test-screenshots';

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input#rhine-username', { timeout: 20000 });
  await page.fill('input#rhine-username', 'admin');
  await page.fill('input#rhine-password', 'admin123');
  await Promise.all([
    page.waitForResponse((r) => /\/api\/.*auth\/login/.test(r.url()), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForURL('**/dashboard**', { timeout: 25000 });
}

function measure(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const main = document.querySelector('#main-content');
    // 主内容网格
    const grid = document.querySelector('#user-table-card')?.closest('.grid');
    const gridRect = grid ? grid.getBoundingClientRect() : null;
    const sidebar = document.querySelector('.grid > .lg\\:col-span-1') || grid?.querySelector('[class*="col-span-1"]');
    const tableCard = document.querySelector('#user-table-card');
    const scroller = tableCard?.querySelector('.overflow-x-auto');
    const table = tableCard?.querySelector('table');
    const thead = tableCard?.querySelector('thead');

    // 表头各列宽度
    const cols = [...(thead?.querySelectorAll('th') || [])].map((th) => ({
      label: th.textContent?.trim().slice(0, 8),
      w: Math.round(th.getBoundingClientRect().width),
      visible: th.offsetWidth > 0,
    }));

    // 表格行高（第一数据行）
    const row = table?.querySelector('tbody tr');
    const rowH = row ? Math.round(row.getBoundingClientRect().height) : null;

    // 表头工具条
    const toolbar = tableCard?.querySelector('.flex.items-center.justify-between');

    return {
      viewport: vw,
      mainW: main ? Math.round(main.getBoundingClientRect().width) : null,
      mainPad: main ? getComputedStyle(main).padding : null,
      grid: gridRect ? { w: Math.round(gridRect.width), cols: grid.style.gridTemplateColumns || getComputedStyle(grid).gridTemplateColumns } : null,
      sidebarW: sidebar ? Math.round(sidebar.getBoundingClientRect().width) : null,
      tableCardW: tableCard ? Math.round(tableCard.getBoundingClientRect().width) : null,
      toolbarW: toolbar ? Math.round(toolbar.getBoundingClientRect().width) : null,
      scroller: scroller ? { w: Math.round(scroller.clientWidth), scrollW: scroller.scrollWidth, overflow: scroller.scrollWidth > scroller.clientWidth + 2 } : null,
      tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
      tableMinW: table ? getComputedStyle(table).minWidth : null,
      rowH,
      cols,
      totalColW: cols.reduce((s, c) => s + c.w, 0),
      visibleCols: cols.filter((c) => c.visible).length,
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(`${BASE}/users`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("用户管理")', { timeout: 15000 });
  await page.waitForTimeout(2000);

  const widths = [1440, 1280, 1024, 900, 768, 375];
  const results = {};
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(900);
    results[`vw_${w}`] = await measure(page);
  }

  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
