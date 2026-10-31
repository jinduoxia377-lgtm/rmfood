/**
 * verify-mobile-detail2.mjs — 针对首轮复测中仍处于懒加载/未挂载状态的页面，
 * 延长等待至 12s 后精确采集：main 是否存在、main 左 padding、<40px 按钮明细、
 * 文本溢出分类（容器滚动 vs 真实截断）。
 * 仅核查，不改源码。输出 scripts/mobile-detail-verified2.json。
 */
import { chromium, devices } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];

const ROUTES = [
  '/labels', '/ai', '/databases', '/analytics', '/settings', '/users',
  '/academic-report', '/regulations', '/experiments/new', '/workflows',
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();

let loggedIn = false;
for (let i = 0; i < 6; i += 1) {
  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('#rhine-username', 'admin');
    await page.fill('#rhine-password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
    await page.waitForTimeout(2000);
    loggedIn = true;
    break;
  } catch (e) {
    console.log(`login retry ${i + 1}: ${String(e).slice(0, 60)}`);
    await page.waitForTimeout(3000);
  }
}

const results = [];

async function audit(route) {
  const entry = { route };
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(12000);

    const data = await page.evaluate(() => {
      const out = {
        url: location.pathname, vw: window.innerWidth,
        mainCount: document.querySelectorAll('main').length,
        mainPad: null, mainCls: '', contentPad: null, firstMargin: null,
        btnTotal: 0, smallBtns: [], overflowTotal: 0, containerScroll: 0,
        realTruncation: [], intentionalTruncate: 0,
      };
      const main = document.querySelector('main');
      if (!main) return out;
      const mcs = getComputedStyle(main);
      out.mainPad = parseInt(mcs.paddingLeft || '0', 10);
      out.mainCls = (main.className || '').toString().slice(0, 120);
      const child = Array.from(main.children).find((el) => el.getBoundingClientRect().width > 100);
      if (child) {
        out.firstMargin = parseInt(getComputedStyle(child).marginLeft || '0', 10);
        out.contentPad = parseInt(getComputedStyle(child).paddingLeft || '0', 10);
      }
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
            tag: el.tagName.toLowerCase(), h: Math.round(r.height), w: Math.round(r.width),
            cls: (el.className || '').toString().slice(0, 110),
            txt: (el.textContent || '').trim().slice(0, 24),
          });
        }
      }
      out.smallBtns = out.smallBtns.slice(0, 10);

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
          if (isScrollAncestor(el)) { out.containerScroll++; continue; }
          const cs = getComputedStyle(el);
          const clips = (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflowX === 'auto' || cs.overflowX === 'scroll')
            && (cs.whiteSpace === 'nowrap' || cs.textOverflow === 'ellipsis' || cs.textOverflow === 'clip');
          if (cs.textOverflow === 'ellipsis') out.intentionalTruncate++;
          if (clips && out.realTruncation.length < 6) {
            out.realTruncation.push({
              tag: el.tagName.toLowerCase(), cls: (el.className || '').toString().slice(0, 100),
              txt: el.textContent.trim().slice(0, 26), sw: el.scrollWidth, cw: el.clientWidth,
            });
          }
        }
      }
      return out;
    });

    Object.assign(entry, data);
    const flag = [];
    if (data.mainCount === 0) flag.push('NO_MAIN');
    if (data.smallBtns.length) flag.push(`small=${data.smallBtns.length}`);
    if (data.realTruncation.length) flag.push(`trunc=${data.realTruncation.length}`);
    console.log(`[${flag.length ? '!' : 'ok'}] ${route}${flag.length ? ' ' + flag.join(' ') : ''} pad=${data.mainPad} btn=${data.btnTotal} small=[${data.smallBtns.map((s) => `${s.tag}${s.h}:"${s.txt}"`).join(', ')}] overflow=${data.overflowTotal}(scroll=${data.containerScroll})`);
  } catch (e) {
    entry.error = String(e).slice(0, 80);
    console.log(`[ERR] ${route} ${entry.error}`);
  }
  results.push(entry);
}

for (const r of ROUTES) await audit(r);
writeFileSync(path.join(__dirname, 'mobile-detail-verified2.json'), JSON.stringify(results, null, 2), 'utf8');
console.log('\n===== 完成 =====');
await browser.close();