// 用户管理页越界核查（一次性验证脚本，可复跑）
// 检查：桌面/移动端主内容区越界 + 固定抽屉位置 + 表格横向滚动兜底 + 截图
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://localhost:3000';
const OUT = 'D:\\RMFOODFP\\frontend\\test-screenshots';
fs.mkdirSync(OUT, { recursive: true });

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input#rhine-username', { timeout: 20000 });
  await page.fill('input#rhine-username', 'admin');
  await page.fill('input#rhine-password', 'admin123');
  const [resp] = await Promise.all([
    page.waitForResponse((r) => /\/api\/.*auth\/login/.test(r.url()), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  console.log('login response:', resp?.status());
  await page.waitForURL('**/dashboard**', { timeout: 25000 });
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  await login(page);
  await page.goto(`${BASE}/users`, { waitUntil: 'networkidle' });
  await page.waitForSelector('h1:has-text("用户管理")', { timeout: 15000 });
  await page.waitForTimeout(2500);

  const results = {};

  // ── 桌面 1440 ──
  results.desktop = await page.evaluate(() => {
    const main = document.querySelector('#main-content') || document.body;
    const bad = [];
    main.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > main.getBoundingClientRect().right + 2) {
        bad.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 80), right: Math.round(r.right) });
      }
    });
    const seen = new Set();
    const dedup = bad.filter((b) => { const k = b.cls + b.tag; if (seen.has(k)) return false; seen.add(k); return true; });
    const drawer = document.getElementById('main-drawer');
    let drawerInfo = null;
    if (drawer) {
      const dr = drawer.getBoundingClientRect();
      const cs = getComputedStyle(drawer);
      drawerInfo = { left: Math.round(dr.left), right: Math.round(dr.right), width: Math.round(dr.width), visibility: cs.visibility, inert: drawer.hasAttribute('inert'), pokesLeft: dr.left < -12 };
    }
    return { mainScroll: main.scrollWidth > main.clientWidth + 2, outOfMain: dedup.slice(0, 30), drawer: drawerInfo };
  });
  await page.screenshot({ path: `${OUT}/users-light.png` });

  // ── 移动端 375 ──
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(1200);
  results.mobile = await page.evaluate(() => {
    const vw = window.innerWidth;
    const main = document.querySelector('#main-content') || document.body;
    const out = { viewportWidth: vw, problems: [] };
    out.docScrolls = document.documentElement.scrollWidth > vw + 2;
    const scrollers = [...document.querySelectorAll('.overflow-x-auto')];
    out.tableScrollers = scrollers.map((s) => {
      const r = s.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), scrolls: s.scrollWidth > s.clientWidth + 2, pokesOut: r.right > vw + 2 };
    });
    const bad = [];
    main.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') return;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.right > vw + 2) bad.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 70), right: Math.round(r.right) });
    });
    const seen = new Set();
    out.outOfView = bad.filter((b) => { const k = b.cls + b.tag; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 25);
    return out;
  });
  await page.screenshot({ path: `${OUT}/users-mobile.png`, fullPage: false });
  await page.setViewportSize({ width: 1440, height: 900 });

  // ── 深色模式 ──
  await page.click('button[aria-label^="切换主题"]');
  await page.click('button[aria-label="深色模式"]');
  await page.waitForTimeout(1500);
  let isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if (!isDark) {
    await page.evaluate(() => {
      try {
        const raw = localStorage.getItem('rmfood-theme-storage');
        const obj = raw ? JSON.parse(raw) : { state: {}, version: 4 };
        obj.state.mode = 'dark';
        localStorage.setItem('rmfood-theme-storage', JSON.stringify(obj));
      } catch {}
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.goto(`${BASE}/users`, { waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("用户管理")', { timeout: 15000 });
    await page.waitForTimeout(2500);
    isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  }
  results.darkMode = { isDark };
  if (isDark) await page.screenshot({ path: `${OUT}/users-dark.png` });

  console.log(JSON.stringify(results, null, 2));
  console.log('pageerrors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
