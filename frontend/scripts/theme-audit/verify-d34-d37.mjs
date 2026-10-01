// D-34 / D-37 验证
// D-34：mode='system' 时选中预设不得改写 mode
// D-37：mode='system' 冷启动必须按系统偏好选预设（而非沿用持久化的 activeThemeId）
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const browser = await chromium.launch({ headless: true });
const results = {};

// ── D-34 ──
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, locale: 'zh-CN', colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);

  results.d34 = await page.evaluate(async () => {
    const st = await import('/src/stores/themeStore.ts');
    const S = () => st.useThemeStore.getState();
    const wait = (ms = 420) => new Promise(r => setTimeout(r, ms));
    const out = {};

    // 切到 system
    S().setThemeMode('system');
    await wait();
    out['设为 system 后 mode'] = S().mode;

    // 依次选两个预设，观察 mode 是否被强写
    S().setPresetTheme('dark-default');
    await wait();
    out['选 dark-default 后 mode'] = S().mode;
    out['选 dark-default 后 DOM .dark'] = document.documentElement.classList.contains('dark');

    S().setPresetTheme('light-default');
    await wait();
    out['选 light-default 后 mode'] = S().mode;
    out['选 light-default 后 DOM .dark'] = document.documentElement.classList.contains('dark');

    out['✅ mode 保持 system'] = S().mode === 'system';
    S().setThemeMode('light');
    return out;
  });
  await ctx.close();
}

// ── D-37：system + OS 暗色 + 持久化为亮色预设 ──
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, locale: 'zh-CN', colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3000);
  // 预置：mode=system，activeThemeId 故意留成 light-default
  await page.evaluate(() => {
    localStorage.setItem('rmfood-theme-storage', JSON.stringify({
      state: { activeThemeId: 'light-default', mode: 'system', accessibilityMode: 'normal', transitionType: 'none' },
      version: 4,
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  results.d37 = await page.evaluate(async () => {
    const st = await import('/src/stores/themeStore.ts');
    const S = () => st.useThemeStore.getState();
    await S().initialize();
    await new Promise(r => setTimeout(r, 400));
    return {
      'OS 偏好': window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      'store.mode': S().mode,
      'store.activeThemeId': S().activeThemeId,
      'store.activeTheme.mode': S().activeTheme?.mode,
      'DOM .dark': document.documentElement.classList.contains('dark'),
      'DOM data-mode': document.documentElement.getAttribute('data-mode'),
      '✅ 跟随系统（应用暗色）': S().activeTheme?.mode === 'dark' && document.documentElement.classList.contains('dark'),
      '✅ mode 仍为 system': S().mode === 'system',
    };
  });
  await ctx.close();
}

console.log('══ D-34：mode=system 时选中预设不得改写 mode ══');
for (const [k, v] of Object.entries(results.d34)) console.log(`  ${k}: ${v}`);
console.log('\n══ D-37：mode=system 冷启动必须跟随系统偏好 ══');
for (const [k, v] of Object.entries(results.d37)) console.log(`  ${k}: ${v}`);

const ok = results.d34['✅ mode 保持 system'] === true && results.d37['✅ 跟随系统（应用暗色）'] === true;
console.log(`\n结论：${ok ? '✅ 两项均通过' : '❌ 存在失败'}`);
fs.writeFileSync('D:/RMFOODFP/temp/theme-d34-d37-verify.json', JSON.stringify(results, null, 2), 'utf8');
await browser.close();
process.exit(ok ? 0 : 1);
