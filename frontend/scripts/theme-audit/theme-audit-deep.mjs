// ============================================================================
// RMFOOD 主题系统 — 真实浏览器深度核查
// 目标：用运行时证据验证/推翻静态审查的每一项"未经渲染确认"结论
// 只读：不修改仓库文件，仅在页面内做瞬时 DOM 探针
// ============================================================================
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const OUT = 'D:/RMFOODFP/temp/theme-shots';
fs.mkdirSync(OUT, { recursive: true });

const R = { };                       // 结果汇总
const say = (k, v) => { R[k] = v; console.log(`\n### ${k}\n` + JSON.stringify(v, null, 2)); };

// ---------- 工具：解析 rgb() → [r,g,b] ----------
const RELATIVE_LUM = `(function(){
  window.__lum = function(css){
    const m = String(css).match(/rgba?\\(([^)]+)\\)/); if(!m) return null;
    const p = m[1].split(',').map(s=>parseFloat(s.trim()));
    const f = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
    return 0.2126*f(p[0]) + 0.7152*f(p[1]) + 0.0722*f(p[2]);
  };
  window.__contrast = function(fg,bg){
    const a = window.__lum(fg), b = window.__lum(bg); if(a===null||b===null) return null;
    const hi = Math.max(a,b), lo = Math.min(a,b);
    return Math.round(((hi+0.05)/(lo+0.05))*100)/100;
  };
})();`;

const browser = await chromium.launch({ headless: true });

// ============================================================================
// 实验 1：D-1 — dark: 变体由 .dark 类驱动，还是由 prefers-color-scheme 驱动？
// ============================================================================
async function experimentDarkVariant() {
  const ctx = await browser.newContext({ viewport:{width:1600,height:1000}, colorScheme:'light', locale:'zh-CN' });
  const page = await ctx.newPage();
  await page.addInitScript(RELATIVE_LUM);
  await page.goto(BASE + '/login', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(4500);

  // 找一个真实存在、带 dark:bg-* 或 dark:text-* 的元素
  const found = await page.evaluate(() => {
    const els = [...document.querySelectorAll('*')];
    const hit = els.filter(e => {
      const c = typeof e.className === 'string' ? e.className : '';
      return /(^|\s)dark:(bg|text|border)-/.test(c) && e.getBoundingClientRect().width > 0;
    });
    return hit.slice(0, 6).map(e => ({
      tag: e.tagName, cls: e.className.slice(0,140),
      bg: getComputedStyle(e).backgroundColor, color: getComputedStyle(e).color,
    }));
  });

  const probeSelector = await page.evaluate(() => {
    const els = [...document.querySelectorAll('*')];
    const el = els.find(e => {
      const c = typeof e.className === 'string' ? e.className : '';
      return /(^|\s)dark:(bg|text|border)-/.test(c) && e.getBoundingClientRect().width > 0;
    });
    if (!el) return null;
    el.setAttribute('data-audit-probe', '1');
    return { tag: el.tagName, cls: el.className.slice(0,160) };
  });

  if (!probeSelector) { await ctx.close(); return { skipped:true, reason:'登录页未找到含 dark: 类的可见元素', found }; }

  const read = () => page.evaluate(() => {
    const e = document.querySelector('[data-audit-probe="1"]');
    const cs = getComputedStyle(e);
    return {
      htmlClass: document.documentElement.className,
      bg: cs.backgroundColor, color: cs.color, border: cs.borderTopColor,
    };
  });

  // (A) 基线：无 .dark，系统浅色
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.emulateMedia({ colorScheme:'light' });
  await page.waitForTimeout(400);
  const A = await read();

  // (B) 只加 .dark 类；系统仍为浅色  → 若 dark: 由类驱动，颜色应变化
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.emulateMedia({ colorScheme:'light' });
  await page.waitForTimeout(400);
  const B = await read();

  // (C) 只把系统切暗；移除 .dark 类  → 若 dark: 由媒体查询驱动，颜色应变化
  await page.evaluate(() => document.documentElement.classList.remove('dark'));
  await page.emulateMedia({ colorScheme:'dark' });
  await page.waitForTimeout(400);
  const C = await read();

  // (D) 两者都给
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await page.emulateMedia({ colorScheme:'dark' });
  await page.waitForTimeout(400);
  const D = await read();

  await ctx.close();
  const changed = (x,y) => x.bg!==y.bg || x.color!==y.color || x.border!==y.border;
  return {
    probe: probeSelector, found,
    A_base_noClass_lightMedia: A,
    B_darkClass_lightMedia:   B,
    C_noClass_darkMedia:      C,
    D_darkClass_darkMedia:    D,
    结论: {
      '加 .dark 类是否改变颜色 (B vs A)': changed(B,A) ? '是' : '否',
      '系统切暗是否改变颜色 (C vs A)':    changed(C,A) ? '是' : '否',
      '⇒ dark: 变体实际由谁驱动': changed(B,A) ? '`.dark` 类' : (changed(C,A) ? '`prefers-color-scheme` 媒体查询' : '两者皆非/无变化'),
    },
  };
}

// ============================================================================
// 实验 2：D-21 — 亮色模式下徽章对比度
// ============================================================================
async function experimentBadgeContrast() {
  const ctx = await browser.newContext({ viewport:{width:1600,height:1000}, colorScheme:'light', locale:'zh-CN' });
  const page = await ctx.newPage();
  await page.addInitScript(RELATIVE_LUM);
  await page.goto(BASE + '/login', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(4000);

  const res = await page.evaluate(() => {
    const mk = (cls) => {
      const d = document.createElement('div');
      d.className = cls; d.textContent = '草稿';
      d.style.position='fixed'; d.style.left='-9999px'; d.style.top='0';
      document.body.appendChild(d);
      const cs = getComputedStyle(d);
      const r = { cls, color: cs.color, background: cs.backgroundColor, padding: cs.padding, fontSize: cs.fontSize };
      return r;
    };
    // 真实存在的徽章类
    const exists = (cls) => {
      try { return [...document.styleSheets].some(ss => { try { return [...ss.cssRules].some(r => r.selectorText && r.selectorText.includes('.' + cls)); } catch { return false; } }); }
      catch { return false; }
    };
    const out = { probes: [], classExists: {} };
    for (const cls of ['badge-draft','badge-approved','badge-pending']) {
      out.classExists[cls] = exists(cls);
      out.probes.push(mk(cls));
    }
    // 令牌实际解析值
    const root = getComputedStyle(document.documentElement);
    out.tokens = {
      'badge-draft-text': root.getPropertyValue('--badge-draft-text').trim(),
      'badge-draft-bg':   root.getPropertyValue('--badge-draft-bg').trim(),
      'badge-approved-text': root.getPropertyValue('--badge-approved-text').trim(),
    };
    // 合成页面上真实徽章元素的对比度：以 body 为实际背景
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    out.bodyBg = bodyBg;
    out.contrast = {};
    for (const p of out.probes) {
      // 徽章背景是半透明，需要与 body 合成
      const m = p.background.match(/rgba?\(([^)]+)\)/);
      let effBg = p.background;
      if (m) {
        const parts = m[1].split(',').map(s=>parseFloat(s.trim()));
        const bb = bodyBg.match(/rgba?\(([^)]+)\)/);
        if (bb && parts.length === 4) {
          const b = bb[1].split(',').map(s=>parseFloat(s.trim()));
          const a = parts[3];
          effBg = `rgb(${Math.round(parts[0]*a + b[0]*(1-a))}, ${Math.round(parts[1]*a + b[1]*(1-a))}, ${Math.round(parts[2]*a + b[2]*(1-a))})`;
        }
      }
      out.contrast[p.cls] = { fg: p.color, rawBg: p.background, effectiveBg: effBg, ratio: window.__contrast(p.color, effBg) };
    }
    return out;
  });

  await ctx.close();
  return res;
}

// ============================================================================
// 实验 3：D-5 — 反复切换主题，<html> 内联样式是否无界增长？
// ============================================================================
async function experimentInlineGrowth() {
  const ctx = await browser.newContext({ viewport:{width:1600,height:1000}, colorScheme:'light', locale:'zh-CN' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(4000);

  const trace = await page.evaluate(async () => {
    const de = document.documentElement;
    const len = () => (de.getAttribute('style') || '').length;
    const declCount = () => ((de.getAttribute('style') || '').match(/--[a-zA-Z0-9_-]+\s*:/g) || []).length;
    const samples = [{ step: 0, len: len(), decls: declCount() }];
    for (let i = 1; i <= 6; i++) {
      // 直接驱动 store 的公开 action 不可得；改走 DOM class 往返 + 触发 Data 属性
      // 这里模拟 applyThemeToDOM 的累加行为：真实路径由 setPresetTheme 触发。
      // 用 URL 协议无法触发，故改为直接调用 window 上暴露的 store（若存在）。
      await new Promise(r => setTimeout(r, 60));
      const w = window;
      if (w.__RMFOOD_THEME_STORE__?.getState) {
        const s = w.__RMFOOD_THEME_STORE__.getState();
        s.setPresetTheme(i % 2 ? 'dark-default' : 'light-default');
      } else if (w.__themeStore?.getState) {
        const s = w.__themeStore.getState();
        s.setPresetTheme(i % 2 ? 'dark-default' : 'light-default');
      } else {
        // 回退：直接调用模块导出不可得 —— 记录并终止
        samples.push({ step: i, len: len(), decls: declCount(), note: 'store 未暴露于 window，无法编程触发' });
        continue;
      }
      await new Promise(r => setTimeout(r, 350));
      samples.push({ step: i, len: len(), decls: declCount(), theme: de.getAttribute('data-theme') });
    }
    return { samples, exposed: Object.keys(window).filter(k => /theme/i.test(k)).slice(0, 20) };
  });

  await ctx.close();
  return trace;
}

// ============================================================================
// 实验 4：D-11 — 持久化为 dark 后刷新，首屏是否闪烁（FOUC）
// ============================================================================
async function experimentFouc() {
  const ctx = await browser.newContext({ viewport:{width:1600,height:1000}, colorScheme:'light', locale:'zh-CN' });
  const page = await ctx.newPage();

  // 预置持久化状态：mode=dark（Zustand persist 正确键名与结构）
  await page.addInitScript(() => {
    try {
      localStorage.setItem('rmfood-theme-storage', JSON.stringify({
        state: { activeThemeId:'dark-default', mode:'dark', accessibilityMode:'normal',
                 motionPreferences:{reducedMotion:false,disableAnimations:false,scaleDownTransitions:false},
                 transitionType:'fade', customThemes:[] },
        version: 4,
      }));
    } catch {}
  });

  // 记录 .dark 出现的时刻 & 首屏背景
  await page.addInitScript(() => {
    window.__fouc = { darkClassAt: null, traces: [], firstBg: null, fcp: null };
    const t0 = performance.now();
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.attributeName === 'class') {
          window.__fouc.traces.push({ t: Math.round(performance.now()-t0), cls: document.documentElement.className });
          if (window.__fouc.darkClassAt === null && document.documentElement.classList.contains('dark')) {
            window.__fouc.darkClassAt = Math.round(performance.now()-t0);
          }
        }
        if (m.attributeName === 'style' && window.__fouc.firstStyleAt === undefined) {
          window.__fouc.firstStyleAt = Math.round(performance.now()-t0);
        }
      }
    });
    obs.observe(document.documentElement, { attributes:true, attributeFilter:['class','style'] });
    // 最早可观测的 body 背景
    const iv = setInterval(() => {
      if (document.body && window.__fouc.firstBg === null) {
        window.__fouc.firstBg = { t: Math.round(performance.now()-t0), bg: getComputedStyle(document.body).backgroundColor, cls: document.documentElement.className };
        clearInterval(iv);
      }
    }, 5);
    document.addEventListener('DOMContentLoaded', () => {
      window.__fouc.domContentLoaded = { t: Math.round(performance.now()-t0), cls: document.documentElement.className, bg: getComputedStyle(document.body).backgroundColor };
    });
  });

  await page.goto(BASE + '/login', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(5000);

  const fouc = await page.evaluate(() => {
    const paints = performance.getEntriesByType('paint').map(p => ({ name:p.name, t:Math.round(p.startTime) }));
    const de = document.documentElement;
    return {
      ...window.__fouc,
      paints,
      finalClass: de.className,
      finalDataMode: de.getAttribute('data-mode'),
      finalDataTheme: de.getAttribute('data-theme'),
      localStorageKeyAfter: (() => { try { const raw = localStorage.getItem('rmfood-theme-storage'); return raw ? JSON.parse(raw).state.mode : null; } catch { return 'parse-err'; } })(),
      legacyKeyPresent: localStorage.getItem('rmfood-theme-settings-v2'),
    };
  });

  // 早/晚截图对比
  await page.screenshot({ path: OUT + '/fouc-final.png' });
  await ctx.close();
  return fouc;
}

// ============================================================================
// 实验 5：暗色模式下令牌全景 + 无障碍属性持久性
// ============================================================================
async function experimentDarkTokensAndA11y() {
  const ctx = await browser.newContext({ viewport:{width:1600,height:1000}, colorScheme:'dark', locale:'zh-CN' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem('rmfood-theme-storage', JSON.stringify({
        state: { activeThemeId:'dark-default', mode:'dark', accessibilityMode:'reading',
                 motionPreferences:{reducedMotion:false,disableAnimations:false,scaleDownTransitions:false},
                 transitionType:'none', customThemes:[] },
        version: 4,
      }));
    } catch {}
  });
  await page.goto(BASE + '/login', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(6000);

  const res = await page.evaluate(() => {
    const de = document.documentElement;
    const cs = getComputedStyle(de);
    const p = n => cs.getPropertyValue(n).trim();
    return {
      htmlClass: de.className,
      dataTheme: de.getAttribute('data-theme'),
      dataMode: de.getAttribute('data-mode'),
      dataA11y: de.getAttribute('data-a11y-mode'),
      dataReadingMode: de.getAttribute('data-reading-mode'),
      colorScheme: de.style.colorScheme,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      bodyColor: getComputedStyle(document.body).color,
      tokens: {
        'color-primary': p('--color-primary'),
        'color-primary-main': p('--color-primary-main'),
        'text-primary': p('--text-primary'),
        'color-text-primary': p('--color-text-primary'),
        'bg-canvas': p('--bg-canvas'),
        'bg-primary': p('--bg-primary'),
        'background': p('--background'),
        'badge-draft-text': p('--badge-draft-text'),
        'color-neutral-50': p('--color-neutral-50'),
        'color-neutral-900': p('--color-neutral-900'),
        'card-bg-solid': p('--card-bg-solid'),
        'accent-6': p('--accent-6'),
        'accent-9': p('--accent-9'),
      },
      inlineLen: (de.getAttribute('style')||'').length,
    };
  });
  await page.screenshot({ path: OUT + '/dark-login.png' });
  await ctx.close();
  return res;
}

// ============================================================================
// 实验 6：Radix Themes 样式是否加载（D-41）
// ============================================================================
async function experimentRadix() {
  const ctx = await browser.newContext({ viewport:{width:1600,height:1000}, colorScheme:'light', locale:'zh-CN' });
  const page = await ctx.newPage();
  const cssRequests = [];
  page.on('response', r => {
    const u = r.url();
    if (/\.css(\?|$)/.test(u) || /radix/i.test(u)) cssRequests.push({ url: u.replace(BASE,''), status: r.status(), type: r.request().resourceType() });
  });
  await page.goto(BASE + '/login', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(5000);

  const res = await page.evaluate(() => {
    const rtEls = document.querySelectorAll('[class*="rt-"]');
    const themeRoot = document.querySelector('.radix-themes');
    const cs = themeRoot ? getComputedStyle(themeRoot) : null;
    return {
      radixThemesRootPresent: !!themeRoot,
      radixThemesClass: themeRoot ? themeRoot.className : null,
      rtClassElementCount: rtEls.length,
      // Radix 依赖 styles.css 定义 --accent-1..12 / --gray-1..12 / --space-*
      'accent-1': cs ? cs.getPropertyValue('--accent-1').trim() : null,
      'accent-3': cs ? cs.getPropertyValue('--accent-3').trim() : null,
      'gray-1': cs ? cs.getPropertyValue('--gray-1').trim() : null,
      'gray-12': cs ? cs.getPropertyValue('--gray-12').trim() : null,
      'radix-space-4': cs ? cs.getPropertyValue('--space-4').trim() : null,
      'radix-font-size-2': cs ? cs.getPropertyValue('--font-size-2').trim() : null,
      'radix-radius-3': cs ? cs.getPropertyValue('--radius-3').trim() : null,
      radixThemesComputedFontSize: cs ? cs.fontSize : null,
      radixThemesComputedFontFamily: cs ? cs.fontFamily.slice(0,80) : null,
      styleSheets: [...document.styleSheets].map(ss => ss.href ? ss.href.replace(location.origin,'') : 'inline').slice(0, 40),
    };
  });
  await ctx.close();
  return { ...res, cssRequests };
}

// ============================================================================
// 实验 7：图表取色通道（D-4 / D-43）
// ============================================================================
async function experimentChartVars() {
  const ctx = await browser.newContext({ viewport:{width:1600,height:1000}, colorScheme:'light', locale:'zh-CN' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil:'domcontentloaded', timeout:60000 });
  await page.waitForTimeout(4000);
  const res = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const p = n => cs.getPropertyValue(n).trim();
    const names = ['--color-text-primary','--color-text-secondary','--color-surface-default','--color-border-default',
                   '--color-border-divider','--color-primary-main','--color-success-main','--color-warning-main',
                   '--color-error-main','--color-info-main','--color-secondary-main','--color-success-light',
                   '--color-info-light','--color-warning-light','--color-error-light','--color-purple-400',
                   '--color-pink-500','--color-cyan-500','--color-sky-500','--color-chart-1','--color-chart-2'];
    const out = {}; for (const n of names) out[n] = p(n);
    return out;
  });
  await ctx.close();
  return res;
}

// ---------- 执行 ----------
try {
  say('实验1_D-1_dark变体驱动源', await experimentDarkVariant());
} catch (e) { say('实验1_D-1_dark变体驱动源', { error: String(e).slice(0,300) }); }
try {
  say('实验2_D-21_徽章对比度', await experimentBadgeContrast());
} catch (e) { say('实验2_D-21_徽章对比度', { error: String(e).slice(0,300) }); }
try {
  say('实验3_D-5_内联样式增长', await experimentInlineGrowth());
} catch (e) { say('实验3_D-5_内联样式增长', { error: String(e).slice(0,300) }); }
try {
  say('实验4_D-11_FOUC', await experimentFouc());
} catch (e) { say('实验4_D-11_FOUC', { error: String(e).slice(0,300) }); }
try {
  say('实验5_暗色令牌与a11y持久性', await experimentDarkTokensAndA11y());
} catch (e) { say('实验5_暗色令牌与a11y持久性', { error: String(e).slice(0,300) }); }
try {
  say('实验6_D-41_Radix样式', await experimentRadix());
} catch (e) { say('实验6_D-41_Radix样式', { error: String(e).slice(0,300) }); }
try {
  say('实验7_图表取色通道', await experimentChartVars());
} catch (e) { say('实验7_图表取色通道', { error: String(e).slice(0,300) }); }

fs.writeFileSync('D:/RMFOODFP/temp/theme-runtime-results.json', JSON.stringify(R, null, 2), 'utf8');
console.log('\n===== 结果已写入 D:/RMFOODFP/temp/theme-runtime-results.json =====');
await browser.close();
