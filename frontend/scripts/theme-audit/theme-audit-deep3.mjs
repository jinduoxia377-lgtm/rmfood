// ============================================================================
// 第 3 轮：真实应用多路由「裸调色板惰性」扫描 + 亮暗截图 + 无障碍复核
// ============================================================================
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const OUT = 'D:/RMFOODFP/temp/theme-shots';
fs.mkdirSync(OUT, { recursive: true });

const R = {};
const say = (k,v) => { R[k]=v; console.log(`\n### ${k}`); };

const HELPERS = `(function(){
  window.__store = null;
  window.__getStore = async function(){
    if (window.__store) return window.__store;
    for (const p of ['/src/stores/themeStore.ts','/src/stores/themeStore']) {
      try { const m = await import(/* @vite-ignore */ p); if (m?.useStore) {} if (m?.useThemeStore){ window.__store=m.useThemeStore; return window.__store; } } catch(e){}
    }
    return null;
  };
  window.__setTheme = async function(id){
    const s = await window.__getStore(); if(!s) return false;
    s.getState().setPresetTheme(id); return true;
  };
  window.__setA11y = async function(mode){
    const s = await window.__getStore(); if(!s) return false;
    s.getState().setAccessibilityMode(mode); return true;
  };
})();`;

// 裸调色板类（Tailwind 默认调色板；这些类不含 dark: 时完全惰性）
const PALETTE = '(bg|text|border|from|to|via|ring|fill|stroke|divide)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}';
// 令牌类（依赖 --color-neutral-* 反转，是「合规」写法）
const TOKENCLS = '(bg|text|border)-neutral-[0-9]{2,3}';

const browser = await chromium.launch({ headless: true });

async function boot() {
  const ctx = await browser.newContext({ viewport:{width:1680,height:1050}, locale:'zh-CN', colorScheme:'light' });
  const page = await ctx.newPage();
  await page.addInitScript(HELPERS);
  await page.goto(BASE + '/login', { waitUntil:'domcontentloaded', timeout:90000 });
  await page.waitForTimeout(3500);
  const u = page.locator('#rhine-username, input[type="text"]').first();
  const p = page.locator('#rhine-password, input[type="password"]').first();
  await u.waitFor({ state:'visible', timeout:25000 });
  await u.fill('admin'); await p.fill('admin123');
  await page.locator('button[type="submit"], button:has-text("登录")').first().click({ timeout:15000 });
  try { await page.waitForURL(x => !x.pathname.includes('/login'), { timeout:45000 }); } catch {}
  await page.waitForTimeout(4000);
  return { ctx, page };
}

// 扫描：返回每个元素的 [key, tag, cls, bg, color, border]
const SNAP = `(() => {
  const PAL = new RegExp(${JSON.stringify(PALETTE)});
  const out = [];
  let i = 0;
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect();
    if (r.width < 6 || r.height < 6) { i++; continue; }
    const cls = (typeof e.className === 'string' ? e.className : '');
    const cs = getComputedStyle(e);
    out.push({ i, tag:e.tagName, cls: cls.slice(0,140), hasPal: PAL.test(cls),
               bg: cs.backgroundColor, color: cs.color, bd: cs.borderTopColor });
    i++;
  }
  return out;
})()`;

async function scanRoute(page, route) {
  await page.goto(BASE + route, { waitUntil:'domcontentloaded', timeout:70000 });
  await page.waitForTimeout(4200);
  // 锁到 light（mode 显式设置，避免 system 监听媒体）
  await page.evaluate(async () => { await window.__setTheme('light-default'); });
  await page.waitForTimeout(1100);
  const light = await page.evaluate(SNAP);
  await page.screenshot({ path: `${OUT}/r3${route.replace(/\//g,'_')}-light.png` });

  await page.evaluate(async () => { await window.__setTheme('dark-default'); });
  await page.waitForTimeout(1400);
  const dark = await page.evaluate(SNAP);
  await page.screenshot({ path: `${OUT}/r3${route.replace(/\//g,'_')}-dark.png` });
  await page.evaluate(async () => { await window.__setTheme('light-default'); });
  await page.waitForTimeout(800);

  const byI = new Map(dark.map(d => [d.i, d]));
  const palElems = light.filter(l => l.hasPal);
  let inertBg = 0, inertColor = 0;
  const inertSamples = [];
  for (const l of palElems) {
    const d = byI.get(l.i); if (!d || d.cls !== l.cls) continue;
    const bgSame = l.bg === d.bg, colSame = l.color === d.color;
    // 仅当该元素自身类别里没有 dark: 时才可能惰性（有 dark: 的走媒体查询，另行统计）
    const hasDarkVariant = /(^|\s)dark:/.test(l.cls);
    if (bgSame) { inertBg++; if (inertSamples.length < 10 && !hasDarkVariant) inertSamples.push({ cls:l.cls.slice(0,100), bg:l.bg, hasDarkVariant }); }
    if (colSame) inertColor++;
  }
  const palWithDark = palElems.filter(l => /(^|\s)dark:/.test(l.cls)).length;

  return { route, url: page.url(),
    '元素数': light.length,
    '含裸调色板类的元素': palElems.length,
    '其中带dark变体的': palWithDark,
    '其中不带dark变体的': palElems.length - palWithDark,
    '背景在亮暗间不变_惰性': inertBg,
    '文字色在亮暗间不变': inertColor,
    '惰性样例': inertSamples,
  };
}

async function main() {
  const { ctx, page } = await boot();
  const routes = ['/dashboard', '/formulas', '/formula/list', '/database', '/settings', '/users', '/experiments', '/ai'];
  const results = [];
  for (const r of routes) {
    try { results.push(await scanRoute(page, r)); }
    catch (e) { results.push({ route:r, err: String(e).slice(0,180) }); }
  }
  say('裸调色板惰性扫描（多路由）', results);

  // 无障碍属性复核
  try {
    await page.goto(BASE + '/dashboard', { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForTimeout(3500);
    const a11y = await page.evaluate(async () => {
      const de = document.documentElement;
      const before = { a11y: de.getAttribute('data-a11y-mode'), reading: de.getAttribute('data-reading-mode') };
      const ok1 = await window.__setA11y('reading');
      await new Promise(r=>setTimeout(r,700));
      const afterReading = { a11y: de.getAttribute('data-a11y-mode'), reading: de.getAttribute('data-reading-mode'),
                             theme: de.getAttribute('data-theme'), bodyBg: getComputedStyle(document.body).backgroundColor,
                             textPrimary: getComputedStyle(de).getPropertyValue('--text-primary').trim() };
      await window.__setA11y('high-contrast');
      await new Promise(r=>setTimeout(r,700));
      const afterHC = { a11y: de.getAttribute('data-a11y-mode'), reading: de.getAttribute('data-reading-mode'),
                        theme: de.getAttribute('data-theme') };
      await window.__setA11y('color-blind');
      await new Promise(r=>setTimeout(r,700));
      const afterCB = { a11y: de.getAttribute('data-a11y-mode'), theme: de.getAttribute('data-theme'),
                        success: getComputedStyle(de).getPropertyValue('--color-success').trim() };
      await window.__setA11y('normal');
      return { ok1, before, afterReading, afterHC, afterCB };
    });
    say('无障碍模式运行时复核(D-39/D-32)', a11y);
  } catch (e) { say('无障碍模式运行时复核(D-39/D-32)', { err:String(e).slice(0,220) }); }

  // 暗色令牌全景
  try {
    const t = await page.evaluate(async () => {
      const de = document.documentElement;
      const g = n => getComputedStyle(de).getPropertyValue(n).trim();
      await window.__setTheme('dark-default'); await new Promise(r=>setTimeout(r,900));
      const dark = { '--background': g('--background'), '--bg-canvas': g('--bg-canvas'), '--card-bg-solid': g('--card-bg-solid'),
                     '--color-primary': g('--color-primary'), '--color-primary-main': g('--color-primary-main'),
                     '--badge-draft-text': g('--badge-draft-text'), bodyBg: getComputedStyle(document.body).backgroundColor,
                     '--accent-6': g('--accent-6'), '--gray-1': g('--gray-1'), '--font-size-2': g('--font-size-2'),
                     '--color-chart-1': g('--color-chart-1'), '--color-success-light': g('--color-success-light'),
                     dataTheme: de.getAttribute('data-theme'), dataMode: de.getAttribute('data-mode') };
      await window.__setTheme('light-default'); await new Promise(r=>setTimeout(r,900));
      const light = { '--background': g('--background'), '--bg-canvas': g('--bg-canvas'),
                      '--color-primary': g('--color-primary'), '--color-primary-main': g('--color-primary-main'),
                      '--badge-draft-text': g('--badge-draft-text'), bodyBg: getComputedStyle(document.body).backgroundColor,
                      dataTheme: de.getAttribute('data-theme'), dataMode: de.getAttribute('data-mode') };
      return { light, dark };
    });
    say('亮/暗令牌全景', t);
  } catch (e) { say('亮/暗令牌全景', { err:String(e).slice(0,220) }); }

  await ctx.close();
}

await main();
fs.writeFileSync('D:/RMFOODFP/temp/theme-runtime-results3.json', JSON.stringify(R, null, 2), 'utf8');
console.log('\n已写入 theme-runtime-results3.json');
await browser.close();
