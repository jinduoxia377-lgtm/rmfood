/**
 * 全路由移动端 100% 适配审计（375×812 模拟）
 * 覆盖公开页 + 全部主要业务页 + 详情页 + 深层页面
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 375, height: 812 };

const ROUTES = [
  // 公开
  '/login', '/landing', '/docs', '/api-docs', '/faqs', '/about', '/careers', '/privacy', '/terms',
  // 核心业务
  '/dashboard', '/formulas', '/formulas/new', '/formulas/templates', '/formulas/compare', '/formulas/cases', '/formulas/test',
  '/formulas/1', '/formulas/cases/1',
  '/experiments', '/experiments/new', '/experiments/calendar', '/experiments/1',
  '/batches', '/batches/1', '/trace/production',
  '/doe', '/stability', '/documents', '/compliance', '/label-check', '/ingredient-analysis', '/labels',
  '/ai', '/academic-report', '/databases', '/peptide-structure', '/regulations', '/terminology',
  '/workflows', '/agent', '/analytics', '/organizations', '/organizations/1', '/integrations',
  '/notifications', '/settings', '/users', '/audit-logs', '/billing', '/tokens', '/radix-demo', '/404',
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const page = await context.newPage();

async function login() {
  for (let i = 0; i < 3; i++) {
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

let overflowCount = 0;
const overflowPages = [];

async function audit(path) {
  try {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1600);
    // 若被重定向到登录，重登
    if (page.url().includes('/login')) {
      await login();
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1600);
    }
    const d = await page.evaluate(() => {
      const w = window.innerWidth;
      const docOverflow = document.documentElement.scrollWidth - w;
      const offenders = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > w + 2 || r.left < -2) {
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
            cls: (el.getAttribute('class') || '').slice(0, 80),
            right: Math.round(r.right), left: Math.round(r.left), width: Math.round(r.width),
          });
        }
      }
      return { isLogin: location.pathname === '/login', docOverflow, offenders: offenders.slice(0, 6) };
    });
    const ok = !d.isLogin && d.docOverflow <= 1 && d.offenders.length === 0;
    if (!ok) {
      overflowCount++;
      overflowPages.push({ path, ...d });
    }
    console.log(`[${ok ? 'ok' : 'ISSUE'}] ${path} overflow=${d.docOverflow} offenders=${d.offenders.length}${d.isLogin ? ' [redirected]' : ''}`);
    for (const o of d.offenders) console.log(`      - <${o.tag}> .${o.cls} right=${o.right} left=${o.left} w=${o.width}`);
  } catch (e) {
    console.log(`[ERR] ${path}: ${String(e.message).slice(0, 120)}`);
  }
}

const loggedIn = await login();
console.log(`登录状态: ${loggedIn}`);
for (const r of ROUTES) {
  if (!loggedIn && !['/login', '/landing', '/docs', '/api-docs', '/faqs', '/about', '/careers', '/privacy', '/terms'].includes(r)) continue;
  await audit(r);
}
console.log(`\n===== 汇总: 问题页面 ${overflowCount} =====`);
for (const p of overflowPages) {
  console.log(`ISSUE ${p.path}: overflow=${p.docOverflow} offenders=${p.offenders.length}${p.isLogin ? ' redirected' : ''}`);
  for (const o of p.offenders) console.log(`   <${o.tag}> .${o.cls} right=${o.right} w=${o.width}`);
}
await browser.close();