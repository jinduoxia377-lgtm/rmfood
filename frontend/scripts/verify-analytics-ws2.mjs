/** 在已登录浏览器上下文内验证 Analytics WebSocket（自动携带 Cookie） */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
try { await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }); } catch {}
await page.waitForTimeout(2000);

const result = await page.evaluate(async () => {
  const candidates = [
    'ws://localhost:8000/api/v1/analytics/ws/dashboard',
    'ws://localhost:8000/api/v1/ws/analytics',
  ];
  const out = [];
  for (const url of candidates) {
    const r = await new Promise((resolve) => {
      let done = false;
      const ws = new WebSocket(url);
      const timer = setTimeout(() => { if (!done) { done = true; resolve('timeout'); try { ws.close(); } catch {} } }, 5000);
      ws.onopen = () => { if (!done) { done = true; clearTimeout(timer); resolve('open'); ws.close(); } };
      ws.onclose = (e) => { if (!done) { done = true; clearTimeout(timer); resolve(`close:${e.code}:${e.reason}`); } };
      ws.onerror = () => { /* wait for close */ };
    });
    out.push(`${url} -> ${r}`);
  }
  return out;
});
console.log(result.join('\n'));
await browser.close();