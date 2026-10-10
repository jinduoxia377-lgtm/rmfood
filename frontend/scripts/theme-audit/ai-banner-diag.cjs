const { chromium } = require('@playwright/test');

const LUM = `(function(){
  window.__lum=function(css){const m=String(css).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;
    const p=m[1].split(',').map(function(s){return parseFloat(s.trim());});
    const f=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(p[0])+0.7152*f(p[1])+0.0722*f(p[2]);};
  window.__contrast=function(f,b){const a=window.__lum(f),c=window.__lum(b);if(a===null||c===null)return null;
    const hi=Math.max(a,c),lo=Math.min(a,c);return Math.round(((hi+0.05)/(lo+0.05))*100)/100;};
  window.__store=null;
  window.__getStore=async function(){ if(window.__store) return window.__store;
    for (const p of ['/src/stores/themeStore.ts','/src/stores/themeStore']) {
      try{const m=await import(p); if(m&&m.useThemeStore){window.__store=m.useThemeStore;return window.__store;}}catch(e){}
    } return null; };
  window.__setTheme=async function(id){const s=await window.__getStore();if(!s)return false;s.getState().setPresetTheme(id);return true;};
})();`;

const DIAG = `(() => {
  const out = {};
  const bannerP = [...document.querySelectorAll('p')].find(p => p.textContent && p.textContent.includes('智能对话 · 配方生成'));
  if (!bannerP) return { err: 'banner not found' };
  const cs = getComputedStyle(bannerP);
  out.color = cs.color;
  out.htmlDark = document.documentElement.className;
  // 找 .text-white 规则 + .dark .dark\\:text-emerald-950 规则
  let whiteRule = null, darkEmeraldRule = null;
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const r of rules) {
      const txt = r.selectorText || '';
      if (txt.includes('text-white') && !txt.includes('dark')) {
        if (r.style && r.style.color) whiteRule = { sel: txt.slice(0,60), color: r.style.color, prio: r.style.getPropertyPriority('color') };
      }
      if (txt.includes('dark\\\\:text-emerald-950') || txt.includes('dark:text-emerald-950')) {
        darkEmeraldRule = { sel: txt.slice(0,60), color: r.style.color, prio: r.style.getPropertyPriority('color') };
      }
    }
  }
  out.whiteRule = whiteRule;
  out.darkEmeraldRule = darkEmeraldRule;
  // 直接读 emerald-950 与 white/90 的 Tailwind 变量值
  const rootStyle = getComputedStyle(document.documentElement);
  out.emerald950 = rootStyle.getPropertyValue('--color-emerald-950') || '(未定义)';
  // 横幅实际 surface bg
  let surf = bannerP;
  while (surf && !String(surf.className).includes('surface-primary')) surf = surf.parentElement;
  out.surfaceBg = surf ? getComputedStyle(surf).backgroundColor : 'n/a';
  out.contrast = window.__contrast(cs.color, getComputedStyle(surf).backgroundColor);
  // 在 <p> 上手动加 inline style 测试 emerald-950 是否生效
  const testEl = document.createElement('span');
  testEl.className = 'dark:text-emerald-950/80';
  testEl.textContent = 'x';
  testEl.style.position = 'absolute'; testEl.style.visibility = 'hidden';
  bannerP.appendChild(testEl);
  out.darkClassComputed = getComputedStyle(testEl).color;
  bannerP.removeChild(testEl);
  return out;
})()`;

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const p = await ctx.newPage();
  await p.addInitScript(LUM);
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  const pw = await p.$('input[type="password"]');
  if (pw) {
    await p.fill('input[type="text"]', process.env.THEME_GATE_USER || 'admin');
    await p.fill('input[type="password"]', process.env.THEME_GATE_PASS || 'admin123');
    await p.locator('button[type="submit"], button:has-text("登录"), button:has-text("进入平台")').first().click();
    try { await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 45000 }); } catch {}
    await p.waitForTimeout(3500);
  }
  await p.goto('http://127.0.0.1:3000/ai', { waitUntil: 'networkidle', timeout: 30000 });
  await p.waitForTimeout(2500);
  for (const mode of ['light-default', 'dark-default']) {
    await p.evaluate(async (m) => { await window.__setTheme(m); }, mode);
    await p.waitForTimeout(1500);
    const res = await p.evaluate(DIAG);
    console.log('\n══════ ' + mode + ' ══════');
    console.log(JSON.stringify(res, null, 2));
  }
  await b.close();
})().catch(e => { console.error('PROBE_ERR', e.message); process.exit(1); });
