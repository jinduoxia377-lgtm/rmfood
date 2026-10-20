/** 最终验证：/analytics 横幅高度 + /landing 移动端观感 */
import { chromium, devices } from '@playwright/test';

const BASE = 'http://localhost:3000';
const iPhone13 = devices['iPhone 13'];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ...iPhone13 });
const page = await context.newPage();

// 登录（容忍慢响应，最多重试 2 次）
async function login() {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill('#rhine-username', 'admin');
    await page.fill('#rhine-password', 'admin123');
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20000 });
      await page.waitForTimeout(1500);
      return true;
    } catch {
      console.log(`login attempt ${attempt + 1} timed out, retrying...`);
    }
  }
  return false;
}

if (!(await login())) {
  console.log('登录失败，跳过 /analytics，仅检查 /landing');
} else {
  await page.goto(BASE + '/analytics', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  const a = await page.evaluate(() => {
    const b = document.querySelector('.surface-primary');
    const r = b?.getBoundingClientRect();
    const cs = b ? getComputedStyle(b) : null;
    return { bannerH: r ? Math.round(r.height) : null, pad: cs?.paddingTop, overflow: document.documentElement.scrollWidth - window.innerWidth };
  });
  console.log(`/analytics: bannerH=${a.bannerH} pad=${a.pad} overflow=${a.overflow}`);
}

// 检查 /landing（公开）
await page.goto(BASE + '/landing', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2000);
const l = await page.evaluate(() => {
  const w = window.innerWidth;
  const overflow = document.documentElement.scrollWidth - w;
  const headings = [...document.querySelectorAll('h1,h2,h3')].slice(0, 8).map((h) => ({
    tag: h.tagName, fs: getComputedStyle(h).fontSize, text: (h.textContent || '').trim().slice(0, 24),
  }));
  const btns = [...document.querySelectorAll('button,a')].slice(0, 12).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.height > 20 && r.width > 40;
  }).map((el) => {
    const r = el.getBoundingClientRect();
    return { tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 12), h: Math.round(r.height), w: Math.round(r.width) };
  });
  return { overflow, headings, btns };
});
console.log(`/landing: overflow=${l.overflow}`);
console.log('  headings:', JSON.stringify(l.headings));
console.log('  buttons:', JSON.stringify(l.btns.slice(0, 10)));

await browser.close();