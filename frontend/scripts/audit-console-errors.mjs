/** 关键页面运行时控制台错误审计 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 390, height: 844 };
const ROUTES = ['/dashboard', '/formulas', '/ai', '/databases', '/settings', '/analytics', '/regulations', '/experiments'];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();

const errors = new Map();

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    const text = msg.text().slice(0, 300);
    errors.set(text, (errors.get(text) || 0) + 1);
  }
});
page.on('pageerror', (err) => {
  const text = String(err.message || err).slice(0, 300);
  errors.set(text, (errors.get(text) || 0) + 1);
});

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
try {
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
} catch { /* ignore */ }
await page.waitForTimeout(1500);

for (const r of ROUTES) {
  try {
    await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
  } catch (e) {
    console.log(`ERR ${r}: ${String(e.message).slice(0, 120)}`);
  }
}

console.log('===== 控制台错误汇总 =====');
if (errors.size === 0) {
  console.log('无错误');
} else {
  for (const [text, count] of errors) {
    console.log(`[${count}] ${text}`);
  }
}
await browser.close();