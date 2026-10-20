/**
 * 绉诲姩绔€岃瑙夎鑼冦€嶅叏璺敱瀹℃煡 v2锛坕Phone 13, 390脳844锛? * 瑕嗙洊 54 璺敱銆傛娴嬶細
 *  1) 鐪熷疄鍝佺墝妯箙杩囬珮锛坰urface-primary / bg-primary / gradient 鑳屾櫙瀹瑰櫒 >220px锛? *  2) 鍥哄畾澶氬垪缃戞牸锛堟棤鍝嶅簲寮忓墠缂€锛屽垪瀹?<130px锛? *  3) 鍙屽垪缃戞牸杩囩獎锛堝垪瀹?<150px锛? *  4) 闈炲叏瀹借〃鍗曟帶浠讹紙input/select/textarea < 瀹瑰櫒 65%锛? *  5) 杩囧ぇ鍐呰竟璺?闂磋窛锛坧-8+/space-y-8+锛屾棤鍝嶅簲寮忓墠缂€锛? *  6) 鍥哄畾瀹芥闈㈡畫鐣欙紙w-[400px]+ / min-w-[500px]+锛屾棤鍝嶅簲寮忓墠缂€锛? * 杈撳嚭锛歴cripts/mobile-vqa2-data.json + console 鎽樿
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];

const ROUTES = [
  '/dashboard', '/users', '/batches',
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
    await page.waitForTimeout(1800);
    if (page.url().includes('/login')) { await login(); await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 }); await page.waitForTimeout(1800); }

    const data = await page.evaluate(() => {
      const issues = [];
      const all = Array.from(document.querySelectorAll('main *'));

      // 1) 鐪熷疄鍝佺墝妯箙杩囬珮
      const banner = all.find((el) => {
        const cs = getComputedStyle(el);
        const bg = cs.backgroundColor || '';
        const cls = (el.className || '').toString();
        const r = el.getBoundingClientRect();
        const isBrandBanner = /surface-primary|bg-primary|bg-gradient-to-|bg-\[var\(--color-primary\)\]|bg-emerald/.test(cls) || /rgb\(4, 120, 87\)|rgb\(5, 150, 105\)/.test(bg);
        return isBrandBanner && r.height > 220 && r.width > 300;
      });
      if (banner) {
        const r = banner.getBoundingClientRect();
        issues.push({ type: 'tall-brand-banner', cls: (banner.className || '').toString().slice(0, 120), height: Math.round(r.height) });
      }

      // 2) 鍥哄畾澶氬垪缃戞牸锛堟棤鍝嶅簲寮忓墠缂€锛屽垪瀹?<130锛?      for (const el of all) {
        const cs = getComputedStyle(el);
        if (cs.display !== 'grid') continue;
        const cls = (el.className || '').toString();
        if (/\b(xs|sm|md|lg|xl):grid-cols/.test(cls)) continue;
        const m = cls.match(/grid-cols-([3-9]|1[0-2])/);
        if (!m) continue;
        const rect = el.getBoundingClientRect();
        const cols = cs.gridTemplateColumns.split(' ').length;
        const colW = cols ? Math.round(rect.width / cols) : 0;
        if (rect.width > 50 && colW < 130) {
          issues.push({ type: 'fixed-multi-col-grid', cls: cls.slice(0, 120), cols, colW });
        }
      }

      // 3) 鍙屽垪缃戞牸杩囩獎
      for (const el of all) {
        const cs = getComputedStyle(el);
        if (cs.display !== 'grid') continue;
        const cls = (el.className || '').toString();
        if (/\b(sm|md|lg):grid-cols/.test(cls)) continue;
        if (!/grid-cols-2/.test(cls)) continue;
        const rect = el.getBoundingClientRect();
        const colW = Math.round(rect.width / 2);
        if (rect.width > 100 && colW < 150) {
          issues.push({ type: 'narrow-2col', cls: cls.slice(0, 120), colW });
        }
      }

      // 4) 闈炲叏瀹借〃鍗曟帶浠?      for (const el of all.slice(0, 3000)) {
        if (!/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) continue;
        const r = el.getBoundingClientRect();
        const parent = el.parentElement;
        if (!parent) continue;
        const pr = parent.getBoundingClientRect();
        if (pr.width > 120 && r.width > 0 && r.width / pr.width < 0.6) {
          issues.push({ type: 'non-fullwidth-input', cls: (el.className || '').toString().slice(0, 100), ratio: Math.round(r.width / pr.width * 100) });
        }
      }

      // 5) 杩囧ぇ鍐呰竟璺?闂磋窛锛堟棤鍝嶅簲寮忓墠缂€锛?      for (const el of all.slice(0, 3000)) {
        const cls = (el.className || '').toString();
        if (/\b(sm|md|lg|xl):(p-8|p-10|space-y-8|space-y-10)/.test(cls)) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 100 && /\b(p-8|p-10|p-12|space-y-8|space-y-10)\b/.test(cls)) {
          issues.push({ type: 'oversized-padding', cls: cls.slice(0, 120) });
        }
      }

      // 6) 鍥哄畾瀹芥畫鐣欙紙鏃犲搷搴斿紡鍓嶇紑锛?      for (const el of all.slice(0, 3000)) {
        const cls = (el.className || '').toString();
        if (/\b(sm|md|lg|xl):(w-\[|min-w-\[)/.test(cls)) continue;
        if (/w-\[(4\d\d|5\d\d|6\d\d|7\d\d)px\]|min-w-\[(5\d\d|6\d\d|7\d\d|8\d\d|9\d\d)px\]/.test(cls)) {
          issues.push({ type: 'fixed-wide', cls: cls.slice(0, 120) });
        }
      }

      // 鍘婚噸
      const seen = new Set();
      return issues.filter((i) => {
        const k = `${i.type}|${i.cls}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).slice(0, 12);
    });

    results.push({ route, ...data, issueCount: data.issues.length });
    if (data.issues.length) {
      console.log(`[!] ${route} issues=${data.issues.length}`);
      for (const i of data.issues.slice(0, 8)) {
        console.log(`      ${i.type} ${i.cls}${i.colW ? ` colW=${i.colW}px` : ''}${i.height ? ` h=${i.height}` : ''}${i.ratio ? ` ratio=${i.ratio}%` : ''}`);
      }
    } else {
      console.log(`[ok] ${route}`);
    }
  } catch (e) {
    results.push({ route, error: String(e).slice(0, 80), issueCount: 0 });
    console.log(`[ERR] ${route}`);
  }
}

const ok = await login();
if (!ok) { console.log('LOGIN_OK=false'); process.exit(1); }
console.log('LOGIN_OK=true');

for (const r of ROUTES) await audit(r);

writeFileSync(path.join(__dirname, 'mobile-vqa2-data.json'), JSON.stringify(results, null, 2), 'utf8');
const withIssues = results.filter((r) => (r.issueCount || 0) > 0);
console.log(`\n===== 姹囨€?=====\n椤甸潰=${results.length} 鏈夐棶棰?${withIssues.length}`);
for (const r of withIssues) console.log(`  ${r.route}: ${r.issueCount} 椤筦);
await browser.close();
