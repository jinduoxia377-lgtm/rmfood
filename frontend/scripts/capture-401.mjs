/** 捕获 /ai 页面 401 请求来源 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();

const badResponses = [];
page.on('response', (res) => {
  if (res.status() >= 400) {
    badResponses.push({ status: res.status(), url: res.url().slice(0, 200) });
  }
});
page.on('requestfailed', (req) => {
  badResponses.push({ status: 'FAILED', url: req.url().slice(0, 200), err: (req.failure()?.errorText || '').slice(0, 80) });
});

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
try { await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }); } catch {}
await page.waitForTimeout(1500);

await page.goto(BASE + '/ai', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(4000);

console.log('===== /ai 非 2xx 响应 =====');
const seen = new Set();
for (const r of badResponses) {
  const key = `${r.status}|${r.url}`;
  if (seen.has(key)) continue;
  seen.add(key);
  console.log(`${r.status} ${r.url}${r.err ? ' ERR=' + r.err : ''}`);
}
await browser.close();