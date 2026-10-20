/**
 * 移动端横向溢出审计（补充版）
 * - 使用 domcontentloaded 避免 websocket 长连接导致 networkidle 超时
 * - 检测到被重定向到 /login 时自动重新登录
 * - 覆盖上一轮因会话过期漏测的路由 + 详情页
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 375, height: 812 };
const USER = 'admin';
const PASS = 'admin123';

const ROUTES = [
  '/dashboard',
  '/regulations', '/terminology', '/workflows',
  '/formulas/cases', '/formulas/test',
  '/formulas/1', '/experiments/1', '/batches/1', '/organizations/1',
  '/trace/production',
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();

async function login() {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('#rhine-username', USER);
  await page.fill('#rhine-password', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function audit(path) {
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    // 若被重定向到登录页，重新登录后再试一次
    if (page.url().includes('/login')) {
      await login();
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
    }
    const data = await page.evaluate(() => {
      const w = window.innerWidth;
      const docOverflow = document.documentElement.scrollWidth - w;
      const bodyOverflow = document.body ? document.body.scrollWidth - w : 0;
      const offenders = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const overRight = r.right - w;
        const overLeft = -r.left;
        if (overRight > 2 || overLeft > 2) {
          let p = el.parentElement;
          let insideScroll = false;
          while (p && p !== document.body) {
            const cs = getComputedStyle(p);
            if (/(auto|scroll|hidden|clip)/.test(cs.overflowX)) { insideScroll = true; break; }
            p = p.parentElement;
          }
          if (insideScroll) continue;
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute('class') || '').slice(0, 90),
            id: (el.getAttribute('id') || '').slice(0, 40),
            right: Math.round(r.right),
            left: Math.round(r.left),
            width: Math.round(r.width),
          });
        }
      }
      offenders.sort((a, b) => (b.right - w) - (a.right - w));
      return {
        url: location.pathname,
        isLogin: location.pathname === '/login',
        docOverflow,
        bodyOverflow,
        offenderCount: offenders.length,
        offenders: offenders.slice(0, 8),
      };
    });
    console.log(
      `[${data.isLogin ? 'REDIRECTED' : data.docOverflow > 1 || data.offenderCount > 0 ? 'OVERFLOW' : 'ok'}] ${path} ` +
      `-> ${data.url} docOverflow=${data.docOverflow} bodyOverflow=${data.bodyOverflow} offenders=${data.offenderCount}`,
    );
    for (const o of data.offenders.slice(0, 5)) {
      console.log(`      - <${o.tag}${o.id ? '#' + o.id : ''}> .${o.cls} right=${o.right} left=${o.left} w=${o.width}`);
    }
    if (data.docOverflow > 1 || data.offenderCount > 0) {
      await page.screenshot({ path: `test-screenshots/mobile-audit2-${path.replace(/\//g, '_')}.png` });
    }
  } catch (e) {
    console.log(`[ERR] ${path}: ${String(e.message).slice(0, 160)}`);
  }
}

await login();
for (const r of ROUTES) await audit(r);
await browser.close();