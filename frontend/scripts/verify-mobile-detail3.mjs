/**
 * verify-mobile-detail3.mjs — 仅针对 /users 与 /academic-report：
 * 25s 等待 + 捕获 console/pageerror，判断是真实空白页还是 dev 慢编译。
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 200)}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));

let loggedIn = false;
for (let i = 0; i < 6; i += 1) {
  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('#rhine-username', 'admin');
    await page.fill('#rhine-password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.waitForTimeout(2000);
    loggedIn = true;
    break;
  } catch (e) { console.log(`login retry ${i + 1}`); await page.waitForTimeout(3000); }
}

const results = [];
for (const route of ['/users', '/academic-report']) {
  const entry = { route };
  errors.length = 0;
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(25000);
    entry.state = await page.evaluate(() => ({
      url: location.pathname,
      bodyText: (document.body?.innerText || '').slice(0, 120),
      mainCount: document.querySelectorAll('main').length,
      hasOutlet: !!document.querySelector('#main-content'),
      loadingText: (document.body?.innerText || '').includes('加载') || (document.body?.innerText || '').includes('Loading'),
    }));
    entry.errors = errors.slice(0, 5);
    console.log(`[${entry.state.mainCount ? 'ok' : '!!'}] ${route} main=${entry.state.mainCount} text="${entry.state.bodyText}" errors=${errors.length}`);
    for (const e of errors.slice(0, 3)) console.log(`    ${e}`);
  } catch (e) {
    entry.error = String(e).slice(0, 120);
    console.log(`[ERR] ${route} ${entry.error}`);
  }
  results.push(entry);
}
writeFileSync(path.join(__dirname, 'mobile-detail-verified3.json'), JSON.stringify(results, null, 2), 'utf8');
await browser.close();