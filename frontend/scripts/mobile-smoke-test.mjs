/**
 * 移动端交互冒烟测试（iPhone 13, 390×844）
 * 对关键页面执行：打开 → 等待加载 → 检查溢出/控制台错误 → 尝试点击主按钮或切换 Tab
 * 输出：console 报告 + scripts/mobile-smoke-report.txt
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];

const PAGES = [
  { name: 'dashboard', route: '/dashboard', action: '首个主按钮或统计卡' },
  { name: 'formulas', route: '/formulas', action: '视图切换或搜索' },
  { name: 'ai', route: '/ai', action: 'Tab/模型切换' },
  { name: 'databases', route: '/databases', action: 'Tab 切换' },
  { name: 'settings', route: '/settings', action: 'Tab 切换' },
  { name: 'users', route: '/users', action: '筛选/搜索' },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();
const report = [];
const consoleErrors = [];

page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 160)); });
page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR: ${String(err).slice(0, 160)}`));

async function login() {
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.fill('#rhine-username', 'admin');
      await page.fill('#rhine-password', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
      await page.waitForTimeout(1200);
      return true;
    } catch { /* retry */ }
  }
  return false;
}

console.log('LOGIN...');
const ok = await login();
if (!ok) { console.log('LOGIN_FAIL'); process.exit(1); }
console.log('LOGIN_OK');

for (const p of PAGES) {
  const errsBefore = consoleErrors.length;
  try {
    await page.goto(BASE + p.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2200);
    if (page.url().includes('/login')) { await login(); await page.goto(BASE + p.route, { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(2200); }

    const overflow = await page.evaluate(() => {
      const w = window.innerWidth;
      const sw = document.documentElement.scrollWidth;
      return { overflow: sw - w, vw: w };
    });

    // 尝试点击第一个可见 button（主操作）
    let clicked = 'none';
    try {
      const btns = await page.locator('main button:visible').count();
      if (btns > 0) {
        await page.locator('main button:visible').first().click({ timeout: 3000 });
        await page.waitForTimeout(800);
        clicked = `clicked button[0] of ${btns}`;
      } else {
        clicked = 'no button';
      }
    } catch { clicked = 'click skipped'; }

    const errsDuring = consoleErrors.slice(errsBefore);
    const status = overflow.overflow > 0 ? 'FAIL' : 'PASS';
    console.log(`[${status}] ${p.name} overflow=${overflow.overflow}px ${clicked} errors=${errsDuring.length}`);
    report.push(`${status} ${p.route}: overflow=${overflow.overflow}px; ${clicked}; consoleErrors=${errsDuring.length}`);
    if (errsDuring.length) {
      errsDuring.slice(0, 3).forEach((e) => report.push(`    ERR: ${e}`));
    }
  } catch (e) {
    console.log(`[ERR] ${p.name} ${String(e).slice(0, 120)}`);
    report.push(`ERR ${p.route}: ${String(e).slice(0, 120)}`);
  }
}

const out = path.join(__dirname, 'mobile-smoke-report.txt');
writeFileSync(out, report.join('\n') + `\n\n总控制台错误: ${consoleErrors.length}\n`, 'utf8');
console.log(`\n===== 冒烟测试完成 =====\n报告: ${out}\n总控制台错误: ${consoleErrors.length}`);
await browser.close();