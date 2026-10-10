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

const BANNER = `(() => {
  const bannerP = [...document.querySelectorAll('p')].find(p => p.textContent && p.textContent.includes('智能对话 · 配方生成'));
  if (!bannerP) return { err: 'banner not found' };
  // 向上找 surface-primary 容器
  let surf = bannerP;
  while (surf && !String(surf.className).includes('surface-primary')) surf = surf.parentElement;
  const bgEl = surf || bannerP;
  const cs = getComputedStyle(bannerP);
  const bgCs = getComputedStyle(bgEl);
  // 读 surface-primary 的实际背景（可能是 gradient 或 solid）
  const surfaceClass = document.querySelector('.surface-primary');
  return {
    pClass: bannerP.className,
    pColor: cs.color,
    surfaceTag: surfaceClass ? surfaceClass.tagName + '.' + String(surfaceClass.className).slice(0,40) : '(无 .surface-primary)',
    bgElBg: bgCs.backgroundColor,
    bgElImage: bgCs.backgroundImage.slice(0, 80),
    htmlDark: document.documentElement.className,
    htmlStyle: document.documentElement.getAttribute('style') || '',
    bodyBg: getComputedStyle(document.body).backgroundColor,
  };
})()`;

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const p = await ctx.newPage();
  await p.addInitScript(RELATIVE_LUM);
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
    const res = await p.evaluate(BANNER);
    console.log('\n══════ ' + mode + ' ══════');
    console.log(JSON.stringify(res, null, 2));
  }
  await b.close();
})().catch(e => { console.error('PROBE_ERR', e.message); process.exit(1); });
