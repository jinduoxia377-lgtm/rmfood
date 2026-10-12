// 干净复测：面板内文字对比度（亮/暗双态），并读实测计算色
const { chromium } = require('@playwright/test');
const CONTRAST = `(function(){
  window.__lum=function(css){const m=String(css).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;
    const p=m[1].split(',').map(function(s){return parseFloat(s.trim());});
    const f=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(p[0])+0.7152*f(p[1])+0.0722*f(p[2]);};
  window.__contrast=function(f,b){const a=window.__lum(f),c=window.__lum(b);if(a===null||c===null)return null;
    const hi=Math.max(a,c),lo=Math.min(a,c);return Math.round(((hi+0.05)/(lo+0.05))*100)/100;};
})();`;
const SCAN = `(() => {
  const out={issues:[],checked:0,samples:[]};
  function effBg(el){let n=el;while(n&&n!==document.documentElement){
    const bg=getComputedStyle(n).backgroundColor;
    if(bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')return bg; n=n.parentElement;}
    return getComputedStyle(document.body).backgroundColor;}
  for(const e of document.querySelectorAll('section, section *')){
    const r=e.getBoundingClientRect(); if(r.width<8||r.height<8)continue;
    const t=(e.innerText||'').trim(); if(!t||e.children.length>0)continue;
    out.checked++;
    const cs=getComputedStyle(e);
    const bg=effBg(e);
    const ratio=window.__contrast(cs.color,bg); if(ratio===null)continue;
    const fs=parseFloat(cs.fontSize),fw=parseInt(cs.fontWeight);
    const large=fs>=24||(fs>=18.66&&fw>=700);
    if(out.samples.length<3) out.samples.push({t:t.slice(0,16),color:cs.color,bg,ratio});
    if(ratio < (large?3:4.5)) out.issues.push({t:t.slice(0,20),color:cs.color,bg,r:ratio});
  }
  return out;
})();`;
const GROUP = (label) =>
  `[role="radiogroup"][aria-label="\u660e\u6697\u6a21\u5f0f"] [role="radio"]`;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.fill('input[type="text"]', 'admin');
  await p.fill('input[type="password"]', 'admin123');
  await p.click('button[type="submit"], button:has-text("进入平台")');
  await p.waitForTimeout(3000);
  await p.goto('http://localhost:3000/settings?tab=theme', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  await p.waitForSelector('section h3', { timeout: 20000 });
  await p.waitForTimeout(600);
  await p.addScriptTag({ content: CONTRAST });

  console.log('=== 亮色态 ===');
  console.log(JSON.stringify(await p.evaluate(SCAN), null, 1));

  await p.locator(GROUP()).nth(1).click();
  await p.waitForTimeout(1000);
  console.log('=== 深色态 ===');
  console.log(JSON.stringify(await p.evaluate(SCAN), null, 1));

  await b.close();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
