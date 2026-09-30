// T-R1 验证：/radix-demo 路由在包装层改为原生实现后仍正常渲染
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'zh-CN', colorScheme: 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });

await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3200);
const pw = await page.$('input[type="password"]');
if (pw) {
  await page.fill('#rhine-username, input[type="text"]', 'admin');
  await page.fill('#rhine-password, input[type="password"]', 'admin123');
  await page.locator('button[type="submit"], button:has-text("登录")').first().click();
  try { await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 45000 }); } catch {}
  await page.waitForTimeout(3500);
}

const out = {};
for (const mode of ['light-default', 'dark-default']) {
  await page.goto(BASE + '/radix-demo', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate(async (m) => {
    for (const p of ['/src/stores/themeStore.ts']) {
      try { const mod = await import(/* @vite-ignore */ p); mod.useThemeStore.getState().setPresetTheme(m); return; } catch {}
    }
  }, mode);
  await page.waitForTimeout(1200);
  out[mode] = await page.evaluate(() => {
    const statuses = [...document.querySelectorAll('[role="status"]')];
    const rt = document.querySelectorAll('.radix-themes, [class*="rt-"]');
    return {
      url: location.href,
      pathname: location.pathname,
      h1: document.querySelector('h1')?.textContent?.trim()?.slice(0, 40) ?? null,
      errorBoundary: /页面加载失败|出错了|Something went wrong/.test(document.body.innerText),
      badgeCount: statuses.length,
      badgeAccessibleNames: statuses.slice(0, 5).map(e => e.getAttribute('aria-label')),
      radixThemesNodes: rt.length,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });
  await page.screenshot({ path: `D:/RMFOODFP/temp/theme-shots/radix-demo-${mode}.png` });
}

// 过滤与 T-R1 无关的既有噪声：401/资源加载失败/后端 WebSocket 拒绝（既有问题，基线亦存在）
out.pageErrors = errors.filter(e =>
  !/401|Unauthorized|Failed to load resource|WebSocket|ws:\/\//i.test(e));
out.verdict = {
  '/radix-demo 可达（非 404/错误页）': out['light-default'].pathname === '/radix-demo' ? '✅' : '❌ ' + out['light-default'].pathname,
  '未触发错误边界': out['light-default'].errorBoundary ? '❌' : '✅',
  'Badge 具备 role=status': out['light-default'].badgeCount > 0 ? `✅ ${out['light-default'].badgeCount} 个` : '❌ 0 个',
  '无 Radix 残留节点': (out['light-default'].radixThemesNodes === 0 && out['dark-default'].radixThemesNodes === 0) ? '✅' : `⚠️ ${out['light-default'].radixThemesNodes}/${out['dark-default'].radixThemesNodes}`,
  '页面错误数': out.pageErrors.length,
};
console.log(JSON.stringify(out, null, 2));
fs.writeFileSync('D:/RMFOODFP/temp/theme-t-r1-verify.json', JSON.stringify(out, null, 2), 'utf8');
await ctx.close();
await browser.close();
const ok = out.verdict['/radix-demo 可达（非 404/错误页）'] === '✅' && !out['light-default'].errorBoundary && out.pageErrors.length === 0;
process.exit(ok ? 0 : 1);
