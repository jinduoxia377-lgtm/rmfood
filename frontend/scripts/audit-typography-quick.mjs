/**
 * 快速抽查审计（iPhone 13, 390×844）——/dashboard /formulas /ai
 * 读取 body 字号、页面边距、最小文本字号、按钮高度、横向溢出。
 * 用法: node scripts/audit-typography-quick.mjs
 */
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];
const ROUTES = ['/dashboard', '/formulas', '/ai'];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();

let loggedIn = false;
for (let i = 0; i < 3 && !loggedIn; i += 1) {
  try {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(800);
    await page.fill('#rhine-username', 'admin');
    await page.fill('#rhine-password', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
    await page.waitForTimeout(1500);
    loggedIn = true;
  } catch {
    console.log(`LOGIN retry ${i + 1}`);
  }
}
console.log(`LOGIN_OK=${loggedIn}`);
if (!loggedIn) process.exit(1);

async function audit(path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
  // 等待全屏 loading 消失
  try {
    await page.waitForFunction(() => {
      return !document.querySelector('.flex.items-center.justify-center.h-screen');
    }, { timeout: 20000 });
  } catch { /* ignore */ }
  await page.waitForTimeout(1800);
  const d = await page.evaluate(() => {
    const vw = window.innerWidth;
    const doc = document.documentElement;
    const body = document.body;
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const px = (v) => (v ? parseFloat(v) : null);
    const rect = (el) => el.getBoundingClientRect();
    const visible = (el) => {
      const s = cs(el);
      const r = rect(el);
      if (!s || s.display === 'none' || s.visibility === 'hidden') return false;
      if (r.width === 0 && r.height === 0) return false;
      return r.right > 0 && r.left < vw;
    };
    // 最小文本字号（只统计直接含文本或叶子元素）
    const small = [];
    for (const el of Array.from(body.querySelectorAll('*'))) {
      if (!visible(el)) continue;
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent || '').trim());
      if (!hasText && el.children.length > 0) continue;
      const fs = px(cs(el)?.fontSize);
      if (!fs) continue;
      if (fs <= 12) small.push({ fs, cls: (el.getAttribute('class') || '').slice(0, 70), text: (el.textContent || '').trim().slice(0, 16) });
    }
    const minFont = small.length ? Math.min(...small.map((s) => s.fs)) : null;
    const main = document.querySelector('main') || body;
    const mainCs = cs(main);
    // 按钮高度
    let btnSmall = 0;
    for (const b of Array.from(document.querySelectorAll('button, a[class*="btn"], a[class*="button"]'))) {
      if (b.disabled || !visible(b)) continue;
      if (rect(b).height < 44) btnSmall += 1;
    }
    return {
      url: location.pathname,
      bodyFontSize: px(cs(body)?.fontSize),
      minFont: minFont ? Math.round(minFont * 10) / 10 : null,
      smallCount: small.length,
      smallSamples: small.slice(0, 5),
      mainPadLeft: px(mainCs?.paddingLeft),
      mainPadRight: px(mainCs?.paddingRight),
      docOverflow: doc.scrollWidth - vw,
      btnSmall,
    };
  });
  console.log(JSON.stringify(d, null, 1));
}

for (const r of ROUTES) {
  try {
    await audit(r);
  } catch (e) {
    console.log(`ERR ${r}: ${String(e.message).slice(0, 150)}`);
  }
}
await browser.close();