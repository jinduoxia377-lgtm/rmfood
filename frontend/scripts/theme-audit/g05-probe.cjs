const { chromium } = require('@playwright/test');
const RELATIVE_LUM = `(function(){
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

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1680, height: 1050 }, locale: 'zh-CN', colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.addInitScript(RELATIVE_LUM);
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await p.waitForTimeout(3200);
  const pw = await p.$('input[type="password"]');
  if (pw) {
    await p.fill('#rhine-username, input[type="username"], input[type="text"]', process.env.THEME_GATE_USER || 'admin');
    await p.fill('#rhine-password, input[type="password"]', process.env.THEME_GATE_PASS || 'admin123');
    await p.locator('button[type="submit"], button:has-text("登录")').first().click();
    try { await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 45000 }); } catch {}
    await p.waitForTimeout(4000);
  }
  for (const route of ['/settings', '/users']) {
    await p.goto('http://127.0.0.1:3000' + route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await p.waitForTimeout(3600);
    await p.evaluate(async () => { await window.__setTheme('light-default'); });
    await p.waitForTimeout(1300);
    const rows = await p.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll('body *')) {
        const cls = typeof e.className === 'string' ? e.className : '';
        if (!/(^|\s)text-white(\/\d+)?(\s|$)/.test(cls)) continue;
        const r = e.getBoundingClientRect();
        if (r.width < 20 || r.height < 14) continue;
        const cs = getComputedStyle(e);
        const bg = cs.backgroundColor;
        if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
        if (bg !== 'rgb(255, 255, 255)' && !bg.startsWith('rgba(255, 255, 255')) continue;
        const ratio = window.__contrast(cs.color, bg);
        out.push({ cls: cls.slice(0, 150), tag: e.tagName, text: (e.textContent || '').trim().slice(0, 20),
                   ratio: ratio, inlineBg: e.style.backgroundColor });
      }
      return out;
    });
    console.log('\n== ' + route + ' 白底 text-white（GATE-05 1:1 根源）==');
    if (rows.length === 0) console.log('  (无)');
    rows.forEach(r => console.log('  <' + r.tag + '> ratio=' + r.ratio + (r.inlineBg ? ' inline=' + r.inlineBg : '') + ' [' + r.cls + ']'));
  }
  await b.close();
})().catch(e => { console.error('PROBE_ERR', e.message); process.exit(1); });
