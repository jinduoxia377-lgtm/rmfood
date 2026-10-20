/**
 * 移动端关键页面截图（375×812），用于验证 min-height 触控规则后的视觉状态
 * 用法: node scripts/mobile-screenshots.mjs
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 375, height: 812 };
const ROUTES = ['/dashboard', '/formulas', '/ai', '/settings', '/databases', '/regulations', '/terminology', '/analytics'];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();

// 登录
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard**', { timeout: 15000 });
await page.waitForTimeout(2000);

for (const r of ROUTES) {
  try {
    await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2200);
    const name = r.replace(/\//g, '_') || 'root';
    await page.screenshot({ path: `test-screenshots/mobile-final${name}.png` });
    console.log(`saved: test-screenshots/mobile-final${name}.png`);
  } catch (e) {
    console.log(`ERR ${r}: ${String(e.message).slice(0, 120)}`);
  }
}
await browser.close();