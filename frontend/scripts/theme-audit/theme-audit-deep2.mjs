// ============================================================================
// RMFOOD 主题系统 — 真实浏览器深度核查 · 第 2 轮
// 内容：登录进真实应用 → D-1 决定性实验 / D-5 内联累加 / FOUC 时间线 /
//       运行时"暗色盲区"自动探测 / 亮暗对比截图
// 只读：不改动仓库文件
// ============================================================================
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const OUT = 'D:/RMFOODFP/temp/theme-shots';
fs.mkdirSync(OUT, { recursive: true });

const R = {};
const say = (k, v) => { R[k] = v; console.log(`\n### ${k}\n` + JSON.stringify(v, null, 2)); };

const RELATIVE_LUM = `(function(){
  window.__lum = function(css){
    const m = String(css).match(/rgba?\\(([^)]+)\\)/); if(!m) return null;
    const p = m[1].split(',').map(s=>parseFloat(s.trim()));
    const f = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
    return 0.2126*f(p[0]) + 0.7152*f(p[1]) + 0.0722*f(p[2]);
  };
  window.__contrast = function(fg,bg){
    const a = window.__lum(fg), b = window.__lum(bg); if(a===null||b===null) return null;
    const hi=Math.max(a,b), lo=Math.min(a,b);
    return Math.round(((hi+0.05)/(lo+0.05))*100)/100;
  };
  // 驱动真实 store（Vite dev 下可按路径动态 import 源模块）
  window.__getStore = async function(){
    if (window.__store) return window.__store;
    for (const p of ['/src/stores/themeStore.ts','/src/stores/themeStore']) {
      try { const m = await import(/* @vite-ignore */ p);
            if (m?.useThemeStore) { window.__store = m.useThemeStore; return window.__store; } } catch(e){}
    }
    return null;
  };
})();`;

const browser = await chromium.launch({ headless: true });

async function freshCtx(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1680, height: 1050 }, locale: 'zh-CN', colorScheme: 'light', ...opts,
  });
  const page = await ctx.newPage();
  await page.addInitScript(RELATIVE_LUM);
  return { ctx, page };
}

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);
  const inputs = await page.evaluate(() => ({
    text: [...document.querySelectorAll('input')].map(i => ({ type:i.type, name:i.name, id:i.id, ph:i.placeholder, val:i.value })),
  }));
  const u = page.locator('input[type="text"], input[name="username"], input#username').first();
  const p = page.locator('input[type="password"]').first();
  await u.waitFor({ state:'visible', timeout:20000 });
  await u.fill('admin');
  await p.fill('admin123');
  const btn = page.locator('button[type="submit"], button:has-text("登录"), button:has-text("登 录")').first();
  await btn.click({ timeout:15000 });
  try { await page.waitForURL(u2 => !u2.pathname.includes('/login'), { timeout: 45000 }); }
  catch { await page.waitForTimeout(6000); }
  await page.waitForTimeout(4500);
  return { inputs, url: page.url() };
}

// ============================================================================
// 实验 A：D-1 决定性实验（登录后在真实页面上做）
// ============================================================================
async function expDarkVariant() {
  const { ctx, page } = await freshCtx();
  const login_ = await login(page);
  const url = page.url();

  // 1) 真实元素：找出含 dark: 类的元素
  const realProbes = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')];
    const hits = all.filter(e => {
      const c = typeof e.className === 'string' ? e.className : '';
      return /(^|\s)dark:(bg|text|border|from|to)-/.test(c) && e.getBoundingClientRect().width > 2;
    });
    hits.slice(0, 8).forEach((e,i) => e.setAttribute('data-audit-real', String(i)));
    return hits.slice(0, 8).map(e => ({ tag:e.tagName, cls:e.className.slice(0,150), darkCls:(e.className.match(/dark:[\w:./[\]-]+/g)||[]).slice(0,3) }));
  });

  // 2) 合成探针：用确认已编译进 CSS 的 dark: 工具类
  await page.evaluate(() => {
    const mk = (cls, id) => { const d=document.createElement('div'); d.id=id; d.className=cls; d.style.cssText='position:fixed;left:-9999px;top:0;width:50px;height:20px'; document.body.appendChild(d); };
    mk('bg-white dark:bg-neutral-900', 'syn-dark-bg');
    mk('text-neutral-900 dark:text-white', 'syn-dark-text');
  });

  const read = () => page.evaluate(() => {
    const g = (sel) => { const e=document.querySelector(sel); if(!e) return null; const cs=getComputedStyle(e);
      return { bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor }; };
    const real = {};
    for (let i=0;i<8;i++){ const e=document.querySelector(`[data-audit-real="${i}"]`); if(!e) continue;
      const cs=getComputedStyle(e); real['real'+i]={ cls:e.className.slice(0,90), bg:cs.backgroundColor, color:cs.color, border:cs.borderTopColor }; }
    return { htmlClass: document.documentElement.className, syn_bg:g('#syn-dark-bg'), syn_text:g('#syn-dark-text'), real };
  });

  const conds = {};
  const set = async (darkClass, media) => {
    await page.evaluate((b) => document.documentElement.classList.toggle('dark', b), darkClass);
    await page.emulateMedia({ colorScheme: media });
    await page.waitForTimeout(450);
  };
  await set(false,'light'); conds.A_noClass_lightMedia = await read();
  await set(true ,'light'); conds.B_darkClass_lightMedia = await read();
  await set(false,'dark' ); conds.C_noClass_darkMedia = await read();
  await set(true ,'dark' ); conds.D_darkClass_darkMedia = await read();

  const diff = (x,y) => (x&&y) ? (x.bg!==y.bg || x.color!==y.color || x.border!==y.border) : null;
  const summary = {
    '合成探针 bg：加 .dark 类是否变化 (B vs A)': diff(conds.B_darkClass_lightMedia.syn_bg, conds.A_noClass_lightMedia.syn_bg),
    '合成探针 bg：系统切暗是否变化 (C vs A)':    diff(conds.C_noClass_darkMedia.syn_bg, conds.A_noClass_lightMedia.syn_bg),
    '合成探针 text：加 .dark 类是否变化 (B vs A)': diff(conds.B_darkClass_lightMedia.syn_text, conds.A_noClass_lightMedia.syn_text),
    '合成探针 text：系统切暗是否变化 (C vs A)':    diff(conds.C_noClass_darkMedia.syn_text, conds.A_noClass_lightMedia.syn_text),
  };
  const realChanged = Object.keys(conds.A_noClass_lightMedia.real).map(k => ({
    probe: k, cls: conds.A_noClass_lightMedia.real[k].cls,
    加类变化: diff(conds.B_darkClass_lightMedia.real[k], conds.A_noClass_lightMedia.real[k]),
    媒体变化: diff(conds.C_noClass_darkMedia.real[k], conds.A_noClass_lightMedia.real[k]),
  }));
  await ctx.close();
  return { login: login_, url, realProbes, summary, realChanged, conds };
}

// ============================================================================
// 实验 B：D-5 内联样式无界累加（用真实 store 反复切换）
// ============================================================================
async function expInlineGrowth() {
  const { ctx, page } = await freshCtx();
  await login(page);
  const res = await page.evaluate(async () => {
    const store = await window.__getStore();
    if (!store) return { error: 'store 不可达' };
    const de = document.documentElement;
    const len = () => (de.getAttribute('style')||'').length;
    const decls = () => ((de.getAttribute('style')||'').match(/--[a-zA-Z0-9_-]+\s*:/g)||[]).length;
    const dupes = () => { const m=(de.getAttribute('style')||'').match(/--[a-zA-Z0-9_-]+\s*:/g)||[]; const c={}; m.forEach(x=>c[x]=(c[x]||0)+1); return Object.entries(c).filter(([,n])=>n>1).length; };
    const s = [];
    s.push({ step:0, len:len(), decls:decls(), dupTokens:dupes() });
    for (let i=1;i<=8;i++){
      store.getState().setPresetTheme(i%2 ? 'dark-default' : 'light-default');
      await new Promise(r=>setTimeout(r,260));
      s.push({ step:i, len:len(), decls:decls(), dupTokens:dupes(), theme:de.getAttribute('data-theme'), mode:de.getAttribute('data-mode') });
    }
    return { samples: s, storeApi: Object.keys(store.getState()).slice(0,40) };
  });
  await ctx.close();
  return res;
}

// ============================================================================
// 实验 C：FOUC 时间线（持久化 dark → 冷启动采样）
// ============================================================================
async function expFouc() {
  const { ctx, page } = await freshCtx();
  await page.addInitScript(() => {
    try { localStorage.setItem('rmfood-theme-storage', JSON.stringify({
      state:{ activeThemeId:'dark-default', mode:'dark', accessibilityMode:'normal',
              motionPreferences:{reducedMotion:false,disableAnimations:false,scaleDownTransitions:false},
              transitionType:'fade', customThemes:[] }, version:4 })); } catch {}
  });

  const t0 = Date.now();
  const samples = [];
  await page.goto(BASE + '/login', { waitUntil: 'commit', timeout: 90000 });
  // 高频采样：class / body 背景 / 内联样式长度
  for (let i = 0; i < 90; i++) {
    const s = await page.evaluate(() => {
      const de = document.documentElement;
      return {
        cls: de.className,
        dataMode: de.getAttribute('data-mode'),
        bodyBg: document.body ? getComputedStyle(document.body).backgroundColor : null,
        htmlStyleLen: (de.getAttribute('style')||'').length,
      };
    }).catch(() => null);
    if (s) samples.push({ t: Date.now() - t0, ...s });
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(3000);
  const paints = await page.evaluate(() => performance.getEntriesByType('paint').map(p=>({name:p.name,t:Math.round(p.startTime)})));
  await page.screenshot({ path: OUT + '/fouc-after.png' });

  // 首次出现 body 有背景色的时刻 / 首次出现 dark 类的时刻
  const firstBg = samples.find(s => s.bodyBg && s.bodyBg !== 'rgba(0, 0, 0, 0)');
  const firstDark = samples.find(s => (s.cls||'').includes('dark'));
  await ctx.close();
  return { paints, firstBodyBg: firstBg, firstDarkClass: firstDark, sampleCount: samples.length,
           timeline: samples.filter((s,i)=> i%6===0 || (firstDark && Math.abs(s.t-firstDark.t)<200)).slice(0,30) };
}

// ============================================================================
// 实验 D：运行时"暗色盲区"自动探测（主题惰性元素）
// ============================================================================
async function expDarkBlindScan() {
  const { ctx, page } = await freshCtx();
  await login(page);
  await page.waitForTimeout(2500);

  const snapshot = () => page.evaluate(() => {
    const out = [];
    const all = [...document.querySelectorAll('body *')];
    all.forEach((e, idx) => {
      const r = e.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return;
      const cs = getComputedStyle(e);
      const bg = cs.backgroundColor, color = cs.color, bd = cs.borderTopColor;
      const inert = (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && bd.includes('0, 0, 0');
      if (inert && color === 'rgb(0, 0, 0)') return;      // 完全无样式，跳过
      out.push({
        i: idx,
        tag: e.tagName,
        cls: (typeof e.className === 'string' ? e.className : '').slice(0, 110),
        bg, color, bd,
        txt: (e.childElementCount === 0 ? (e.textContent||'').trim().slice(0,24) : ''),
      });
    });
    return out;
  });

  // 用真实 store 切到暗色
  const switched = await page.evaluate(async () => {
    const store = await window.__getStore(); if (!store) return false;
    store.getState().setPresetTheme('dark-default'); return true;
  });
  await page.waitForTimeout(1200);
  const dark = await snapshot();

  // 回到亮色再取一次基线（保证同一 DOM 快照口径）
  await page.evaluate(async () => { const s = await window.__getStore(); s?.getState().setPresetTheme('light-default'); });
  await page.waitForTimeout(900);
  const light = await snapshot();

  const byIdx = new Map(light.map(x => [x.i, x]));
  const inert = [];
  for (const d of dark) {
    const l = byIdx.get(d.i); if (!l) continue;
    if (l.cls !== d.cls) continue;                        // DOM 变了，跳过
    const bgSame = l.bg === d.bg, colSame = l.color === d.color, bdSame = l.bd === d.bd;
    const hasOpaqueBg = !(l.bg === 'rgba(0, 0, 0, 0)' || l.bg === 'transparent');
    if (bgSame && colSame && bdSame && hasOpaqueBg) {
      inert.push({ tag: d.tag, cls: d.cls, bg: d.bg, color: d.color, txt: d.txt, lightBg: l.bg, darkBg: d.bg });
    }
  }
  const lightOpaqueCount = light.filter(x => !(x.bg==='rgba(0, 0, 0, 0)'||x.bg==='transparent')).length;

  // 亮色浅底但暗色未变 = 高概率漏色
  const lightish = inert.filter(x => {
    const m = x.bg.match(/rgba?\(([^)]+)\)/); if (!m) return false;
    const p = m[1].split(',').map(Number);
    const lum = (0.2126*p[0]+0.7152*p[1]+0.0722*p[2])/255;
    return lum > 0.75;   // 亮色下是很浅的底，暗色下没变 → 漏色
  });

  await ctx.close();
  return {
    切换成功: switched, 元素总数: light.length, 亮色有不透明背景的元素: lightOpaqueCount,
    主题惰性元素数: inert.length,
    其中亮色浅底且暗色未变_高概率漏色: lightish.length,
    高概率漏色样例: lightish.slice(0, 18),
  };
}

// ============================================================================
// 实验 E：关键页面亮/暗对比截图
// ============================================================================
async function expScreenshots() {
  const { ctx, page } = await freshCtx();
  await login(page);
  const targets = [
    { name: 'dashboard',  path: '/dashboard' },
    { name: 'formulas',   path: '/formulas' },
    { name: 'settings',   path: '/settings' },
  ];
  const shots = [];
  for (const t of targets) {
    try {
      await page.goto(BASE + t.path, { waitUntil:'domcontentloaded', timeout:60000 });
      await page.waitForTimeout(3800);
      await page.evaluate(async () => { const s = await window.__getStore(); s?.getState().setPresetTheme('light-default'); });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${OUT}/${t.name}-light.png`, fullPage: false });
      await page.evaluate(async () => { const s = await window.__getStore(); s?.getState().setPresetTheme('dark-default'); });
      await page.waitForTimeout(1400);
      await page.screenshot({ path: `${OUT}/${t.name}-dark.png`, fullPage: false });
      const probe = await page.evaluate(() => ({
        url: location.href,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        h1: document.querySelector('h1')?.textContent?.trim()?.slice(0,50) ?? null,
      }));
      shots.push({ ...t, ...probe, ok: true });
    } catch (e) { shots.push({ ...t, ok:false, err: String(e).slice(0,160) }); }
  }
  await ctx.close();
  return shots;
}

// ---------- 执行 ----------
try { say('实验A_D-1_dark变体驱动源', await expDarkVariant()); }
catch (e) { say('实验A_D-1_dark变体驱动源', { error: String(e).slice(0,400) }); }
try { say('实验B_D-5_内联样式累加', await expInlineGrowth()); }
catch (e) { say('实验B_D-5_内联样式累加', { error: String(e).slice(0,400) }); }
try { say('实验C_D-11_FOUC时间线', await expFouc()); }
catch (e) { say('实验C_D-11_FOUC时间线', { error: String(e).slice(0,400) }); }
try { say('实验D_运行时暗色盲区扫描', await expDarkBlindScan()); }
catch (e) { say('实验D_运行时暗色盲区扫描', { error: String(e).slice(0,400) }); }
try { say('实验E_关键页面亮暗截图', await expScreenshots()); }
catch (e) { say('实验E_关键页面亮暗截图', { error: String(e).slice(0,400) }); }

fs.writeFileSync('D:/RMFOODFP/temp/theme-runtime-results2.json', JSON.stringify(R, null, 2), 'utf8');
console.log('\n===== 结果已写入 theme-runtime-results2.json =====');
await browser.close();
