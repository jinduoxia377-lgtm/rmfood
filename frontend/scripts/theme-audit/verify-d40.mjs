// D-40 验证：① 全项目 useTheme 导出唯一；② /analytics 页面仍正常渲染
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { chromium } from '@playwright/test';

const SRC = 'D:/RMFOODFP/frontend/src';
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (['.ts', '.tsx'].includes(extname(p))) files.push(p);
  }
})(SRC);

// ① 导出名为 useTheme 的位置（先去注释，避免把注释掉的导出算进来）
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const defs = [];
for (const f of files) {
  const t = stripComments(readFileSync(f, 'utf8'));
  for (const m of t.matchAll(/export\s+(?:const|function)\s+useTheme\b/g)) {
    defs.push(relative(SRC, f));
  }
  for (const m of t.matchAll(/export\s*\{[^}]*\buseTheme\b[^}]*\}/g)) {
    defs.push(relative(SRC, f) + ' (re-export)');
  }
}
console.log('══ ① useTheme 导出点（已剔除注释）══');
for (const d of defs) console.log('   ' + d);
const impls = defs.filter(d => !d.includes('re-export'));
console.log(`   实现 ${impls.length} 个 / 再导出 ${defs.length - impls.length} 个`);
console.log(`   ${impls.length === 1 ? '✅ useTheme 全项目唯一实现，同名冲突已消除' : '❌ 仍有多个实现'}\n`);

// ② 渲染 /analytics
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 160)));

await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3200);
const pw = await page.$('input[type="password"]');
if (pw) {
  await page.fill('#rhine-username, input[type="text"]', 'admin');
  await page.fill('#rhine-password, input[type="password"]', 'admin123');
  await page.locator('button[type="submit"], button:has-text("登录")').first().click();
  try { await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 45000 }); } catch {}
  await page.waitForTimeout(3500);
}

console.log('══ ② /analytics 渲染 ══');
for (const mode of ['light-default', 'dark-default']) {
  await page.goto('http://127.0.0.1:3000/analytics', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3200);
  await page.evaluate(async (m) => {
    const st = await import('/src/stores/themeStore.ts');
    st.useThemeStore.getState().setPresetTheme(m);
  }, mode);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => ({
    path: location.pathname,
    h: document.querySelector('h1,h2')?.textContent?.trim()?.slice(0, 30) ?? '(无标题)',
    hasError: /页面加载失败|出错了|Something went wrong/.test(document.body.innerText),
    textLen: document.body.innerText.length,
    colorLeak: /\[object Object\]/.test(document.body.innerText),
  }));
  console.log(`   ${mode.padEnd(14)} path=${r.path} 标题="${r.h}" 文本长度=${r.textLen} 错误页=${r.hasError} [object Object]泄漏=${r.colorLeak}`);
}

const realErrs = errs.filter(e => !/WebSocket|401|Failed to load resource/i.test(e));
console.log(`\n   页面错误: ${realErrs.length}`);
realErrs.slice(0, 3).forEach(e => console.log('     ' + e));

await ctx.close();
await browser.close();
const ok = impls.length === 1 && realErrs.length === 0;
console.log(`\n结论：${ok ? '✅ D-40 通过' : '❌ 需复核'}`);
process.exit(ok ? 0 : 1);
