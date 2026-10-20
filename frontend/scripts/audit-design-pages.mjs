/** 设计相关页面移动端溢出审计（/tokens、/radix-demo 等） */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 375, height: 812 };
const ROUTES = ['/tokens', '/radix-demo', '/token-doc', '/design'];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard**', { timeout: 15000 });
await page.waitForTimeout(1500);

for (const r of ROUTES) {
  try {
    await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2200);
    const data = await page.evaluate(() => {
      const w = window.innerWidth;
      const docOverflow = document.documentElement.scrollWidth - w;
      const offenders = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.right > w + 2 || rect.left < -2) {
          let p = el.parentElement;
          let insideScroll = false;
          while (p && p !== document.body) {
            const cs = getComputedStyle(p);
            if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { insideScroll = true; break; }
            p = p.parentElement;
          }
          if (insideScroll) continue;
          offenders.push({ tag: el.tagName.toLowerCase(), cls: (el.getAttribute('class') || '').slice(0, 80), right: Math.round(rect.right), left: Math.round(rect.left), width: Math.round(rect.width) });
        }
      }
      return { url: location.pathname, docOverflow, offenderCount: offenders.length, offenders: offenders.slice(0, 8) };
    });
    console.log(`[${data.docOverflow > 1 || data.offenderCount > 0 ? 'OVERFLOW' : 'ok'}] ${r} -> ${data.url} overflow=${data.docOverflow} offenders=${data.offenderCount}`);
    for (const o of data.offenders) console.log(`      - <${o.tag}> .${o.cls} right=${o.right} left=${o.left} w=${o.width}`);
  } catch (e) {
    console.log(`[ERR] ${r}: ${String(e.message).slice(0, 140)}`);
  }
}
await browser.close();