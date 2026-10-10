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

const SCAN = `(() => {
  const out = { issues: [], stats: {} };
  function effectiveBg(el) {
    let n = el;
    while (n && n !== document.documentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || 'rgba(0,0,0,0)';
  }
  const all = document.querySelectorAll('body *');
  let checked = 0;
  for (const e of all) {
    const r = e.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const txt = (e.innerText || '').trim();
    if (!txt || e.children.length > 0) continue;
    checked++;
    const cs = getComputedStyle(e);
    const color = cs.color;
    const bg = effectiveBg(e);
    const ratio = window.__contrast(color, bg);
    if (ratio === null) continue;
    const fs = parseFloat(cs.fontSize);
    const fw = parseInt(cs.fontWeight);
    const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const required = large ? 3 : 4.5;
    if (ratio < required) {
      out.issues.push({ text: txt.slice(0, 22), cls: String(e.className).slice(0, 50), ratio, required, color, bg });
    }
  }
  out.stats.checked = checked;
  out.stats.tabpanels = document.querySelectorAll('[role="tabpanel"]').length;
  out.stats.darkAttr = document.documentElement.className;
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
  await p.goto('http://127.0.0.1:3000/ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForTimeout(3000);
  // 关键：不 reload，直接在当前已挂载的 DOM 上切主题并等待 settle
  for (const mode of ['light-default', 'dark-default']) {
    await p.evaluate(async (m) => { await window.__setTheme(m); }, mode);
    // 等 themeStore 应用到 DOM + CSS 变量重解析（加长到 3s）
    await p.waitForTimeout(3000);
    const res = await p.evaluate(SCAN);
    console.log('\n══════ ' + mode + ' ══════  darkAttr=' + res.stats.darkAttr + '  tabpanels=' + res.stats.tabpanels + '  不达标 ' + res.issues.length + ' 处');
    res.issues.forEach(i => console.log('  [' + i.ratio + '/' + i.required + '] "' + i.text + '" 色=' + i.color + ' 底=' + i.bg + ' · ' + i.cls));
  }
  await b.close();
})().catch(e => { console.error('PROBE_ERR', e.message); process.exit(1); });
