/** 捕获嵌套 button 警告的完整组件栈 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();

page.on('console', async (m) => {
  if (m.type() === 'error' && /descendant|nested|does not recognize|non-boolean/i.test(m.text())) {
    console.log('=== CONSOLE ERROR ===');
    console.log(m.text());
    const loc = m.location();
    if (loc && loc.url) console.log('LOC:', loc.url, loc.lineNumber, loc.columnNumber);
    try {
      const args = await Promise.all(m.args().map((a) => a.jsonValue().catch(() => null)));
      console.log('ARGS:', JSON.stringify(args).slice(0, 2000));
    } catch {}
  }
});
page.on('pageerror', (e) => {
  if (/descendant|nested|does not recognize|non-boolean/i.test(String(e.message))) {
    console.log('=== PAGE ERROR ===');
    console.log(String(e.stack || e.message).slice(0, 3000));
  }
});

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
try { await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }); } catch {}
await page.waitForTimeout(1500);

// 访问 AI 页并切换几次 tab，触发加载骨架/内容切换
for (const r of ['/ai', '/settings', '/ai']) {
  await page.goto(BASE + r, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
}
console.log('done');
await browser.close();