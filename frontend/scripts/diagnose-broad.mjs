/** iPhone 13 广域诊断：排查仍有“老年机”观感的页面（过大色块/超高卡片/超大标题） */
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];
const ROUTES = [
  '/dashboard', '/formulas', '/formulas/new', '/experiments', '/stability', '/doe',
  '/regulations', '/terminology', '/databases', '/ai', '/settings', '/users',
  '/analytics', '/organizations', '/notifications', '/workflows', '/agent',
  '/batches', '/documents', '/compliance', '/labels', '/billing', '/integrations',
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard**', { timeout: 15000 });
await page.waitForTimeout(1500);

let overflowPages = 0;
let tallBlockPages = 0;

for (const r of ROUTES) {
  try {
    await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1800);
    const d = await page.evaluate(() => {
      const w = window.innerWidth;
      const docOverflow = document.documentElement.scrollWidth - w;
      const banner = document.querySelector('.surface-primary');
      const br = banner?.getBoundingClientRect();
      // 找出高度 > 380px 的块级元素（可能是“大色块”）
      const tall = [];
      for (const el of Array.from(document.querySelectorAll('main div'))) {
        const rect = el.getBoundingClientRect();
        if (rect.height > 380 && rect.width > 200) {
          tall.push({ cls: (el.getAttribute('class') || '').slice(0, 70), h: Math.round(rect.height), w: Math.round(rect.width) });
          if (tall.length >= 3) break;
        }
      }
      // 最大标题字号
      let maxH = 0; let maxHText = '';
      for (const h of Array.from(document.querySelectorAll('main h1, main h2, main h3'))) {
        const fs = parseFloat(getComputedStyle(h).fontSize);
        if (fs > maxH) { maxH = fs; maxHText = (h.textContent || '').trim().slice(0, 20); }
      }
      return {
        url: location.pathname,
        overflow: docOverflow,
        bannerH: br ? Math.round(br.height) : null,
        maxHeading: Math.round(maxH),
        maxHeadingText: maxHText,
        tallBlocks: tall,
      };
    });
    const flag = [];
    if (d.overflow > 1) flag.push('OVERFLOW');
    if ((d.bannerH ?? 0) > 260) flag.push('BANNER_TALL');
    if (d.maxHeading > 28) flag.push('HEADING_BIG');
    if (d.tallBlocks.length) flag.push('TALL_BLOCK');
    if (flag.length) {
      if (d.overflow > 1) overflowPages++;
      if (d.tallBlocks.length) tallBlockPages++;
      console.log(`[${flag.join(',')}] ${r} banner=${d.bannerH} maxH=${d.maxHeading}(${d.maxHeadingText}) tall=${d.tallBlocks.length}`);
      for (const t of d.tallBlocks) console.log(`      tall: .${t.cls} ${t.w}x${t.h}`);
    } else {
      console.log(`[ok] ${r} banner=${d.bannerH} maxH=${d.maxHeading}`);
    }
  } catch (e) {
    console.log(`[ERR] ${r}: ${String(e.message).slice(0, 120)}`);
  }
}

console.log(`\n汇总: 溢出页面=${overflowPages}, 超高块页面=${tallBlockPages}`);
await browser.close();