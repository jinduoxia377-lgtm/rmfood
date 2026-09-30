// ============================================================================
// 最终合并取证：剩余路由白字对比度 + 无障碍刷新持久性 + 登录页亮暗截图
// ============================================================================
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const BASE='http://127.0.0.1:3000';
const OUT='D:/RMFOODFP/temp/theme-shots';

const HELPERS=`(function(){
  window.__store=null;
  window.__getStore=async function(){ if(window.__store) return window.__store;
    for (const p of ['/src/stores/themeStore.ts','/src/stores/themeStore']) {
      try { const m=await import(/* @vite-ignore */ p); if(m?.useThemeStore){window.__store=m.useThemeStore; return window.__store;} } catch(e){}
    } return null; };
  window.__setTheme=async function(id){ const s=await window.__getStore(); if(!s) return false; s.getState().setPresetTheme(id); return true; };
  window.__setA11y=async function(m){ const s=await window.__getStore(); if(!s) return false; s.getState().setAccessibilityMode(m); return true; };
  window.__lum=function(css){ const m=String(css).match(/rgba?\\(([^)]+)\\)/); if(!m) return null;
    const p=m[1].split(',').map(function(s){return parseFloat(s.trim());});
    const f=function(v){ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); };
    return 0.2126*f(p[0])+0.7152*f(p[1])+0.0722*f(p[2]); };
  window.__contrast=function(f,b){ const a=window.__lum(f), c=window.__lum(b); if(a===null||c===null) return null;
    const hi=Math.max(a,c), lo=Math.min(a,c); return Math.round(((hi+0.05)/(lo+0.05))*100)/100; };
  window.__markWhiteText=function(){ var n=0; var all=document.querySelectorAll('body *');
    for(var k=0;k<all.length;k++){ var e=all[k]; var cls=(typeof e.className==='string')?e.className:'';
      if(!/(^|\\s)text-white(\\/\\d+)?(\\s|$)/.test(cls)) continue;
      var r=e.getBoundingClientRect(); if(r.width<20||r.height<14) continue;
      e.setAttribute('data-wf', String(n)); n++; } return n; };
  window.__readMarked=function(){ var out=[]; var els=document.querySelectorAll('[data-wf]');
    for(var k=0;k<els.length;k++){ var e=els[k]; var cs=getComputedStyle(e); var cls=(typeof e.className==='string')?e.className:'';
      var bg=cs.backgroundColor;
      out.push({key:e.getAttribute('data-wf'),tag:e.tagName,cls:cls.slice(0,140),bg:bg,col:cs.color,
                transparent:(bg==='rgba(0, 0, 0, 0)'||bg==='transparent'),
                fill:(cls.match(/(?:^|\\s)bg-[\\w:/[\\]().,#%-]+/g)||[]).slice(0,2).join(' '),
                txt:(e.textContent||'').trim().slice(0,30)}); } return out; };
})();`;

const browser = await chromium.launch({ headless:true });
const ctx = await browser.newContext({ viewport:{width:1680,height:1050}, locale:'zh-CN', colorScheme:'light' });
const page = await ctx.newPage();
await page.addInitScript(HELPERS);

async function loginIfNeeded(){
  if (page.url().includes('/login') || !page.url().includes('3000')) {
    await page.goto(BASE+'/login',{waitUntil:'domcontentloaded',timeout:90000});
    await page.waitForTimeout(3200);
  }
  const pw = await page.$('input[type="password"]');
  if (pw) {
    await page.fill('#rhine-username, input[type="text"]','admin');
    await page.fill('#rhine-password, input[type="password"]','admin123');
    await page.locator('button[type="submit"], button:has-text("登录")').first().click();
    try{ await page.waitForURL(x=>!x.pathname.includes('/login'),{timeout:45000}); }catch{}
    await page.waitForTimeout(3800);
  }
}

const R = {};
await loginIfNeeded();

// ---- 1) 剩余路由：白字实底对比度 ----
const routes = ['/users','/ai','/dashboard','/formulas'];
const wf = [];
for (const route of routes) {
  try {
    await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:70000});
    await page.waitForTimeout(4200);
    await page.evaluate(async()=>{await window.__setTheme('light-default');});
    await page.waitForTimeout(1100);
    const marked = await page.evaluate(()=>window.__markWhiteText());
    const light = await page.evaluate(()=>window.__readMarked());
    await page.evaluate(async()=>{await window.__setTheme('dark-default');});
    await page.waitForTimeout(1500);
    const dark = await page.evaluate(()=>window.__readMarked());
    const dMap = new Map(dark.map(d=>[d.key,d]));
    const rows=[];
    for (const l of light){
      const d=dMap.get(l.key); if(!d) continue;
      if(l.transparent && d.transparent) continue;
      const lr = await page.evaluate(([f,b])=>window.__contrast(f,b),[l.col,l.bg]);
      const dr = await page.evaluate(([f,b])=>window.__contrast(f,b),[d.col,d.bg]);
      rows.push({cls:l.cls, fill:l.fill, lightBg:l.bg, darkBg:d.bg, lightRatio:lr, darkRatio:dr, txt:l.txt});
    }
    wf.push({route, 标记:marked, 有实底:rows.length,
             暗色不合格:rows.filter(r=>r.darkRatio!==null&&r.darkRatio<4.5).length,
             最低暗色对比度: rows.length?Math.min(...rows.map(r=>r.darkRatio??99)):null,
             明细:rows});
    await page.evaluate(async()=>{await window.__setTheme('light-default');});
    await page.waitForTimeout(600);
  } catch(e){ wf.push({route, err:String(e).slice(0,150)}); }
}
R.whiteOnFill = wf;

// ---- 2) 无障碍：交互设置 vs 刷新后是否保留 ----
try {
  await page.goto(BASE+'/dashboard',{waitUntil:'domcontentloaded',timeout:70000});
  await page.waitForTimeout(4000);
  const interactive = await page.evaluate(async()=>{
    const de=document.documentElement;
    await window.__setA11y('reading'); await new Promise(r=>setTimeout(r,800));
    return { dataA11y:de.getAttribute('data-a11y-mode'), dataReading:de.getAttribute('data-reading-mode'),
             dataTheme:de.getAttribute('data-theme'),
             bodyBg:getComputedStyle(document.body).backgroundColor,
             storage:JSON.parse(localStorage.getItem('rmfood-theme-storage')||'{}').state?.accessibilityMode };
  });
  // 刷新（模拟用户重载）
  await page.reload({ waitUntil:'domcontentloaded', timeout:70000 });
  await page.waitForTimeout(5000);
  const afterReload = await page.evaluate(()=>{
    const de=document.documentElement;
    return { dataA11y:de.getAttribute('data-a11y-mode'), dataReading:de.getAttribute('data-reading-mode'),
             dataTheme:de.getAttribute('data-theme'), dataMode:de.getAttribute('data-mode'),
             bodyBg:getComputedStyle(document.body).backgroundColor,
             textPrimary:getComputedStyle(de).getPropertyValue('--text-primary').trim(),
             storage:JSON.parse(localStorage.getItem('rmfood-theme-storage')||'{}').state?.accessibilityMode };
  });
  R.a11y = { interactive, afterReload,
             结论: { '交互设置时属性是否写入': (interactive.dataA11y&&interactive.dataReading)?'是':'否',
                     '刷新后属性是否保留': (afterReload.dataA11y&&afterReload.dataReading)?'是':'*** 否（丢失）***',
                     '刷新后dataTheme': afterReload.dataTheme,
                     '刷新后阅读主题是否仍生效': afterReload.dataTheme }
  };
  await page.evaluate(async()=>{await window.__setA11y('normal');});
} catch(e){ R.a11y = { err:String(e).slice(0,200) }; }

// ---- 3) 登录页亮/暗截图 ----
try {
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(3500);
  await page.evaluate(async()=>{await window.__setTheme('light-default');});
  await page.waitForTimeout(1200);
  await page.screenshot({path:OUT+'/login-light.png'});
  await page.evaluate(async()=>{await window.__setTheme('dark-default');});
  await page.waitForTimeout(1500);
  await page.screenshot({path:OUT+'/login-dark.png'});
  R.loginShots = { light: OUT+'/login-light.png', dark: OUT+'/login-dark.png' };
} catch(e){ R.loginShots = { err:String(e).slice(0,150) }; }

console.log(JSON.stringify(R,null,2));
fs.writeFileSync('D:/RMFOODFP/temp/theme-final-results.json', JSON.stringify(R,null,2),'utf8');
await ctx.close(); await browser.close();
