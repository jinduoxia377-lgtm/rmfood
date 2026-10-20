/**
 * 移动端横向溢出审计脚本（375×812 模拟 iPhone）
 * 用法: node scripts/audit-mobile-overflow.mjs
 * 对每个路由检测 documentElement.scrollWidth 是否超过视口宽度，
 * 并列出右边界超出视口的元素（排除位于 overflow-x-auto 容器内的元素）。
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 375, height: 812 };

const PUBLIC_ROUTES = [
  '/login', '/landing', '/docs', '/api-docs', '/faqs', '/about', '/careers', '/privacy', '/terms',
];

const AUTH_ROUTES = [
  '/dashboard', '/formulas', '/formulas/new', '/formulas/templates', '/formulas/compare',
  '/experiments', '/experiments/calendar', '/doe', '/stability', '/documents',
  '/compliance', '/label-check', '/ingredient-analysis', '/labels',
  '/ai', '/academic-report', '/databases', '/peptide-structure', '/regulations', '/terminology',
  '/workflows', '/agent', '/analytics', '/organizations', '/integrations',
  '/notifications', '/settings', '/users', '/audit-logs', '/billing', '/batches',
];

const CREDENTIALS = [
  ['admin', 'admin123'],
  ['admin', 'Admin@123456'],
  ['admin', 'rmfood2024!@#'],
  ['admin', 'Test@123456'],
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: VIEWPORT,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const results = [];

async function audit(path) {
  try {
    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
    // 等待懒加载/动画稳定
    await page.waitForTimeout(1800);
    const data = await page.evaluate(() => {
      const w = window.innerWidth;
      const docEl = document.documentElement;
      const bodyEl = document.body;
      const docOverflow = docEl.scrollWidth - w;
      const bodyOverflow = bodyEl ? bodyEl.scrollWidth - w : 0;
      // 找出右边界超出视口的元素（排除滚动容器内部元素）
      const offenders = [];
      const all = Array.from(document.querySelectorAll('body *'));
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const overRight = r.right - w;
        const overLeft = -r.left;
        if (overRight > 2 || overLeft > 2) {
          // 检查是否位于 overflow-x 容器内（内部滚动不算页面溢出）
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
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
          });
        }
      }
      offenders.sort((a, b) => (b.right - w) - (a.right - w));
      return {
        url: location.pathname,
        innerWidth: w,
        docOverflow,
        bodyOverflow,
        offenderCount: offenders.length,
        offenders: offenders.slice(0, 10),
      };
    });
    results.push(data);
    if (data.docOverflow > 1 || data.offenderCount > 0) {
      await page.screenshot({ path: `test-screenshots/mobile-audit-${path.replace(/\//g, '_')}.png`, fullPage: false });
    }
  } catch (e) {
    results.push({ url: path, error: String(e.message).slice(0, 200) });
  }
}

// 登录
let loggedIn = false;
for (const [u, p] of CREDENTIALS) {
  try {
    await page.goto(BASE + '/login', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#rhine-username', u);
    await page.fill('#rhine-password', p);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    console.log(`LOGIN OK: ${u} / ${p}`);
    loggedIn = true;
    break;
  } catch {
    console.log(`LOGIN FAIL: ${u}`);
  }
}

if (!loggedIn) {
  console.log('无法登录，仅审计公开路由');
} else {
  await page.waitForTimeout(2500);
  // 先审计 dashboard
  await audit('/dashboard');
}

for (const r of PUBLIC_ROUTES) await audit(r);
if (loggedIn) {
  for (const r of AUTH_ROUTES) {
    if (r === '/dashboard') continue;
    await audit(r);
  }
}

console.log('\n===== 审计结果 =====');
for (const r of results) {
  if (r.error) {
    console.log(`[ERR] ${r.url}: ${r.error}`);
  } else {
    console.log(
      `[${r.docOverflow > 1 || r.offenderCount > 0 ? 'OVERFLOW' : 'ok'}] ${r.url} ` +
      `docOverflow=${r.docOverflow} bodyOverflow=${r.bodyOverflow} offenders=${r.offenderCount}`,
    );
    if (r.offenders?.length) {
      for (const o of r.offenders.slice(0, 5)) {
        console.log(`      - <${o.tag}${o.id ? '#' + o.id : ''}> .${o.cls} right=${o.right} left=${o.left} w=${o.width}`);
      }
    }
  }
}

await browser.close();