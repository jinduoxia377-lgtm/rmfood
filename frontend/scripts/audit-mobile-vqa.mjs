/**
 * 移动端「视觉规范」自动审查（iPhone 13, 390×844）
 * 检测桌面式布局残留（移动端观感不专业的具体来源）：
 *  1) 固定多列网格（grid-cols-3/4/5/6 无响应式前缀）且列宽过窄
 *  2) 双列表单字段（grid-cols-2 无 sm 前缀）在移动端过窄
 *  3) 页面顶部超大横幅（高度 >220px）
 *  4) 过大的内边距/间距（p-8/p-10/space-y-8）在移动端
 *  5) 非标题的超大字号文本（text-3xl 及以上）
 *  6) 固定宽度元素（w-[400px]+ / min-w-[500px]+）在移动端
 *  7) 非全宽表单控件（input/select 宽度 < 容器 70%）
 * 输出：scripts/mobile-vqa-data.json + console 摘要
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];

const ROUTES = [
  '/dashboard', '/formulas', '/formulas/new', '/experiments', '/experiments/new', '/batches',
  '/doe', '/stability', '/documents', '/compliance', '/label-check', '/ingredient-analysis',
  '/labels', '/ai', '/databases', '/regulations', '/terminology', '/workflows', '/agent',
  '/analytics', '/organizations', '/settings', '/users', '/audit-logs', '/billing',
  '/notifications', '/academic-report', '/peptide-structure', '/integrations', '/tokens',
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();

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

const results = [];

async function audit(route) {
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2200);
    if (page.url().includes('/login')) { await login(); await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(2200); }

    const data = await page.evaluate(() => {
      const issues = [];
      const all = Array.from(document.querySelectorAll('main *'));

      // 1) 固定多列网格（无响应式前缀）且列宽 < 130px
      const gridEls = all.filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.display !== 'grid') return false;
        const cls = (el.className || '').toString();
        const hasResp = /\b(xs|sm|md|lg|xl):grid-cols/.test(cls);
        return !hasResp && /grid-cols-([3-9]|1[0-2])/.test(cls);
      });
      for (const el of gridEls) {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const cols = cs.gridTemplateColumns.split(' ').length;
        const colW = cols ? Math.round(rect.width / cols) : 0;
        if (rect.width > 50 && colW < 130) {
          issues.push({ type: 'fixed-multi-col-grid', cls: (el.className || '').toString().slice(0, 120), cols, colW });
        }
      }

      // 2) 双列网格字段过窄（grid-cols-2 无 sm 前缀，列宽 <150）
      const twoCol = all.filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.display !== 'grid') return false;
        const cls = (el.className || '').toString();
        return !/\b(sm|md|lg):grid-cols/.test(cls) && /grid-cols-2/.test(cls);
      });
      for (const el of twoCol.slice(0, 8)) {
        const rect = el.getBoundingClientRect();
        const colW = Math.round(rect.width / 2);
        if (rect.width > 100 && colW < 150) {
          issues.push({ type: 'narrow-2col', cls: (el.className || '').toString().slice(0, 120), colW });
        }
      }

      // 3) 顶部超大横幅（第一个带背景色的 section/div，高度 >220px）
      const banner = all.find((el) => {
        const cs = getComputedStyle(el);
        const bg = cs.backgroundColor || '';
        const r = el.getBoundingClientRect();
        return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && r.height > 160 && r.width > 300;
      });
      if (banner) {
        const r = banner.getBoundingClientRect();
        const cs = getComputedStyle(banner);
        if (r.height > 220) {
          issues.push({ type: 'tall-banner', cls: (banner.className || '').toString().slice(0, 120), height: Math.round(r.height) });
        }
      }

      // 4) 过大的内边距/间距（移动端仍 p-8/p-10/space-y-8）
      all.filter((el) => {
        const cls = (el.className || '').toString();
        const r = el.getBoundingClientRect();
        return r.width > 100 && /(\bp-8\b|\bp-10\b|\bp-12\b|\bspace-y-8\b|\bspace-y-10\b)/.test(cls);
      }).slice(0, 3).forEach((el) => {
        issues.push({ type: 'oversized-padding', cls: (el.className || '').toString().slice(0, 120) });
      });

      // 5) 非标题超大字号（text-3xl/4xl/5xl，非 h1）
      all.filter((el) => {
        const cls = (el.className || '').toString();
        const tag = el.tagName;
        return !['H1', 'H2'].includes(tag) && /\btext-(3xl|4xl|5xl)\b/.test(cls) && el.getBoundingClientRect().width > 50;
      }).slice(0, 3).forEach((el) => {
        issues.push({ type: 'oversized-text', cls: (el.className || '').toString().slice(0, 120), text: (el.textContent || '').slice(0, 20) });
      });

      // 6) 固定宽度元素（w-[400px]+ 或 min-w-[500px]+）
      all.filter((el) => {
        const cls = (el.className || '').toString();
        return /w-\[(4\d\d|5\d\d|6\d\d)px\]|min-w-\[(4\d\d|5\d\d|6\d\d|7\d\d|8\d\d|9\d\d)px\]/.test(cls);
      }).slice(0, 3).forEach((el) => {
        issues.push({ type: 'fixed-wide', cls: (el.className || '').toString().slice(0, 120) });
      });

      // 7) 非全宽表单控件（input/select/textarea 宽度 < 容器 70%）
      all.filter((el) => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)).slice(0, 10).forEach((el) => {
        const r = el.getBoundingClientRect();
        const parent = el.parentElement;
        if (!parent) return;
        const pr = parent.getBoundingClientRect();
        if (pr.width > 100 && r.width > 0 && r.width / pr.width < 0.65) {
          issues.push({ type: 'non-fullwidth-input', cls: (el.className || '').toString().slice(0, 100), ratio: Math.round(r.width / pr.width * 100) });
        }
      });

      // 去重（按 type+cls）
      const seen = new Set();
      const uniq = issues.filter((i) => {
        const k = `${i.type}|${i.cls}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      return { vw: window.innerWidth, issues: uniq.slice(0, 15) };
    });

    results.push({ route, ...data, issueCount: data.issues.length });
    console.log(`[${data.issues.length ? '!' : 'ok'}] ${route} issues=${data.issues.length}`);
    for (const i of data.issues.slice(0, 6)) {
      console.log(`      ${i.type} ${i.cls}${i.colW ? ` colW=${i.colW}px` : ''}${i.height ? ` h=${i.height}` : ''}${i.ratio ? ` ratio=${i.ratio}%` : ''}`);
    }
  } catch (e) {
    results.push({ route, error: String(e).slice(0, 80), issueCount: 0 });
    console.log(`[ERR] ${route} ${String(e).slice(0, 80)}`);
  }
}

const ok = await login();
if (!ok) { console.log('LOGIN_OK=false'); process.exit(1); }
console.log('LOGIN_OK=true');

for (const r of ROUTES) await audit(r);

writeFileSync(path.join(__dirname, 'mobile-vqa-data.json'), JSON.stringify(results, null, 2), 'utf8');
const withIssues = results.filter((r) => (r.issueCount || 0) > 0);
console.log(`\n===== 汇总 =====\n页面=${results.length} 有问题=${withIssues.length}`);
for (const r of withIssues) console.log(`  ${r.route}: ${r.issueCount} 项`);
await browser.close();