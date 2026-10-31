/**
 * verify-mobile-detail.mjs — 一次性登录复测助手（仅核查，不改源码）
 * 背景：audit-mobile-detail.mjs 每条路由新建 context 重新登录，
 *       多次快速登录导致部分路由未认证即被重定向到 /login（无 <main>），
 *       产生 no-margin / btnTotal=0 假象。
 * 本脚本：单 context 登录一次 → 顺序访问 30 主路由（等待 4s 懒加载），
 *       精确测量 main 是否存在、按钮 <40px 明细、文本溢出分类
 *       （容器级横向滚动 vs 真实叶子截断）、页面左右边距。
 * 输出：scripts/mobile-detail-verified.json + console 摘要
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

const results = [];

// 登录一次
let loggedIn = false;
for (let i = 0; i < 5; i += 1) {
  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('#rhine-username', 'admin');
    await page.fill('#rhine-password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25000 });
    await page.waitForTimeout(1500);
    loggedIn = true;
    break;
  } catch (e) {
    console.log(`login retry ${i + 1}: ${String(e).slice(0, 60)}`);
    await page.waitForTimeout(2000);
  }
}

async function audit(route) {
  const entry = { route };
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);

    const data = await page.evaluate(() => {
      const out = {
        onLogin: location.pathname.startsWith('/login'),
        url: location.pathname,
        vw: window.innerWidth,
        mainCount: document.querySelectorAll('main').length,
        mainPad: null,
        mainCls: '',
        contentPad: null,
        firstMargin: null,
        btnTotal: 0,
        smallBtns: [],
        overflowTotal: 0,
        containerScroll: 0,
        realTruncation: [],
        intentionalTruncate: 0,
      };

      const main = document.querySelector('main');
      if (!main) return out;

      const mcs = getComputedStyle(main);
      out.mainPad = parseInt(mcs.paddingLeft || '0', 10);
      out.mainCls = (main.className || '').toString().slice(0, 120);

      // 首个可见内容子元素的 margin + 自身 padding（判断内容容器是否有 px 内边距）
      const child = Array.from(main.children).find((el) => el.getBoundingClientRect().width > 100);
      if (child) {
        const ccs = getComputedStyle(child);
        out.firstMargin = parseInt(ccs.marginLeft || '0', 10);
        out.contentPad = parseInt(ccs.paddingLeft || '0', 10);
      }

      // 按钮 / 可点击元素 <40px
      const interactives = Array.from(
        document.querySelectorAll('main button, main [role="button"], main a[href]'),
      ).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 20 && r.height > 8;
      });
      out.btnTotal = interactives.length;
      for (const el of interactives) {
        const r = el.getBoundingClientRect();
        if (r.height < 40) {
          out.smallBtns.push({
            tag: el.tagName.toLowerCase(),
            h: Math.round(r.height),
            w: Math.round(r.width),
            cls: (el.className || '').toString().slice(0, 110),
            txt: (el.textContent || '').trim().slice(0, 24),
          });
        }
      }
      out.smallBtns = out.smallBtns.slice(0, 8);

      // 文本溢出分类
      const isScrollAncestor = (el) => {
        let p = el.parentElement;
        while (p && p !== main) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll') return true;
          p = p.parentElement;
        }
        return false;
      };

      const texts = Array.from(document.querySelectorAll('main p, main span, main div')).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 50 && r.height > 10 && el.textContent && el.textContent.trim().length > 2;
      });

      for (const el of texts.slice(0, 4000)) {
        if (el.scrollWidth > el.clientWidth + 2) {
          out.overflowTotal++;
          const inScroll = isScrollAncestor(el);
          if (inScroll) { out.containerScroll++; continue; }
          const cs = getComputedStyle(el);
          const clips = (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflowX === 'auto' || cs.overflowX === 'scroll')
            && (cs.whiteSpace === 'nowrap' || cs.textOverflow === 'ellipsis' || cs.textOverflow === 'clip');
          if (cs.textOverflow === 'ellipsis') out.intentionalTruncate++;
          if (clips && out.realTruncation.length < 6) {
            out.realTruncation.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className || '').toString().slice(0, 100),
              txt: el.textContent.trim().slice(0, 26),
              sw: el.scrollWidth, cw: el.clientWidth,
            });
          }
        }
      }
      return out;
    });

    Object.assign(entry, data);
    const flag = [];
    if (!data.onLogin && data.mainCount === 0) flag.push('NO_MAIN');
    if (data.onLogin) flag.push('ON_LOGIN');
    if (data.smallBtns.length) flag.push(`small=${data.smallBtns.length}`);
    if (data.realTruncation.length) flag.push(`trunc=${data.realTruncation.length}`);
    if (data.mainPad === 0 && data.contentPad === 0 && data.firstMargin === 0 && !data.onLogin) flag.push('NO_MARGIN');
    console.log(`[${flag.length ? '!' : 'ok'}] ${route}${flag.length ? ' ' + flag.join(' ') : ''} pad=${data.mainPad} btn=${data.btnTotal} overflow=${data.overflowTotal}(scroll=${data.containerScroll})`);
  } catch (e) {
    entry.error = String(e).slice(0, 80);
    console.log(`[ERR] ${route} ${entry.error}`);
  }
  results.push(entry);
}

for (const r of ROUTES) await audit(r);

writeFileSync(path.join(__dirname, 'mobile-detail-verified.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('\n===== 汇总 =====');
console.log(`页面=${results.length} 登录态=${results.filter((r) => !r.onLogin).length}`);
const smallRoutes = results.filter((r) => r.smallBtns && r.smallBtns.length);
console.log(`小按钮页面=${smallRoutes.length}`);
for (const r of smallRoutes) console.log(`  ${r.route}: ${r.smallBtns.map((s) => `${s.tag} h=${s.h} "${s.txt}"`).join(' | ')}`);
const truncRoutes = results.filter((r) => r.realTruncation && r.realTruncation.length);
console.log(`真实叶子截断页面=${truncRoutes.length}`);
for (const r of truncRoutes) console.log(`  ${r.route}: ${r.realTruncation.map((t) => `[${t.cls.split(' ').slice(-2).join(' ')}] "${t.txt}"`).join(' | ')}`);
await browser.close();