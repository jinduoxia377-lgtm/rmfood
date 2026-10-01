// D-57 验证：无障碍 DOM 属性在全部 7 条应用路径后是否与 store 状态一致
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' });
const page = await ctx.newPage();
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForTimeout(3500);

const rows = await page.evaluate(async () => {
  const st = await import('/src/stores/themeStore.ts');
  const S = () => st.useThemeStore.getState();
  const snap = (label) => {
    const r = document.documentElement;
    return {
      路径: label,
      'store.a11y': S().accessibilityMode,
      'store.mode': S().activeTheme?.mode ?? '?',
      'data-a11y-mode': r.getAttribute('data-a11y-mode'),
      'data-reading-mode': r.getAttribute('data-reading-mode'),
      'html.dark': r.classList.contains('dark'),
    };
  };
  const wait = (ms = 420) => new Promise(r => setTimeout(r, ms));
  const out = [];

  // 1) 先进入阅读模式（建立残留条件）
  S().setAccessibilityMode('reading');
  await wait();
  out.push(snap('① setAccessibilityMode(reading)'));

  // 2) resetToDefault —— 此前会残留 reading 属性（D-57 核心场景）
  S().resetToDefault();
  await wait();
  out.push(snap('② resetToDefault()'));

  // 3) 再次进入阅读模式，然后 setThemeMode('dark')
  S().setAccessibilityMode('reading');
  await wait();
  S().setThemeMode('dark');
  await wait();
  out.push(snap('③ reading + setThemeMode(dark)'));

  // 4) setPresetTheme
  S().setPresetTheme('light-default');
  await wait();
  out.push(snap('④ setPresetTheme(light)'));

  // 5) setThemeMode('light')
  S().setThemeMode('light');
  await wait();
  out.push(snap('⑤ setThemeMode(light)'));

  // 复位
  S().resetToDefault();
  await wait();
  return out;
});

const errs = [];
console.log('路径'.padEnd(34), 'a11y'.padEnd(9), 'data-a11y-mode'.padEnd(14), 'data-reading-mode');
for (const r of rows) {
  console.log(String(r['路径']).padEnd(34),
    String(r['store.a11y']).padEnd(9),
    String(r['data-a11y-mode']).padEnd(14),
    String(r['data-reading-mode']));
}

// 一致性断言
const r2 = rows.find(x => String(x['路径']).startsWith('②'));
if (r2) {
  if (r2['data-a11y-mode'] !== 'normal') errs.push(`② resetToDefault 后 data-a11y-mode=${r2['data-a11y-mode']}，应为 normal`);
  if (r2['data-reading-mode'] !== null) errs.push(`② resetToDefault 后残留 data-reading-mode=${r2['data-reading-mode']}`);
}
const r3 = rows.find(x => String(x['路径']).startsWith('③'));
if (r3) {
  if (r3['data-reading-mode'] !== 'dark-read') errs.push(`③ reading+dark 时 data-reading-mode=${r3['data-reading-mode']}，应为 dark-read`);
}
for (const r of rows) {
  const expected = r['store.a11y'] === 'normal' ? 'normal' : r['store.a11y'];
  if (r['data-a11y-mode'] !== expected) errs.push(`${r['路径']}: data-a11y-mode=${r['data-a11y-mode']} ≠ store=${expected}`);
}

console.log('');
if (errs.length) { for (const e of errs) console.log('  ❌ ' + e); }
else console.log('  ✅ 全部路径的 DOM 属性与 store 状态一致');

fs.writeFileSync('D:/RMFOODFP/temp/theme-d57-verify.json', JSON.stringify({ rows, errs }, null, 2), 'utf8');
await ctx.close();
await browser.close();
process.exit(errs.length ? 1 : 0);
