// T-D1 / T-D3 / D-22 专项验证：FOUC 时间线 + 暗色 --background + 令牌解析
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const OUT = {};
const browser = await chromium.launch({ headless: true });

// ---------- 1) FOUC 时间线（D-11 / D-49）----------
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: 'zh-CN', colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem('rmfood-theme-storage', JSON.stringify({
        state: { activeThemeId: 'dark-default', mode: 'dark', accessibilityMode: 'normal',
                 motionPreferences: { reducedMotion: false, disableAnimations: false, scaleDownTransitions: false },
                 transitionType: 'fade', customThemes: [] },
        version: 4,
      }));
    } catch {}
  });
  const t0 = Date.now();
  const samples = [];
  await page.goto(BASE + '/login', { waitUntil: 'commit', timeout: 90000 });
  for (let i = 0; i < 80; i++) {
    const s = await page.evaluate(() => {
      const de = document.documentElement;
      return { cls: de.className, bodyBg: document.body ? getComputedStyle(document.body).backgroundColor : null };
    }).catch(() => null);
    if (s) samples.push({ t: Date.now() - t0, ...s });
    await page.waitForTimeout(40);
  }
  const paints = await page.evaluate(() => performance.getEntriesByType('paint').map(p => ({ name: p.name, t: Math.round(p.startTime) })));
  const firstBg = samples.find(s => s.bodyBg && s.bodyBg !== 'rgba(0, 0, 0, 0)');
  const fcp = paints.find(p => p.name === 'first-contentful-paint');
  OUT.fouc = {
    paints,
    firstBodyBg: firstBg,
    firstDarkClass: samples.find(s => (s.cls || '').includes('dark')),
    verdict: {
      '首个 body 背景色': firstBg ? firstBg.bodyBg : null,
      '是否已是暗色（应为 rgb(2, 6, 23)）': firstBg ? (firstBg.bodyBg === 'rgb(2, 6, 23)' ? '✅ 是' : '❌ 否') : 'n/a',
      '首次可见时 .dark 类是否已就位': firstBg ? (String(firstBg.cls).includes('dark') ? '✅ 是' : '❌ 否') : 'n/a',
      'FCP(ms)': fcp ? fcp.t : null,
      '首个背景色出现时刻(ms)': firstBg ? firstBg.t : null,
      '⇒ 背景先于首绘就绪': (firstBg && fcp && firstBg.t <= fcp.t) ? '✅ 是（无 FOUC）' : '❌ 否（仍有 FOUC）',
    },
  };
  await ctx.close();
}

// ---------- 2) 暗色令牌 + --bg-surface-variant（D-9 / D-22）----------
{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: 'zh-CN', colorScheme: 'light' });
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
  await page.waitForTimeout(4000);
  OUT.tokens = await page.evaluate(async () => {
    const g = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    await window.__setTheme('light-default'); await new Promise(r => setTimeout(r, 900));
    const light = { '--background': g('--background'), '--bg-canvas': g('--bg-canvas'),
                    '--bg-surface-variant': g('--bg-surface-variant'), '--color-primary-text': g('--color-primary-text'),
                    bodyBg: getComputedStyle(document.body).backgroundColor };
    await window.__setTheme('dark-default'); await new Promise(r => setTimeout(r, 1100));
    const dark = { '--background': g('--background'), '--bg-canvas': g('--bg-canvas'),
                   '--bg-surface-variant': g('--bg-surface-variant'), '--color-primary-text': g('--color-primary-text'),
                   bodyBg: getComputedStyle(document.body).backgroundColor };
    return {
      light, dark,
      verdict: {
        'D-9 暗色 --background': dark['--background'] + (dark['--background'] === '#020617' ? '  ✅' : '  ❌ 应为 #020617'),
        'D-22 --bg-surface-variant（亮）': light['--bg-surface-variant'] || '❌ 空',
        'D-22 --bg-surface-variant（暗）': dark['--bg-surface-variant'] || '❌ 空',
        'D-12b --color-primary-text（亮/暗）': light['--color-primary-text'] + ' / ' + dark['--color-primary-text'],
      },
    };
  });
  await ctx.close();
}

console.log(JSON.stringify(OUT, null, 2));
fs.writeFileSync('D:/RMFOODFP/temp/theme-m1-verify.json', JSON.stringify(OUT, null, 2), 'utf8');
await browser.close();
