import { chromium, devices } from '@playwright/test';
const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
await page.waitForTimeout(1500);
await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(1800);
try {
  const r = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('main *'));
    const issues = [];
    for (const el of all.slice(0, 500)) {
      const cs = getComputedStyle(el);
      if (cs.display !== 'grid') continue;
      const cls = (el.className || '').toString();
      if (/\b(xs|sm|md|lg|xl):grid-cols/.test(cls)) continue;
      const m = cls.match(/grid-cols-([3-9]|1[0-2])/);
      if (!m) continue;
      const rect = el.getBoundingClientRect();
      const cols = cs.gridTemplateColumns.split(' ').length;
      const colW = cols ? Math.round(rect.width / cols) : 0;
      if (rect.width > 50 && colW < 130) issues.push({ cls, cols, colW });
    }
    return { len: all.length, issues: issues.slice(0, 3) };
  });
  console.log('OK', JSON.stringify(r));
} catch (e) {
  console.log('EVAL_ERR:', e.message);
}
await browser.close();
