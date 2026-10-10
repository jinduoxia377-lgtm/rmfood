const { chromium } = require('@playwright/test');

// 相对亮度 + 对比度（与 theme-gate.mjs 同口径）
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

// 扫描：收集可见的文本元素，检测 ① 透明/近透明底上的白字 ② 低对比组合 ③ 超出视口/溢出
const SCAN = `(() => {
  const out = { issues: [], stats: {} };
  const bgs = new WeakMap();
  // 计算元素实底背景（向上找第一个非透明背景）
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
    // 只看文本叶子（无子元素文本内容的）
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
      out.issues.push({
        type: 'contrast',
        text: txt.slice(0, 24),
        tag: e.tagName,
        cls: String(e.className).slice(0, 100),
        color, bg, ratio, required,
        x: Math.round(r.x), y: Math.round(r.y),
      });
    }
    // 白字 on 白底（含透明底回落到 body 白底）
    if (/rgb\\(255, 255, 255\\)|rgba\\(255, 255, 255, (0?\\.\\d+|1)\\)/.test(color) && /rgb\\(255, 255, 255\\)/.test(bg)) {
      out.issues.push({ type: 'white-on-white', text: txt.slice(0, 24), cls: String(e.className).slice(0, 80) });
    }
  }
  // 溢出检测：页面水平溢出
  const scrollW = document.documentElement.scrollWidth;
  const winW = window.innerWidth;
  out.stats.horizontalOverflow = scrollW > winW + 2 ? scrollW - winW : 0;
  out.stats.checkedTextNodes = checked;
  // 收集 tab 按钮数 / 统计卡数
  out.stats.tabButtons = document.querySelectorAll('nav [role="tab"]').length;
  out.stats.statCards = document.querySelectorAll('[class*="rounded"]').length;
  // 长页面检查
  out.stats.pageHeight = document.documentElement.scrollHeight;
  return out;
})()`;

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.addInitScript(RELATIVE_LUM);
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(3000);
  const pw = await p.$('input[type="password"]');
  if (pw) {
    await p.fill('#rhine-username, input[type="username"], input[type="text"]', process.env.THEME_GATE_USER || 'admin');
    await p.fill('#rhine-password, input[type="password"]', process.env.THEME_GATE_PASS || 'admin123');
    await p.locator('button[type="submit"], button:has-text("登录")').first().click();
    try { await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 45000 }); } catch {}
    await p.waitForTimeout(3500);
  }
  for (const mode of ['light-default', 'dark-default']) {
    for (const tab of ['chat', 'config']) {
      await p.goto('http://127.0.0.1:3000/ai', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForTimeout(2500);
      // 切 tab（点击 tab 按钮）
      if (tab !== 'chat') {
        const btn = p.locator('button[role="tab"]:has-text("配置管理")').first();
        try { await btn.click({ timeout: 5000 }); await p.waitForTimeout(1800); } catch {}
      }
      await p.evaluate(async (m) => { await window.__setTheme(m); }, mode);
      await p.waitForTimeout(1500);
      const res = await p.evaluate(SCAN);
      console.log('\\n══════ ' + mode + ' / tab=' + tab + ' ══════');
      console.log('stats: ' + JSON.stringify(res.stats));
      const low = res.issues.filter(i => i.type === 'contrast');
      const wow = res.issues.filter(i => i.type === 'white-on-white');
      console.log('对比度不达标 ' + low.length + ' 处，白底白字 ' + wow.length + ' 处');
      low.slice(0, 12).forEach(i => console.log('  [contrast ' + i.ratio + '/' + i.required + '] "' + i.text + '" <' + i.tag + '> ' + i.cls.slice(0, 60)));
      wow.slice(0, 5).forEach(i => console.log('  [white-on-white] "' + i.text + '" ' + i.cls.slice(0, 60)));
    }
  }
  await b.close();
})().catch(e => { console.error('PROBE_ERR', e.message); process.exit(1); });
