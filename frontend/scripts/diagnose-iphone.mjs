/**
 * iPhone 13 (390×844) 渲染诊断：
 * 量化字体、卡片、间距、按钮尺寸，定位“老年机页面”感的来源。
 */
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();

async function diagnose(path) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2200);
  const d = await page.evaluate(() => {
    const cs = (el) => el ? getComputedStyle(el) : null;
    const doc = document.documentElement;
    const body = document.body;
    const fontSize = (el) => cs(el)?.fontSize;
    const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 6).map((h) => ({
      tag: h.tagName, text: (h.textContent || '').trim().slice(0, 30), fontSize: fontSize(h), className: (h.className || '').slice(0, 50),
    }));
    // 主内容区第一个卡片
    const cards = [...document.querySelectorAll('[class*="card"], main [class*="rounded-"]')].slice(0, 8).map((c) => {
      const r = c.getBoundingClientRect();
      return { cls: (c.className || '').slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), fontSize: fontSize(c) };
    });
    const buttons = [...document.querySelectorAll('button')].slice(0, 10).map((b) => {
      const r = b.getBoundingClientRect();
      return { text: (b.textContent || '').trim().slice(0, 12), h: Math.round(r.height), w: Math.round(r.width), fontSize: fontSize(b) };
    });
    const main = document.querySelector('main');
    const mainRect = main?.getBoundingClientRect();
    const header = document.querySelector('header');
    return {
      url: location.pathname,
      clientWidth: doc.clientWidth,
      dpr: window.devicePixelRatio,
      htmlFontSize: fontSize(doc),
      bodyFontSize: fontSize(body),
      bodyLineHeight: body ? getComputedStyle(body).lineHeight : null,
      headings,
      cards,
      buttons,
      main: mainRect ? { w: Math.round(mainRect.width), h: Math.round(mainRect.height), padTop: main ? getComputedStyle(main).paddingTop : null, padX: main ? getComputedStyle(main).paddingLeft : null } : null,
      header: header ? { h: Math.round(header.getBoundingClientRect().height) } : null,
    };
  });
  console.log(JSON.stringify(d, null, 1));
}

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.fill('#rhine-username', 'admin');
await page.fill('#rhine-password', 'admin123');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard**', { timeout: 15000 });
await page.waitForTimeout(1500);

await diagnose('/dashboard');
await browser.close();