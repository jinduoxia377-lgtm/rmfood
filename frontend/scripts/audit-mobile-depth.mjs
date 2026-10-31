/**
 * 移动端深度审计（mobile-auditor, 2026-10-22）
 * 视口 390×844, deviceScaleFactor 2, isMobile, hasTouch（Chromium）
 * 每路由独立 context + 复用登录 storageState。
 * 检测项：
 *  1) 横向溢出（scrollWidth > innerWidth，记录溢出宽度与主要溢出元素）
 *  2) 触控目标 < 44px（button/a/[role=button]/input/select/[role=tab]，排除极小装饰）
 *  3) 中文字号 < 12px（采样，去重）
 *  4) 元素重叠（elementFromPoint 中心点采样 + 高 z-index 悬浮层）
 *  5) console error / pageerror（前 5 条）
 *  6) 每页截图 → D:\RMFOODFP\screenshots\mobile-audit\
 * 输出：scripts/mobile-audit-data.json（候选问题，供二次验证脚本确认）
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const SHOT_DIR = 'D:\\RMFOODFP\\screenshots\\mobile-audit';
mkdirSync(SHOT_DIR, { recursive: true });

const STORAGE_PATH = path.join(__dirname, '.mobile-audit-storage.json');

const ROUTES = [
  { name: 'dashboard', route: '/dashboard' },
  { name: 'databases-graph', route: '/databases', tab: 'graph' },
  { name: 'formulas', route: '/formulas' },
  { name: 'experiments', route: '/experiments' },
  { name: 'settings', route: '/settings' },
  { name: 'analytics', route: '/analytics' },
  { name: 'organizations', route: '/organizations' },
  { name: 'notifications', route: '/notifications' },
  { name: 'stability', route: '/stability' },
  { name: 'ai', route: '/ai' },
];

const ONLY = (process.env.AUDIT_ONLY || '').trim();
const ROUTES_TO_AUDIT = ONLY
  ? ROUTES.filter((r) => r.name === ONLY || r.route === ONLY)
  : ROUTES;

const MOBILE_CTX = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: devices['iPhone 13'].userAgent,
};

const browser = await chromium.launch({ headless: true });

/* ── 登录一次，保存 storageState ─────────────────────────── */
async function loginOnce() {
  const ctx = await browser.newContext(MOBILE_CTX);
  const page = await ctx.newPage();
  for (let i = 1; i <= 3; i += 1) {
    try {
      await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 60000 });
      await page.waitForSelector('#rhine-username', { state: 'visible', timeout: 50000 });
      await page.fill('#rhine-username', 'admin');
      await page.fill('#rhine-password', 'admin123');
      await page.click('button.rhine-submit-btn');
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 40000 });
      await page.waitForTimeout(2000);
      await ctx.storageState({ path: STORAGE_PATH });
      console.log('[LOGIN] storageState saved');
      await ctx.close();
      return true;
    } catch (e) {
      console.log(`[LOGIN] attempt ${i} failed: ${String(e).slice(0, 160)}`);
      if (i < 3) await new Promise((r) => setTimeout(r, 20000));
    }
  }
  await ctx.close();
  return false;
}

/* ── 元素描述（selector 供复测） ─────────────────────────── */
function describeEl(el) {
  if (!el || !el.tagName) return '';
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = typeof el.className === 'string'
    ? el.className.split(/\s+/).filter(Boolean).slice(0, 4).map((c) => `.${c}`).join('')
    : '';
  return `${tag}${id}${cls}`.slice(0, 160);
}

/* ── 页面检测（在页面上下文中运行） ─────────────────────────── */
async function runPageChecks(page) {
  return page.evaluate(() => {
    function describeEl(el) {
      if (!el || !el.tagName) return '';
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string'
        ? el.className.split(/\s+/).filter(Boolean).slice(0, 4).map((c) => `.${c}`).join('')
        : '';
      return `${tag}${id}${cls}`.slice(0, 160);
    }

    const results = { overflow: null, touchTargets: [], smallFonts: [], overlays: [], centerTop: null };
    const vw = window.innerWidth;
    const doc = document.documentElement;
    const sw = doc.scrollWidth;
    if (sw > vw + 1) {
      results.overflow = { scrollWidth: sw, viewportWidth: vw, overflowPx: sw - vw };
    }

    // 1) 横向溢出：找出右边界超出视口的可见元素（主要贡献者）
    const offenders = [];
    const all = Array.from(document.querySelectorAll('body *'));
    for (const el of all) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (r.width < 2 || r.height < 2) continue;
      const overRight = r.right - vw;
      const overLeft = -r.left;
      if (overRight > 2 || overLeft > 2) {
        const depth = (() => { let d = 0, p = el.parentElement; while (p && d < 4) { d += 1; p = p.parentElement; } return d; })();
        offenders.push({
          sel: describeEl(el),
          tag: el.tagName.toLowerCase(),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          overRight: Math.round(overRight),
          overLeft: Math.round(overLeft),
          depth,
        });
      }
    }
    offenders.sort((a, b) => Math.max(b.overRight, b.overLeft) - Math.max(a.overRight, a.overLeft));
    const seenOff = new Set();
    results.overflowCulprits = offenders
      .filter((o) => { const k = o.sel; if (seenOff.has(k)) return false; seenOff.add(k); return true; })
      .slice(0, 8);

    // 2) 触控目标 < 44px
    const clickables = Array.from(document.querySelectorAll(
      'button, a, [role="button"], input, select, textarea, [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"], [role="radio"], label'
    ));
    const targets = [];
    const seenT = new Set();
    for (const el of clickables) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (r.width < 2 || r.height < 2) continue;
      // 必须在视口内（或部分可见）
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      // 排除极小装饰：两维都 < 14px 且无可访问名
      const text = (el.textContent || '').trim();
      const aria = el.getAttribute('aria-label') || el.getAttribute('title') || '';
      const placeholder = el.getAttribute('placeholder') || '';
      const accessible = (text || aria || placeholder || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA');
      if (r.width < 14 && r.height < 14 && !accessible) continue;
      if (!accessible) continue;
      const minDim = Math.min(r.width, r.height);
      const maxDim = Math.max(r.width, r.height);
      if (minDim >= 44) continue;
      // 排除纯装饰性小图标（无可访问名、无文本、非表单）
      const isFormCtrl = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
      if (!text && !aria && !placeholder && !isFormCtrl) continue;
      const key = `${el.tagName}|${(el.className || '').toString().slice(0, 60)}|${text.slice(0, 20)}|${Math.round(r.width)}x${Math.round(r.height)}`;
      if (seenT.has(key)) continue;
      seenT.add(key);
      targets.push({
        sel: describeEl(el),
        tag: el.tagName.toLowerCase(),
        text: text.slice(0, 40),
        aria: aria.slice(0, 40),
        width: Math.round(r.width),
        height: Math.round(r.height),
        minDim: Math.round(minDim),
      });
    }
    targets.sort((a, b) => a.minDim - b.minDim);
    results.touchTargets = targets.slice(0, 12);

    // 3) 中文字号 < 12px
    const small = [];
    const seenF = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    const cjk = /[\u4e00-\u9fff]/;
    while ((node = walker.nextNode())) {
      const t = node.textContent || '';
      if (!cjk.test(t)) continue;
      const el = node.parentElement;
      if (!el) continue;
      const cs = getComputedStyle(el);
      const fs = parseFloat(cs.fontSize);
      if (isNaN(fs) || fs >= 12) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const key = `${fs}|${(el.className || '').toString().slice(0, 60)}|${t.trim().slice(0, 16)}`;
      if (seenF.has(key)) continue;
      seenF.add(key);
      small.push({
        sel: describeEl(el),
        tag: el.tagName.toLowerCase(),
        fontSize: fs,
        text: t.trim().slice(0, 30),
        className: (el.className || '').toString().slice(0, 80),
      });
    }
    small.sort((a, b) => a.fontSize - b.fontSize);
    results.smallFonts = small.slice(0, 8);

    // 4) 元素重叠：中心点 elementFromPoint + 高 z-index 悬浮层
    const cx = Math.round(window.innerWidth / 2);
    const cy = Math.round(window.innerHeight / 2);
    const top = document.elementFromPoint(cx, cy);
    if (top) {
      const cs = getComputedStyle(top);
      results.centerTop = {
        sel: describeEl(top),
        tag: top.tagName.toLowerCase(),
        pos: cs.position,
        zIndex: cs.zIndex,
        isFixed: cs.position === 'fixed' || cs.position === 'sticky',
        className: (top.className || '').toString().slice(0, 100),
      };
    }
    // 高 z-index 悬浮层（fixed/absolute, z>=100, 可见，非导航骨架）
    const overlays = [];
    const seenO = new Set();
    const chrome = new Set(['HEADER', 'NAV', 'FOOTER', 'MAIN', 'BODY', 'HTML']);
    for (const el of all) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (cs.position !== 'fixed' && cs.position !== 'sticky' && cs.position !== 'absolute') continue;
      const z = parseInt(cs.zIndex, 10);
      if (isNaN(z) || z < 100) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 40) continue;
      if (chrome.has(el.tagName)) continue;
      // 是否遮住主内容区域（视口中心 ±150px 或覆盖 >25% 视口）
      const coversCenter = r.left < cx + 150 && r.right > cx - 150 && r.top < cy + 150 && r.bottom > cy - 150;
      const coversLarge = r.width > window.innerWidth * 0.25 && r.height > window.innerHeight * 0.25;
      if (!coversCenter && !coversLarge) continue;
      const inMain = !!el.closest('main');
      const key = `${el.tagName}|${(el.className || '').toString().slice(0, 60)}|${z}`;
      if (seenO.has(key)) continue;
      seenO.add(key);
      overlays.push({
        sel: describeEl(el),
        tag: el.tagName.toLowerCase(),
        pos: cs.position,
        zIndex: z,
        left: Math.round(r.left),
        top: Math.round(r.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
        text: (el.textContent || '').trim().slice(0, 40),
        inMain: !!inMain,
        pointerEvents: cs.pointerEvents,
      });
    }
    results.overlays = overlays.slice(0, 8);

    return results;
  });
}

/* ── 每个路由的审计 ─────────────────────────── */
async function auditRoute(routeDef) {
  const { name, route, tab } = routeDef;
  const attemptResults = [];
  let lastConsoleErrors = [];
  let lastPageErrors = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const ctx = await browser.newContext({ ...MOBILE_CTX, storageState: STORAGE_PATH });
    const page = await ctx.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    lastConsoleErrors = consoleErrors;
    lastPageErrors = pageErrors;
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
    });
    page.on('pageerror', (err) => pageErrors.push(String(err).slice(0, 300)));
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      // 若被踢回登录页则重试
      if (page.url().includes('/login')) {
        throw new Error('redirected to login');
      }
      // 等待路由主要内容出现
      await page.waitForSelector('main', { timeout: 20000 }).catch(() => {});

      if (tab === 'graph') {
        // Radix TabsTrigger 在 DOM 上暴露 role="tab"，用文本定位最稳
        const graphTab = page.getByRole('tab', { name: /知识图谱/ });
        await graphTab.first().click({ timeout: 25000 });
        await page.waitForTimeout(3500);
      }

      // 等待网络空闲片刻
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const checks = await runPageChecks(page);

      // 数据加载状态（供报告标注「数据未加载，仅审计框架」）
      const dataStatus = await page.evaluate(() => {
        const bodyText = (document.body.innerText || '').trim();
        const skeleton = document.querySelectorAll('.animate-pulse, [role="status"], .loading, .spinner').length;
        return {
          textLen: bodyText.length,
          skeletons: skeleton,
          hasMain: !!document.querySelector('main'),
          hasTable: !!document.querySelector('main table'),
          hasCard: !!document.querySelector('main .card, main [class*="card"]'),
          sample: bodyText.slice(0, 80),
        };
      });

      const shotPath = path.join(SHOT_DIR, `${name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      attemptResults.push({
        name,
        route,
        attempt,
        ok: true,
        checks,
        dataStatus,
        consoleErrors: consoleErrors.slice(0, 5),
        pageErrors: pageErrors.slice(0, 5),
        screenshot: shotPath,
      });
      return attemptResults[attemptResults.length - 1];
    } catch (e) {
      console.log(`[retry] ${name} attempt ${attempt} failed: ${String(e).slice(0, 160)}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 12000 + Math.random() * 8000));
    } finally {
      await ctx.close();
    }
  }
  return {
    name,
    route,
    attempt: 3,
    ok: false,
    error: '3 attempts failed',
    consoleErrors: lastConsoleErrors.slice(0, 5),
    pageErrors: lastPageErrors.slice(0, 5),
  };
}

/* ── 主流程 ─────────────────────────── */
const loginOk = await loginOnce();
if (!loginOk) {
  console.error('LOGIN_FAIL');
  process.exit(1);
}

// 合并到既有结果（支持 AUDIT_ONLY 增量审计）
const out = path.join(__dirname, 'mobile-audit-data.json');
let allResults = [];
try {
  const existing = JSON.parse(readFileSync(out, 'utf8'));
  if (Array.isArray(existing)) allResults = existing.filter((r) => !ROUTES_TO_AUDIT.some((rd) => rd.name === r.name));
} catch { /* 首次运行，无既有文件 */ }

for (const rd of ROUTES_TO_AUDIT) {
  const res = await auditRoute(rd);
  allResults.push(res);
  if (res.ok) {
    const c = res.checks;
    const overflow = c.overflow ? `OVERFLOW ${c.overflow.overflowPx}px` : 'overflow-ok';
    console.log(`[${res.name}] ${overflow} touch=${c.touchTargets.length} smallFont=${c.smallFonts.length} overlays=${c.overlays.length} errors=${res.consoleErrors.length + res.pageErrors.length}`);
  } else {
    console.log(`[${res.name}] FAILED: ${res.error}`);
  }
}

allResults.sort((a, b) => ROUTES.findIndex((r) => r.name === a.name) - ROUTES.findIndex((r) => r.name === b.name));
writeFileSync(out, JSON.stringify(allResults, null, 2), 'utf8');
console.log(`\n===== 审计完成 =====\n数据: ${out}\n截图目录: ${SHOT_DIR}`);
await browser.close();