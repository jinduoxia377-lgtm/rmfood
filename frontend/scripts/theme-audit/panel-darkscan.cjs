// 定位 ThemePanel 在暗色模式下的真实文字/底色对比度
// 目的：确认 text-neutral-900 类无 dark: 变体的标签在暗色下是否真的失效
const { chromium } = require('@playwright/test');

const LUM = `(function(){
  window.__lum=function(c){const m=String(c).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;
    const p=m[1].split(',').map(function(s){return parseFloat(s.trim());});
    const f=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(p[0])+0.7152*f(p[1])+0.0722*f(p[2]);};
  window.__parse=(c)=>{const m=String(c).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;
    const p=m[1].split(',').map(function(s){return parseFloat(s.trim());});
    return {r:p[0],g:p[1],b:p[2],a:p.length===4?p[3]:1};};
})();`;

const SCAN = `(() => {
  function effBg(el){
    const stack=[]; let n=el.parentElement;
    while(n){const bg=getComputedStyle(n).backgroundColor;
      if(bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')stack.push(bg); n=n.parentElement;}
    let acc=null;
    for(let i=stack.length-1;i>=0;i--){
      const layer=window.__parse(stack[i]); if(!layer)continue;
      if(!acc){acc=layer;continue;}
      const a=layer.a,b=acc.a*(1-a),A=a+b; if(A===0)continue;
      acc={r:(layer.r*a+acc.r*b)/A,g:(layer.g*a+acc.g*b)/A,b:(layer.b*a+acc.b*b)/A,a:A};}
    const own=window.__parse(getComputedStyle(el).backgroundColor);
    if(own&&own.a>0){
      if(!acc){acc=own;}else{const a=own.a,b=acc.a*(1-a),A=a+b; if(A>0)
      acc={r:(own.r*a+acc.r*b)/A,g:(own.g*a+acc.g*b)/A,b:(own.b*a+acc.b*b)/A,a:A};}}
    if(!acc)acc={r:255,g:255,b:255,a:1};
    if(acc.a<1){const a=1-acc.a;
      acc={r:(acc.r*acc.a+255*a),g:(acc.g*acc.a+255*a),b:(acc.b*acc.a+255*a),a:1};}
    return 'rgb('+Math.round(acc.r)+', '+Math.round(acc.g)+', '+Math.round(acc.b)+')';
  }
  const out=[];
  for(const e of document.querySelectorAll('body *')){
    const r=e.getBoundingClientRect(); if(r.width<8||r.height<8)continue;
    const t=(e.innerText||'').trim(); if(!t||e.children.length>0)continue;
    const cs=getComputedStyle(e);
    const a=window.__lum(cs.color), b=window.__lum(effBg(e));
    if(a===null||b===null)continue;
    const ratio=Math.round(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05))*100)/100;
    if(ratio<4.5) out.push({t:t.slice(0,24),ratio,color:cs.color,bg:effBg(e),cls:String(e.className).slice(0,60)});
  }
  return {dark:document.documentElement.classList.contains('dark'),count:out.length,issues:out};
})();`;

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.addInitScript(LUM);
  await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.fill('input[type="text"]', 'admin');
  await p.fill('input[type="password"]', 'admin123');
  await p.click('button[type="submit"], button:has-text("进入平台")');
  await p.waitForTimeout(2500);
  await p.goto('http://localhost:3000/settings?tab=theme', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);

  const GROUP = (l) => `[role="radiogroup"][aria-label="${l}"] [role="radio"]`;
  const cases = [
    ['light', 0, null],
    ['dark+brand', 1, 0],
    ['dark+blue', 1, 1],
    ['dark+red', 1, 4],
  ];
  for (const [tag, modeIdx, paletteIdx] of cases) {
    await p.locator(GROUP('明暗模式')).nth(modeIdx).click();
    await p.waitForTimeout(600);
    if (paletteIdx !== null) {
      await p.locator(GROUP('配色方案')).nth(paletteIdx).click();
      await p.waitForTimeout(600);
    }
    const r = await p.evaluate(SCAN);
    console.log(`\n=== ${tag} (dark=${r.dark}) 问题 ${r.count} 处 ===`);
    r.issues.slice(0, 14).forEach((i) =>
      console.log(`  ${String(i.ratio).padEnd(6)} "${i.t}" 色=${i.color} 底=${i.bg}\n          cls=${i.cls}`));
  }
  await b.close();
})().catch((e) => { console.error('PROBE_ERR', e.message); process.exit(1); });
