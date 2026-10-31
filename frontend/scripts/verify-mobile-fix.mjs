/**
 * 移动端修复复测（mobile-fixer, 2026-10-22）
 * 视口 390×844, deviceScaleFactor 2, isMobile, hasTouch（Chromium）
 * 复测页面：/formulas（F-1）、/analytics（A-1/A-2/A-3）、/dashboard（D-1）、/stability（S-1）
 * 输出：D:\RMFOODFP\screenshots\mobile-fix\*.png
 * 运行：cd frontend && node scripts/verify-mobile-fix.mjs
 */
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const SHOT_DIR = 'D:\\RMFOODFP\\screenshots\\mobile-fix';
mkdirSync(SHOT_DIR, { recursive: true });

const STORAGE_PATH = path.join(__dirname, '.mobile-fix-storage.json');

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
      console.log(`[LOGIN] attempt ${i} failed: ${String(e).slice(0, 200)}`);
      if (i < 3) await new Promise((r) => setTimeout(r, 20000));
    }
  }
  await ctx.close();
  return false;
}

/* ── 检测页面横向溢出 ─────────────────────────── */
async function checkOverflow(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth;
    const sw = document.documentElement.scrollWidth;
    return {
      viewportWidth: vw,
      scrollWidth: sw,
      overflowPx: sw - vw,
      ok: sw <= vw + 1,
    };
  });
}

/* ── /formulas F-1 ─────────────────────────── */
async function checkFormulas(page) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    const mobileBlock = document.querySelector('div.lg\\:hidden');
    const blockRect = mobileBlock ? mobileBlock.getBoundingClientRect() : null;
    // 移动端筛选按钮（aria-label=打开筛选面板）
    const filterBtn = Array.from(document.querySelectorAll('button')).find(
      (b) => (b.getAttribute('aria-label') || '').includes('打开筛选面板') && !!b.closest('div.lg\\:hidden')
    );
    const btnRect = filterBtn ? filterBtn.getBoundingClientRect() : null;
    const input = mobileBlock ? mobileBlock.querySelector('input') : null;
    const inputRect = input ? input.getBoundingClientRect() : null;
    return {
      vw,
      blockFound: !!mobileBlock,
      block: blockRect ? {
        left: Math.round(blockRect.left),
        right: Math.round(blockRect.right),
        width: Math.round(blockRect.width),
        inViewport: blockRect.left >= -1 && blockRect.right <= vw + 1,
      } : null,
      filterBtnFound: !!filterBtn,
      filterBtn: btnRect ? {
        left: Math.round(btnRect.left),
        right: Math.round(btnRect.right),
        width: Math.round(btnRect.width),
        height: Math.round(btnRect.height),
        minDim: Math.round(Math.min(btnRect.width, btnRect.height)),
        inViewport: btnRect.left >= -1 && btnRect.right <= vw + 1,
      } : null,
      input: inputRect ? {
        left: Math.round(inputRect.left),
        right: Math.round(inputRect.right),
        width: Math.round(inputRect.width),
        inViewport: inputRect.left >= -1 && inputRect.right <= vw + 1,
      } : null,
    };
  });
  return r;
}

/* ── /analytics A-1/A-2/A-3 ─────────────────────────── */
async function checkAnalytics(page, consoleLogs) {
  const layout = await page.evaluate(async () => {
    const vw = window.innerWidth;
    const list = document.querySelector('[role="tablist"]');
    let tabInfo = null;
    if (list) {
      const cs = getComputedStyle(list);
      const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
      const lastTab = tabs[tabs.length - 1];
      const before = lastTab ? lastTab.getBoundingClientRect() : null;
      list.scrollLeft = list.scrollWidth;
      await new Promise((r) => setTimeout(r, 150));
      const after = lastTab ? lastTab.getBoundingClientRect() : null;
      tabInfo = {
        overflowX: cs.overflowX,
        scrollWidth: list.scrollWidth,
        clientWidth: list.clientWidth,
        scrollable: list.scrollWidth > list.clientWidth + 1,
        tabCount: tabs.length,
        lastTabText: lastTab ? (lastTab.textContent || '').trim() : '',
        lastTabBefore: before ? { left: Math.round(before.left), right: Math.round(before.right) } : null,
        lastTabAfter: after ? { left: Math.round(after.left), right: Math.round(after.right), inViewport: after.left >= -1 && after.right <= vw + 1 } : null,
      };
    }

    // 头部 icon-only 按钮（隐藏 sm:inline 文本：刷新 / 导出 CSV / 导出 JSON）
    const headerBtns = Array.from(document.querySelectorAll('button')).filter((b) => {
      const spans = Array.from(b.querySelectorAll('span'));
      return spans.some((s) => {
        const cls = s.className || '';
        return cls.includes('hidden') && cls.includes('sm:inline') && s.textContent.trim();
      });
    }).map((b) => {
      const txt = (b.textContent || '').trim();
      const r = b.getBoundingClientRect();
      return {
        text: txt.slice(0, 30),
        width: Math.round(r.width),
        height: Math.round(r.height),
        minDim: Math.round(Math.min(r.width, r.height)),
      };
    });

    // WS 资源时序（是否发起过 handshake）
    const wsResources = performance.getEntriesByType('resource')
      .filter((e) => e.initiatorType === 'websocket' || /analytics\/ws\/dashboard/.test(e.name))
      .map((e) => ({ name: e.name, initiatorType: e.initiatorType }));

    // 页面 WS 状态文案
    const bodyText = document.body.innerText || '';
    const wsStatus = bodyText.includes('实时') ? '实时' : bodyText.includes('轮询') ? '轮询' : bodyText.includes('连接中') ? '连接中' : '未知';

    return { vw, tabInfo, headerBtns, wsResources, wsStatus };
  });

  // A-3：直接探测后端 WS 端点（浏览器环境、携带 Cookie）
  let wsProbe = null;
  try {
    wsProbe = await page.evaluate(() => new Promise((resolve) => {
      const url = 'ws://localhost:8000/api/v1/analytics/ws/dashboard';
      let settled = false;
      const done = (result) => { if (!settled) { settled = true; resolve(result); } };
      try {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => { try { ws.close(); } catch {} done({ ok: false, stage: 'timeout' }); }, 6000);
        ws.onopen = () => { clearTimeout(timer); done({ ok: true, stage: 'open' }); };
        ws.onerror = () => { /* 等待 onclose 提供 code */ };
        ws.onclose = (e) => { clearTimeout(timer); done({ ok: false, stage: 'close', code: e.code, reason: e.reason }); };
      } catch (err) {
        done({ ok: false, stage: 'throw', error: String(err) });
      }
    }));
  } catch (err) {
    wsProbe = { ok: false, stage: 'evaluate-error', error: String(err).slice(0, 200) };
  }

  const wsErrorLogs = consoleLogs.filter((l) => /AnalyticsWS|WebSocket|analytics/i.test(l)).slice(0, 8);
  return { layout, wsProbe, wsErrorLogs };
}

/* ── /dashboard D-1 ─────────────────────────── */
async function checkDashboard(page) {
  return page.evaluate(() => {
    const targets = ['AI 就绪', '编辑布局', '导出数据', '刷新'];
    const btns = Array.from(document.querySelectorAll('button')).filter((b) => {
      const txt = (b.textContent || '').trim();
      return targets.some((t) => txt.includes(t));
    }).map((b) => {
      const r = b.getBoundingClientRect();
      return {
        text: (b.textContent || '').trim().slice(0, 30),
        width: Math.round(r.width),
        height: Math.round(r.height),
        minDim: Math.round(Math.min(r.width, r.height)),
        inViewport: r.left >= -1 && r.right <= window.innerWidth + 1,
      };
    });
    return { btns };
  });
}

/* ── /stability S-1 ─────────────────────────── */
async function checkStability(page) {
  return page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select')).map((s) => {
      const r = s.getBoundingClientRect();
      return {
        className: (s.className || '').toString().slice(0, 80),
        width: Math.round(r.width),
        height: Math.round(r.height),
        minDim: Math.round(Math.min(r.width, r.height)),
      };
    });
    return { selects };
  });
}

/* ── 页面复测（带重试） ─────────────────────────── */
async function verifyPage(name, route, checkFn, extra = {}) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const ctx = await browser.newContext({ ...MOBILE_CTX, storageState: STORAGE_PATH });
    const page = await ctx.newPage();
    const consoleLogs = [];
    const pageErrors = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') consoleLogs.push(`[${m.type()}] ${m.text()}`);
    });
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    try {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000);
      if (page.url().includes('/login')) throw new Error('redirected to login');
      await page.waitForSelector('main', { timeout: 25000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

      const overflow = await checkOverflow(page);
      const check = await checkFn(page, consoleLogs);
      const shotPath = path.join(SHOT_DIR, `${name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      await ctx.close();
      return { name, route, attempt, ok: true, overflow, check, consoleLogs: consoleLogs.slice(0, 8), pageErrors: pageErrors.slice(0, 3), screenshot: shotPath };
    } catch (e) {
      console.log(`[retry] ${name} attempt ${attempt} failed: ${String(e).slice(0, 180)}`);
      await ctx.close();
      if (attempt < 3) await new Promise((r) => setTimeout(r, 10000 + Math.random() * 8000));
    }
  }
  return { name, route, attempt: 3, ok: false, error: '3 attempts failed' };
}

/* ── 主流程 ─────────────────────────── */
const loginOk = await loginOnce();
if (!loginOk) {
  console.error('LOGIN_FAIL');
  process.exit(1);
}

const results = {};

// /formulas — F-1
const f = await verifyPage('formulas', '/formulas', checkFormulas);
results.formulas = f;
if (f.ok) {
  const c = f.check;
  console.log(`[formulas] overflow=${f.overflow.ok ? 'OK' : `FAIL(${f.overflow.overflowPx}px)`} block=${c.blockFound ? (c.block?.inViewport ? 'OK' : 'FAIL') : 'MISSING'} filterBtn=${c.filterBtn ? `${c.filterBtn.minDim}px ${c.filterBtn.inViewport ? 'inViewport' : 'OUT'}` : 'MISSING'}`);
}

// /analytics — A-1/A-2/A-3
const a = await verifyPage('analytics', '/analytics', checkAnalytics);
results.analytics = a;
if (a.ok) {
  const c = a.check;
  const t = c.layout.tabInfo;
  console.log(`[analytics] overflow=${a.overflow.ok ? 'OK' : `FAIL(${a.overflow.overflowPx}px)`} tablist=${t ? `scrollable=${t.scrollable} lastTab(${t.lastTabText}) after=${t.lastTabAfter ? (t.lastTabAfter.inViewport ? 'inViewport' : `OUT(${t.lastTabAfter.left},${t.lastTabAfter.right})`) : 'N/A'}` : 'MISSING'}`);
  console.log(`[analytics] headerBtns: ${c.layout.headerBtns.map((b) => `${b.text}=${b.minDim}px`).join(', ') || 'NONE'}`);
  console.log(`[analytics] wsStatus=${c.layout.wsStatus} wsProbe=${JSON.stringify(c.wsProbe)} wsErrorLogs=${c.wsErrorLogs.length}`);
}

// /dashboard — D-1
const d = await verifyPage('dashboard', '/dashboard', checkDashboard);
results.dashboard = d;
if (d.ok) {
  const c = d.check;
  console.log(`[dashboard] overflow=${d.overflow.ok ? 'OK' : `FAIL(${d.overflow.overflowPx}px)`} headerBtns: ${c.btns.map((b) => `${b.text}=${b.minDim}px`).join(', ') || 'NONE'}`);
}

// /stability — S-1
const s = await verifyPage('stability', '/stability', checkStability);
results.stability = s;
if (s.ok) {
  const c = s.check;
  console.log(`[stability] overflow=${s.overflow.ok ? 'OK' : `FAIL(${s.overflow.overflowPx}px)`} selects: ${c.selects.map((x) => `${x.height}px`).join(', ') || 'NONE'}`);
}

console.log('\n===== 复测完成 =====');
console.log('截图目录:', SHOT_DIR);
await browser.close();