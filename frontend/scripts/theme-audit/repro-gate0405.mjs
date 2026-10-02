// 复现 GATE-04/05 白字实底扫描（与 theme-gate.mjs 的 g0405 同逻辑）
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const SCAN_WHITE_ON_FILL = `(function(){
  var PALETTE_SCALE = /(?:^|\\s)bg-(primary|secondary|accent)-(?:[4-9][0-9][0-9]|950)(?:\\s|$|\\/)/;
  var out=[];
  var all=document.querySelectorAll('body *');
  for (var k=0;k<all.length;k++){
    var e=all[k];
    var cls=(typeof e.className==='string')?e.className:'';
    if(!/(^|\\s)text-white(\\/\\d+)?(\\s|$)/.test(cls)) continue;
    var r=e.getBoundingClientRect();
    if(r.width<20||r.height<14) continue;
    var cs=getComputedStyle(e);
    var bg=cs.backgroundColor;
    if(bg==='rgba(0, 0, 0, 0)'||bg==='transparent') continue;
    out.push({ cls:cls.slice(0,90), bg:bg, inverted:PALETTE_SCALE.test(cls),
      text:(e.textContent||'').trim().slice(0,20) });
  }
  return out;
})()`;

const RELATIVE_LUM = `(function(){
  window.__contrast=function(f,b){
    var lum=function(c){var m=String(c).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;
      var p=m[1].split(',').map(function(s){return parseFloat(s.trim());});
      var f2=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
      return 0.2126*f2(p[0])+0.7152*f2(p[1])+0.0722*f2(p[2]);};
    var a=lum(f),c=lum(b);if(a===null||c===null)return null;
    var hi=Math.max(a,c),lo=Math.min(a,c);return Math.round(((hi+0.05)/(lo+0.05))*100)/100;};
})();`;

(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await (await b.newContext({ locale: 'zh-CN', viewport: { width: 1680, height: 1050 } })).newPage();
  await p.addInitScript(RELATIVE_LUM);
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(4000);
  // 尝试登录进内网
  const pw = await p.$('input[type="password"]');
  if (pw) {
    await p.fill('#rhine-username, input[type="text"]', 'admin');
    await p.fill('#rhine-password, input[type="password"]', 'admin123');
    await p.locator('button[type="submit"], button:has-text("登录")').first().click();
    try { await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 40000 }); } catch {}
    await p.waitForTimeout(3000);
  }

  const routes = ['/dashboard', '/formulas', '/settings', '/users', '/ai',
                 '/analytics', '/database', '/experiments', '/workflow',
                 '/organizations', '/notifications', '/academic'];
  let bad = [], total = 0;
  const setTheme = (m) => p.evaluate(async (mode) => {
    const mod = await import('/src/stores/themeStore.ts');
    mod.useThemeStore.getState().setPresetTheme(mode);
  }, m);

  for (const rt of routes) {
    try {
      const resp = await p.goto('http://127.0.0.1:3000' + rt, { waitUntil: 'domcontentloaded', timeout: 70000 });
      await p.waitForTimeout(3600);
      const path = new URL(p.url()).pathname;
      if (path === '/404' || (resp && resp.status() === 404)) continue;
      for (const mode of ['light-default', 'dark-default']) {
        await setTheme(mode);
        await p.waitForTimeout(1400);
        const rows = await p.evaluate(() => {
          const SCAN = document.currentScript ? null : null; // placeholder
          // 直接内联扫描
          var PALETTE_SCALE = /(?:^|\s)bg-(primary|secondary|accent)-(?:[4-9][0-9][0-9]|950)(?:\s|$|\/)/;
          var out = [];
          var all = document.querySelectorAll('body *');
          for (var k = 0; k < all.length; k++) {
            var e = all[k];
            var cls = (typeof e.className === 'string') ? e.className : '';
            if (!/(^|\s)text-white(\/\d+)?(\s|$)/.test(cls)) continue;
            var r = e.getBoundingClientRect();
            if (r.width < 20 || r.height < 14) continue;
            var cs = getComputedStyle(e);
            var bg = cs.backgroundColor;
            if (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
            out.push({ cls: cls.slice(0, 90), bg: bg, inverted: PALETTE_SCALE.test(cls),
              text: (e.textContent || '').trim().slice(0, 20), color: cs.color });
          }
          return out;
        });
        total += rows.length;
        for (const r of rows) {
          const ratio = await p.evaluate(([f, bg]) => {
            // 在页面上下文计算
            var lum = function (c) {
              var m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null;
              var pp = m[1].split(',').map(s => parseFloat(s.trim()));
              var f2 = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
              return 0.2126 * f2(pp[0]) + 0.7152 * f2(pp[1]) + 0.0722 * f2(pp[2]);
            };
            var a = lum(f), c2 = lum(bg); if (a === null || c2 === null) return null;
            var hi = Math.max(a, c2), lo = Math.min(a, c2);
            return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
          }, [r.color, r.bg]);
          if (ratio !== null && ratio < 4.5) bad.push({ route: rt, mode, ratio, bg: r.bg, cls: r.cls, text: r.text, inverted: r.inverted });
        }
      }
    } catch {}
  }
  console.log('══ GATE-04/05 复现 ══');
  console.log('  扫描白字实底元素总数:', total);
  console.log('  低于 4.5:1 的元素:', bad.length);
  for (const x of bad.slice(0, 12)) console.log(`  ❌ [${x.route} ${x.mode}] ratio=${x.ratio} bg=${x.bg} inverted=${x.inverted}\n     cls=${x.cls.slice(0, 70)}`);
  await b.close();
})();
