/** 定位嵌套 button 与非法 DOM 属性 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();

const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error') logs.push(m.text());
});
page.on('pageerror', (e) => logs.push(String(e.message)));

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
try { await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }); } catch {}
await page.waitForTimeout(1500);

await page.goto(BASE + '/ai', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(3500);

// 找到嵌套 button
const nested = await page.evaluate(() => {
  const results = [];
  for (const outer of Array.from(document.querySelectorAll('button'))) {
    const inner = outer.querySelector('button');
    if (inner) {
      results.push({
        outerClass: (outer.className || '').slice(0, 100),
        outerText: (outer.textContent || '').trim().slice(0, 60),
        innerClass: (inner.className || '').slice(0, 100),
        innerText: (inner.textContent || '').trim().slice(0, 60),
      });
    }
  }
  return results.slice(0, 10);
});
console.log('嵌套 button 数量:', nested.length);
for (const n of nested) console.log(JSON.stringify(n));

// 找非法属性
const badProps = await page.evaluate(() => {
  const results = [];
  for (const el of Array.from(document.querySelectorAll('*'))) {
    if (el.hasAttribute('animationtype')) results.push({ tag: el.tagName, attr: 'animationtype', cls: (el.className || '').slice(0, 60) });
    if (el.hasAttribute('circular')) results.push({ tag: el.tagName, attr: 'circular', cls: (el.className || '').slice(0, 60) });
  }
  return results.slice(0, 10);
});
console.log('非法属性元素数量:', badProps.length);
for (const b of badProps) console.log(JSON.stringify(b));

console.log('--- 控制台错误 ---');
for (const l of logs.slice(0, 10)) console.log(l.slice(0, 300));
await browser.close();