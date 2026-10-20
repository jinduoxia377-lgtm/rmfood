/** 验证 /analytics 页面 WebSocket 连接修复 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();

const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text().slice(0, 200)}`);
});

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
try { await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }); } catch {}
await page.waitForTimeout(1500);

await page.goto(BASE + '/analytics', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(5000);

// 读取页面上的 WS 状态文案
const status = await page.evaluate(() => {
  const text = document.body.innerText;
  const realtime = text.includes('实时') ? '实时' : text.includes('轮询') ? '轮询' : text.includes('连接') ? '连接中' : '未知';
  return realtime;
});
console.log('WS 状态文案:', status);

const wsErrors = logs.filter((l) => /AnalyticsWS|WebSocket|analytics/i.test(l));
console.log('相关日志:');
for (const l of wsErrors.slice(0, 10)) console.log(' ', l);
if (wsErrors.length === 0) console.log('  （无 WS 错误日志）');

await browser.close();