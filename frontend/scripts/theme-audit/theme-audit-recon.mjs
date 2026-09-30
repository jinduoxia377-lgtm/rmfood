// 主题系统运行时侦察（只读）— 放在 frontend/ 下以解析 node_modules
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const OUT = 'D:/RMFOODFP/temp/theme-shots';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  colorScheme: 'light',
  locale: 'zh-CN',
});
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));

console.log('--- 导航到 ' + BASE + '/ ---');
const resp = await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
console.log('HTTP', resp?.status());
await page.waitForTimeout(6000);

const info = await page.evaluate(() => {
  const de = document.documentElement;
  const cs = getComputedStyle(de);
  const probe = (n) => cs.getPropertyValue(n).trim();
  return {
    url: location.href,
    title: document.title,
    htmlClass: de.className,
    dataTheme: de.getAttribute('data-theme'),
    dataMode: de.getAttribute('data-mode'),
    dataA11y: de.getAttribute('data-a11y-mode'),
    inlineColorScheme: de.style.colorScheme,
    bodyChildCount: document.body.children.length,
    rootHtmlLen: document.getElementById('root')?.innerHTML.length ?? -1,
    h1: document.querySelector('h1')?.textContent?.trim()?.slice(0, 60) ?? null,
    hasPasswordInput: !!document.querySelector('input[type=password]'),
    tokens: {
      'color-primary': probe('--color-primary'),
      'color-primary-500': probe('--color-primary-500'),
      'color-primary-main': probe('--color-primary-main'),
      'color-primary-dark': probe('--color-primary-dark'),
      'text-primary': probe('--text-primary'),
      'color-text-primary': probe('--color-text-primary'),
      'bg-canvas': probe('--bg-canvas'),
      'badge-draft-text': probe('--badge-draft-text'),
      'badge-draft-bg': probe('--badge-draft-bg'),
      'bg-surface-variant': probe('--bg-surface-variant'),
      'bg-surface-container-high': probe('--bg-surface-container-high'),
      'accent-6': probe('--accent-6'),
      'accent-9': probe('--accent-9'),
      'color-surface-default': probe('--color-surface-default'),
      'color-border-divider': probe('--color-border-divider'),
      'background': probe('--background'),
      'weight-regular': probe('--weight-regular'),
      'easing-easeOut': probe('--easing-easeOut'),
      'ease-spring': probe('--ease-spring'),
    },
    inlineStyleLen: de.getAttribute('style')?.length ?? 0,
    defaultBg: getComputedStyle(document.body).backgroundColor,
  };
});

console.log('\n=== 页面信息 ===');
console.log(JSON.stringify(info, null, 2));

console.log('\n=== console errors (' + consoleErrors.length + ') ===');
consoleErrors.slice(0, 12).forEach(e => console.log('  ' + e));
console.log('=== page errors (' + pageErrors.length + ') ===');
pageErrors.slice(0, 12).forEach(e => console.log('  ' + e));

await page.screenshot({ path: OUT + '/recon-01-initial.png', fullPage: false });
console.log('\n截图已保存');

await browser.close();
