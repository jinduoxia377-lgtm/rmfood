// 截图基线 / 复核：为 T-A1（@custom-variant dark）的前后对比采集证据
// 用法: node capture-baseline.mjs <subdir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const SUB = process.argv[2] || 'after';
const OUT = `D:/RMFOODFP/temp/theme-shots/${SUB}`;
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = ['/dashboard', '/formulas', '/settings', '/users', '/ai', '/login'];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'zh-CN', colorScheme: 'light' });
const page = await ctx.newPage();
await page.addInitScript(`(function(){
  window.__store=null;
  window.__getStore=async function(){ if(window.__store) return window.__store;
    for (const p of ['/src/stores/themeStore.ts','/src/stores/themeStore']) {
      try{const m=await import(/* @vite-ignore */ p); if(m&&m.useThemeStore){window.__store=m.useThemeStore;return window.__store;}}catch(e){}
    } return null; };
  window.__setTheme=async function(id){const s=await window.__getStore();if(!s)return false;s.getState().setPresetTheme(id);return true;};
})();`);

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3200);
const pw = await page.$('input[type="password"]');
if (pw) {
  await page.fill('#rhine-username, input[type="text"]', 'admin');
  await page.fill('#rhine-password, input[type="password"]', 'admin123');
  await page.locator('button[type="submit"], button:has-text("登录")').first().click();
  try { await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 45000 }); } catch {}
  await page.waitForTimeout(4000);
}

const report = [];
for (const route of ROUTES) {
  try {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 70000 });
    await page.waitForTimeout(4200);
    for (const mode of ['light', 'dark']) {
      // 显式锁定 mode，避免 system 模式下的媒体监听干扰
      await page.evaluate(async (m) => { await window.__setTheme(m === 'dark' ? 'dark-default' : 'light-default'); }, mode);
      await page.waitForTimeout(1300);
      const slug = route.replace(/\//g, '_') || '_root';
      await page.screenshot({ path: `${OUT}/${slug}-${mode}.png` });
    }
    report.push({ route, ok: true });
  } catch (e) { report.push({ route, ok: false, err: String(e).slice(0, 120) }); }
}

console.log(JSON.stringify({ subdir: SUB, out: OUT, report }, null, 2));
fs.writeFileSync(`D:/RMFOODFP/temp/baseline-${SUB}.json`, JSON.stringify({ subdir: SUB, out: OUT, report }, null, 2), 'utf8');
await ctx.close();
await browser.close();
