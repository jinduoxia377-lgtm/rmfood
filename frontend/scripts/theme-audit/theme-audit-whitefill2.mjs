// ============================================================================
// 「反转色阶 + 白字」缺陷类扫描（修正版：用稳定属性标记元素，避免下标错位）
// ============================================================================
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';

const HELPERS = `(function(){
  window.__store=null;
  window.__getStore=async function(){ if(window.__store) return window.__store;
    for (const p of ['/src/stores/themeStore.ts','/src/stores/themeStore']) {
      try { const m=await import(/* @vite-ignore */ p); if(m?.useThemeStore){window.__store=m.useThemeStore; return window.__store;} } catch(e){}
    } return null; };
  window.__setTheme=async function(id){ const s=await window.__getStore(); if(!s) return false; s.getState().setPresetTheme(id); return true; };

  window.__lum=function(css){ const m=String(css).match(/rgba?\\(([^)]+)\\)/); if(!m) return null;
    const p=m[1].split(',').map(function(s){return parseFloat(s.trim());});
    const f=function(v){ v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
    return 0.2126*f(p[0])+0.7152*f(p[1])+0.0722*f(p[2]); };
  window.__contrast=function(f,b){ const a=window.__lum(f), c=window.__lum(b); if(a===null||c===null) return null;
    const hi=Math.max(a,c), lo=Math.min(a,c); return Math.round(((hi+0.05)/(lo+0.05))*100)/100; };

  // 第一遍：标记所有「带 text-white 且有尺寸」的元素
  window.__markWhiteText=function(){
    var n=0;
    var all=document.querySelectorAll('body *');
    for (var k=0;k<all.length;k++){
      var e=all[k];
      var cls=(typeof e.className==='string')?e.className:'';
      if(!/(^|\\s)text-white(\\/\\d+)?(\\s|$)/.test(cls)) continue;
      var r=e.getBoundingClientRect();
      if(r.width<20||r.height<14) continue;
      e.setAttribute('data-wf', String(n));
      var cs=getComputedStyle(e);
      n++;
    }
    return n;
  };
  // 第二遍：读回被标记元素
  window.__readMarked=function(){
    var out=[]; var els=document.querySelectorAll('[data-wf]');
    for (var k=0;k<els.length;k++){
      var e=els[k]; var cs=getComputedStyle(e); var cls=(typeof e.className==='string')?e.className:'';
      var bg=cs.backgroundColor;
      out.push({ key:e.getAttribute('data-wf'), tag:e.tagName, cls:cls.slice(0,140),
                 bg:bg, col:cs.color,
                 transparent:(bg==='rgba(0, 0, 0, 0)'||bg==='transparent'),
                 fill:(cls.match(/(?:^|\\s)bg-[\\w:/[\\]().,#%-]+/g)||[]).slice(0,2).join(' '),
                 txt:(e.textContent||'').trim().slice(0,30) });
    }
    return out;
  };
})();`;

const browser = await chromium.launch({ headless:true });
const ctx = await browser.newContext({ viewport:{width:1680,height:1050}, locale:'zh-CN', colorScheme:'light' });
const page = await ctx.newPage();
await page.addInitScript(HELPERS);
await page.goto(BASE+'/login',{waitUntil:'domcontentloaded',timeout:90000});
await page.waitForTimeout(3500);
await page.fill('#rhine-username, input[type="text"]','admin');
await page.fill('#rhine-password, input[type="password"]','admin123');
await page.locator('button[type="submit"], button:has-text("登录")').first().click();
try{ await page.waitForURL(x=>!x.pathname.includes('/login'),{timeout:45000}); }catch{}
await page.waitForTimeout(4000);

const routes = process.argv.slice(2).length ? process.argv.slice(2)
  : ['/dashboard','/formulas','/settings','/users','/ai','/login'];
const summary = []; const detail = {};

for (const route of routes) {
  try {
    await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:70000});
    await page.waitForTimeout(4000);
    await page.evaluate(async () => { await window.__setTheme('light-default'); });
    await page.waitForTimeout(1200);
    const marked = await page.evaluate(() => window.__markWhiteText());
    const light = await page.evaluate(() => window.__readMarked());
    await page.evaluate(async () => { await window.__setTheme('dark-default'); });
    await page.waitForTimeout(1600);
    const dark = await page.evaluate(() => window.__readMarked());
    await page.evaluate(async () => { await window.__setTheme('light-default'); });
    await page.waitForTimeout(700);

    const dMap = new Map(dark.map(d=>[d.key,d]));
    const rows = [];
    for (const l of light) {
      const d = dMap.get(l.key); if(!d) continue;
      if (l.transparent && d.transparent) continue;   // 无实底，跳过
      rows.push({ cls:l.cls, fill:l.fill, txt:l.txt,
                  lightBg:l.bg, darkBg:d.bg, lightCol:l.col, darkCol:d.col,
                  lightRatio:null, darkRatio:null });
    }
    // 算对比度（用元素自身文字色对自身背景）
    for (const r of rows) {
      r.lightRatio = await page.evaluate(([fg,bg]) => window.__contrast(fg,bg), [r.lightCol, r.lightBg]);
      r.darkRatio  = await page.evaluate(([fg,bg]) => window.__contrast(fg,bg), [r.darkCol,  r.darkBg]);
    }
    detail[route] = rows;
    const failing = rows.filter(r => r.darkRatio!==null && r.darkRatio<4.5);
    summary.push({
      route, 标记白字元素: marked, 有实底的白字元素: rows.length,
      暗色下对比度不足4_5: failing.length,
      暗色下严重不足3: rows.filter(r=>r.darkRatio!==null && r.darkRatio<3).length,
      最低暗色对比度: rows.length? Math.min(...rows.map(r=>r.darkRatio??99)) : null,
      样例: failing.slice(0,8).map(r=>({cls:r.cls.slice(0,100), fill:r.fill, lightBg:r.lightBg, darkBg:r.darkBg, darkRatio:r.darkRatio})),
    });
  } catch(e){ summary.push({route, err:String(e).slice(0,160)}); }
}

console.log(JSON.stringify({summary, detail}, null, 2));
fs.writeFileSync('D:/RMFOODFP/temp/theme-white-on-fill2.json', JSON.stringify({summary,detail},null,2),'utf8');
await ctx.close(); await browser.close();
