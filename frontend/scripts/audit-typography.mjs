/**
 * 移动端「字体与尺寸」专项审计（iPhone 13, 390×844）
 *
 * 对每个主要路由采集：
 *  - body 计算字号 / 页面最小字号（<11px、<12px、=12px 文本元素数量与示例 class）
 *  - 根容器左右内边距（main 的 padding-left/right + 首个内容子元素 left/right 偏移）
 *  - 主要卡片内边距（带背景色块的前若干元素）
 *  - 页标题字号（main h1/h2）
 *  - 按钮最小高度（<44px 数量与示例，保留一位小数）
 *  - 横向溢出（documentElement.scrollWidth - viewport，及溢出元素）
 *
 * 改进：等待全屏 loading（flex items-center justify-center h-screen）消失后再测量；
 *       记录路由重定向后的最终页面。
 *
 * 用法: node scripts/audit-typography.mjs
 * 输出: console 摘要 + scripts/typography-audit-data.json（供生成报告）
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
  '/notifications', '/academic-report', '/peptide-structure', '/integrations', '/landing', '/tokens',
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
    } catch {
      /* retry */
    }
  }
  return false;
}

/** 等待全屏 loading 消失（最多 20s），随后再等 1s 让内容稳定 */
async function waitForContent() {
  try {
    await page.waitForFunction(() => {
      const loaders = Array.from(document.querySelectorAll('main .h-screen, main [class*="animate-spin"], .flex.items-center.justify-center.h-screen'));
      return loaders.length === 0;
    }, { timeout: 20000 });
  } catch {
    /* 超时继续，标记由调用方处理 */
    return false;
  }
  await page.waitForTimeout(1000);
  return true;
}

async function audit(route) {
  const result = { route };
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1200);
    // 若被重定向到登录页，重新登录后再访问一次
    if (page.url().includes('/login')) {
      const ok = await login();
      if (!ok) {
        result.error = 'login failed';
        return result;
      }
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1200);
    }
    const contentLoaded = await waitForContent();

    const d = await page.evaluate(() => {
      const viewportW = window.innerWidth;
      const doc = document.documentElement;
      const body = document.body;
      const cs = (el) => (el ? getComputedStyle(el) : null);
      const px = (v) => (v ? parseFloat(v) : null);
      const rect = (el) => el.getBoundingClientRect();

      const isVisible = (el) => {
        const s = cs(el);
        const r = rect(el);
        if (!s) return false;
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        if (r.width === 0 && r.height === 0) return false;
        if (r.right <= 0 || r.left >= viewportW) return false; // 横向移出画布的不算
        return true;
      };

      // ---------- 1. 字体 ----------
      const bodyFontSize = px(cs(body)?.fontSize);
      const bodyLineHeight = cs(body)?.lineHeight;

      const below11 = [];
      const below12 = [];
      const at12 = [];
      const fontSamples = [];
      for (const el of Array.from(body.querySelectorAll('*'))) {
        if (!isVisible(el)) continue;
        const hasDirectText = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0,
        );
        // 只统计“直接包含文本”或“叶子元素”，避免容器重复计数
        if (!hasDirectText && el.children.length > 0) continue;
        const fs = px(cs(el)?.fontSize);
        if (!fs) continue;
        fontSamples.push(fs);
        const sample = {
          tag: el.tagName.toLowerCase(),
          fs: Math.round(fs * 10) / 10,
          cls: (el.getAttribute('class') || '').slice(0, 90),
          text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24),
        };
        if (fs < 11) below11.push(sample);
        if (fs < 12) below12.push(sample);
        if (fs >= 11.9 && fs <= 12.1) at12.push(sample);
      }
      const minFont = fontSamples.length ? Math.min(...fontSamples) : null;

      const unique = (arr, n = 8) => {
        const out = [];
        const seen = new Set();
        for (const s of arr) {
          const key = s.cls || `${s.tag}:${s.text}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(s);
          if (out.length >= n) break;
        }
        return out;
      };

      // ---------- 2. 根容器左右内边距 ----------
      const main = document.querySelector('main') || body;
      const mainCs = cs(main);
      const mainPadLeft = px(mainCs?.paddingLeft);
      const mainPadRight = px(mainCs?.paddingRight);
      let contentLeft = null;
      let contentRight = null;
      let contentCls = '';
      let contentPad = null;
      const candidates = [];
      for (const child of Array.from(main.children)) {
        if (!isVisible(child)) continue;
        const cr = rect(child);
        if (cr.width > 200 && cr.height > 0) {
          candidates.push({
            cls: (child.getAttribute('class') || '').slice(0, 80),
            left: Math.round(cr.left),
            right: Math.round(viewportW - cr.right),
            pad: px(cs(child)?.paddingLeft),
          });
        }
      }
      const pick = candidates.find((c) => c.left >= 8) || candidates[0];
      if (pick) {
        contentLeft = pick.left;
        contentRight = pick.right;
        contentCls = pick.cls;
        contentPad = pick.pad;
      }

      // ---------- 3. 主要卡片内边距 ----------
      const cards = [];
      for (const el of Array.from(main.querySelectorAll('div,section'))) {
        if (!isVisible(el)) continue;
        const er = rect(el);
        if (er.width < 280 || er.height < 40) continue;
        const s = cs(el);
        const bg = s.backgroundColor;
        if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
        const pl = px(s.paddingLeft) || 0;
        const pt = px(s.paddingTop) || 0;
        cards.push({
          cls: (el.getAttribute('class') || '').slice(0, 80),
          w: Math.round(er.width),
          pl: Math.round(pl),
          pt: Math.round(pt),
          bg,
        });
        if (cards.length >= 4) break;
      }

      // ---------- 4. 页标题字号 ----------
      let title = null;
      const h1 = main.querySelector('h1');
      const h = h1 || main.querySelector('h2');
      if (h && isVisible(h)) {
        title = {
          tag: h.tagName.toLowerCase(),
          fs: px(cs(h)?.fontSize),
          cls: (h.getAttribute('class') || '').slice(0, 80),
          text: (h.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30),
        };
      }

      // ---------- 5. 按钮高度 ----------
      let btnSmall = 0;
      const btnSamples = [];
      const btns = Array.from(document.querySelectorAll('button, a[class*="btn"], a[class*="button"], [role="button"]'));
      for (const b of btns) {
        if (b.disabled) continue;
        if (b.getAttribute('aria-hidden') === 'true') continue;
        if (!isVisible(b)) continue;
        const bh = rect(b).height;
        if (bh < 44) {
          btnSmall += 1;
          if (btnSamples.length < 8) {
            btnSamples.push({
              text: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 12),
              h: Math.round(bh * 10) / 10,
              cls: (b.getAttribute('class') || '').slice(0, 70),
            });
          }
        }
      }

      // ---------- 6. 横向溢出 ----------
      const docOverflow = doc.scrollWidth - viewportW;
      const offenders = [];
      for (const el of Array.from(body.querySelectorAll('*'))) {
        const er = rect(el);
        if (er.width === 0 && er.height === 0) continue;
        const overRight = er.right - viewportW;
        const overLeft = -er.left;
        if (overRight > 2 || overLeft > 2) {
          let p = el.parentElement;
          let insideScroll = false;
          while (p && p !== body) {
            const pcs = cs(p);
            if (/(auto|scroll|hidden|clip)/.test(pcs.overflowX)) { insideScroll = true; break; }
            p = p.parentElement;
          }
          if (insideScroll) continue;
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.getAttribute('class') || '').slice(0, 80),
            right: Math.round(er.right),
            left: Math.round(er.left),
            w: Math.round(er.width),
          });
        }
      }
      offenders.sort((a, b) => (b.right - viewportW) - (a.right - viewportW));

      return {
        url: location.pathname,
        finalUrl: location.href,
        viewportW,
        bodyFontSize,
        bodyLineHeight,
        minFont: minFont ? Math.round(minFont * 10) / 10 : null,
        below11Count: below11.length,
        below12Count: below12.length,
        at12Count: at12.length,
        below11Samples: unique(below11),
        below12Samples: unique(below12),
        at12Samples: unique(at12),
        mainPadLeft,
        mainPadRight,
        contentLeft,
        contentRight,
        contentCls,
        contentPad,
        title,
        cards,
        btnSmallCount: btnSmall,
        btnSamples,
        docOverflow: Math.round(docOverflow),
        offenders: offenders.slice(0, 5),
      };
    });

    Object.assign(result, d);
    result.contentLoaded = contentLoaded;

    // 标记问题
    const flags = [];
    if (result.below11Count > 0) flags.push(`<11px(${result.below11Count})`);
    if (result.below12Count > 0) flags.push(`<12px(${result.below12Count})`);
    if (result.at12Count > 0) flags.push(`12px(${result.at12Count})`);
    if (result.btnSmallCount > 0) flags.push(`BTN<44(${result.btnSmallCount})`);
    if (result.docOverflow > 1) flags.push(`OVERFLOW(${result.docOverflow})`);
    if ((result.mainPadLeft ?? 0) > 20) flags.push(`MAIN_PAD>20`);
    if ((result.contentLeft ?? 0) > 20) flags.push(`CONTENT_PAD>20`);
    if (result.title?.fs && result.title.fs > 28) flags.push(`TITLE_BIG`);
    if (result.title?.fs && result.title.fs < 20) flags.push(`TITLE_SMALL`);
    console.log(
      `[${flags.length ? flags.join(',') : 'ok'}] ${route}${result.url !== route ? `->${result.url}` : ''} ` +
      `bodyFs=${result.bodyFontSize} minFs=${result.minFont} title=${result.title ? Math.round(result.title.fs) : '-'} ` +
      `mainPad=${result.mainPadLeft}/${result.mainPadRight} contentL=${result.contentLeft} btnSmall=${result.btnSmallCount} ` +
      `overflow=${result.docOverflow} loaded=${result.contentLoaded}`,
    );
  } catch (e) {
    result.error = String(e.message).slice(0, 200);
    console.log(`[ERR] ${route}: ${result.error}`);
  }
  return result;
}

// 登录
const loggedIn = await login();
console.log(`LOGIN_OK=${loggedIn}`);
if (!loggedIn) {
  console.log('登录失败，终止审计');
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(1500);

const results = [];
for (const r of ROUTES) {
  results.push(await audit(r));
}

writeFileSync(
  path.join(__dirname, 'typography-audit-data.json'),
  JSON.stringify(results, null, 2),
  'utf8',
);

console.log('\n===== 汇总 =====');
const small11 = results.filter((r) => r.below11Count > 0);
const small12 = results.filter((r) => r.below12Count > 0 || r.at12Count > 0);
const btnPages = results.filter((r) => r.btnSmallCount > 0);
const overflowPages = results.filter((r) => r.docOverflow > 1);
const padPages = results.filter((r) => (r.contentLeft ?? 0) > 20 || (r.mainPadLeft ?? 0) > 20);
console.log(
  `页面=${results.length} 含<11px页面=${small11.length} 含<=12px字号页面=${small12.length} ` +
  `含<44px按钮页面=${btnPages.length} 溢出页面=${overflowPages.length} 边距>20px页面=${padPages.length}`,
);
console.log(`数据已写入 scripts/typography-audit-data.json`);
await browser.close();