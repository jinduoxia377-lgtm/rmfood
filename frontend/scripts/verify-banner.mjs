/** 验证全站 primary 横幅移动端紧凑化（iPhone 13） */
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];
const ROUTES = ['/formulas', '/experiments', '/regulations', '/settings'];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
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
    await page.waitForTimeout(1800);
    const d = await page.evaluate(() => {
      const banner = document.querySelector('.surface-primary');
      const r = banner?.getBoundingClientRect();
      const cs = banner ? getComputedStyle(banner) : null;
      return {
        url: location.pathname,
        bannerH: r ? Math.round(r.height) : null,
        bannerPad: cs?.paddingTop,
        hasBanner: !!banner,
      };
    });
    console.log(JSON.stringify(d));
  } catch (e) {
    console.log(`ERR ${r}: ${String(e.message).slice(0, 120)}`);
  }
}
await browser.close();