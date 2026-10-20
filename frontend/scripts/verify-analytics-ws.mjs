/** 验证后端 Analytics WebSocket 路由（8000 端口，带 token） */
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
await page.waitForTimeout(1500);

const token = await page.evaluate(() => localStorage.getItem('access_token') || '');
console.log('token 长度:', token.length);

const candidates = [
  'ws://localhost:8000/api/v1/analytics/ws/dashboard',
  'ws://localhost:8000/api/v1/ws/analytics',
  'ws://localhost:8000/api/v1/ws/dashboard',
];

for (const url of candidates) {
  await new Promise((resolve) => {
    const wsUrl = `${url}?token=${encodeURIComponent(token)}`;
    console.log(`尝试: ${url}`);
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      console.log(`  -> 超时（未连接）`);
      try { ws.close(); } catch {}
      resolve();
    }, 5000);
    ws.onopen = () => { console.log(`  -> 已连接 ✅`); clearTimeout(timer); ws.close(); resolve(); };
    ws.onerror = (e) => { console.log(`  -> 错误`); };
    ws.onclose = (e) => { console.log(`  -> 关闭 code=${e.code} reason=${e.reason}`); clearTimeout(timer); resolve(); };
  });
}
await browser.close();