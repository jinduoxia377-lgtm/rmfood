/**
 * 移动端「视觉规范」全路由审查 v3（iPhone 13, 390×844）
 * 每路由独立 browser context，避免单页崩溃连累后续。
 * 检测：
 *  1) 真实品牌横幅过高（surface-primary / bg-primary / gradient 背景 >220px）
 *  2) 固定多列网格（无响应式前缀，列宽 <130px）
 *  3) 双列网格过窄（列宽 <150px）
 *  4) 非全宽表单控件（< 容器 60%）
 *  5) 过大内边距/间距（p-8+/space-y-8+，无响应式前缀）
 *  6) 固定宽残留（w-[400px]+ / min-w-[500px]+，无响应式前缀）
 * 输出：scripts/mobile-vqa3-data.json + console 摘要
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];

const ROUTES = (process.env.VQA_ROUTES || '').split(',').filter(Boolean).length > 0
  ? process.env.VQA_ROUTES.split(',')
  : [
      '/dashboard', '/formulas', '/formulas/new', '/formulas/templates', '/formulas/compare', '/formulas/cases', '/formulas/test',
      '/formulas/1', '/formulas/cases/1',
      '/experiments', '/experiments/new', '/experiments/calendar', '/experiments/1',
      '/batches', '/batches/1', '/trace/production',
      '/doe', '/stability', '/documents', '/compliance', '/label-check', '/ingredient-analysis', '/labels',
      '/ai', '/academic-report', '/databases', '/peptide-structure', '/regulations', '/terminology',
      '/workflows', '/agent', '/analytics', '/organizations', '/organizations/1', '/integrations',
      '/notifications', '/settings', '/users', '/audit-logs', '/billing', '/tokens', '/radix-demo', '/404',
      '/login', '/landing', '/docs', '/api-docs', '/faqs', '/about', '/careers', '/privacy', '/terms',
    ];

const browser = await chromium.launch({ headless: true });

async function login(page) {
  for (let i = 0; i < 3; i += 1) {
    try {
      await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.fill('#rhine-username', 'admin');
      await page.fill('#rhine-password', 'admin123');
      await page.click('button[type="submit"]');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
      await page.waitForTimeout(1000);
      return true;
    } catch { /* retry */ }
  }
  return false;
}

const results = [];

async function audit(route) {
  const context = await browser.newContext({ ...iPhone13 });
  const page = await context.newPage();
  let data;
  try {
    if (!['/login', '/landing', '/docs', '/api-docs', '/faqs', '/about', '/careers', '/privacy', '/terms', '/404'].includes(route)) {
      await login(page);
    }
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2000);

    data = await page.evaluate(() => {
      const issues = [];
      const all = Array.from(document.querySelectorAll('main *'));

      // 1) 真实品牌横幅
      const banner = all.find((el) => {
        const cs = getComputedStyle(el);
        const bg = cs.backgroundColor || '';
        const cls = (el.className || '').toString();
        const r = el.getBoundingClientRect();
        const isBrand = /surface-primary|bg-primary|bg-gradient-to-|bg-\[var\(--color-primary\)\]/.test(cls) || /rgb\((4, 120, 87)|(5, 150, 105)\)/.test(bg);
        return isBrand && r.height > 220 && r.width > 300;
      });
      if (banner) {
        const r = banner.getBoundingClientRect();
        issues.push({ type: 'tall-brand-banner', cls: (banner.className || '').toString().slice(0, 120), height: Math.round(r.height) });
      }

      // 2) 固定多列网格
      for (const el of all) {
        const cs = getComputedStyle(el);
        if (cs.display !== 'grid') continue;
        const cls = (el.className || '').toString();
        if (/\b(xs|sm|md|lg|xl):grid-cols/.test(cls)) continue;
        if (!/grid-cols-([3-9]|1[0-2])/.test(cls)) continue;
        const rect = el.getBoundingClientRect();
        const cols = cs.gridTemplateColumns.split(' ').length;
        const colW = cols ? Math.round(rect.width / cols) : 0;
        if (rect.width > 50 && colW < 130) issues.push({ type: 'fixed-multi-col-grid', cls: cls.slice(0, 120), colW });
      }

      // 3) 双列网格过窄
      for (const el of all) {
        const cs = getComputedStyle(el);
        if (cs.display !== 'grid') continue;
        const cls = (el.className || '').toString();
        if (/\b(sm|md|lg):grid-cols/.test(cls)) continue;
        if (!/grid-cols-2/.test(cls)) continue;
        const rect = el.getBoundingClientRect();
        const colW = Math.round(rect.width / 2);
        if (rect.width > 100 && colW < 150) issues.push({ type: 'narrow-2col', cls: cls.slice(0, 120), colW });
      }

      // 4) 非全宽输入
      for (const el of all) {
        if (!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) continue;
        const r = el.getBoundingClientRect();
        const parent = el.parentElement;
        if (!parent) continue;
        const pr = parent.getBoundingClientRect();
        if (pr.width > 120 && r.width > 0 && r.width / pr.width < 0.6) issues.push({ type: 'non-fullwidth-input', cls: (el.className || '').toString().slice(0, 100), ratio: Math.round(r.width / pr.width * 100) });
      }

      // 5) 过大内边距
      for (const el of all) {
        const cls = (el.className || '').toString();
        if (/\b(sm|md|lg|xl):(p-8|p-10|space-y-8|space-y-10)/.test(cls)) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 100 && /\b(p-8|p-10|p-12|space-y-8|space-y-10)\b/.test(cls)) issues.push({ type: 'oversized-padding', cls: cls.slice(0, 120) });
      }

      // 6) 固定宽残留
      for (const el of all) {
        const cls = (el.className || '').toString();
        if (/\b(sm|md|lg|xl):(w-\[|min-w-\[)/.test(cls)) continue;
        if (/w-\[(4\d\d|5\d\d|6\d\d|7\d\d)px\]|min-w-\[(5\d\d|6\d\d|7\d\d|8\d\d|9\d\d)px\]/.test(cls)) issues.push({ type: 'fixed-wide', cls: cls.slice(0, 120) });
      }

      const seen = new Set();
      return issues.filter((i) => {
        const k = `${i.type}|${i.cls}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 12);
    });

    results.push({ route, issues: data, issueCount: data.length });
    if (data.length) {
      console.log(`[!] ${route} issues=${data.length}`);
      for (const i of data.slice(0, 6)) console.log(`      ${i.type} ${i.cls}${i.colW ? ` colW=${i.colW}` : ''}${i.height ? ` h=${i.height}` : ''}${i.ratio ? ` ratio=${i.ratio}%` : ''}`);
    } else {
      console.log(`[ok] ${route}`);
    }
  } catch (e) {
    results.push({ route, error: String(e).slice(0, 150), issueCount: -1 });
    console.log(`[ERR] ${route} :: ${String(e).slice(0, 150)}`);
  } finally {
    await context.close();
  }
}

for (const r of ROUTES) await audit(r);
writeFileSync(path.join(__dirname, 'mobile-vqa3-data.json'), JSON.stringify(results, null, 2), 'utf8');
const bad = results.filter((r) => (r.issueCount || 0) > 0);
const err = results.filter((r) => r.issueCount === -1);
console.log(`\n===== 汇总 =====\n页面=${results.length} 有问题=${bad.length} 异常=${err.length}`);
for (const r of bad) console.log(`  ${r.route}: ${r.issueCount} 项`);
await browser.close();