// 测量「bg-primary-container + text-primary-main」配对在双模式 × 各配色下的真实对比度
// 该配对是全站 89 处使用的 L2 语义模式（semantic-utils.css:16,18）。
//
// D6 修复：底色必须按「自身 + 祖先链」逐层 alpha 合成。
// 旧实现直接把 cs.backgroundColor 喂给对比度函数，半透明底色（rgba(...,0.15)）
// 的 alpha 被静默丢弃、当作不透明色参与计算 —— 暗色下把真实的 ~7.7:1 误读成 1.0:1。
// Tailwind v4 的 bg-white/90 还会编译成 color-mix()，同样无法被 rgba 正则解析，
// 会一路穿透到祖先底色（settings 页「安全诊断」即由此产生 2.67:1 假低值）。
const { chromium } = require('@playwright/test');

const LUM = `(function(){
  window.__parse=function(css){
    const s=String(css).trim();
    let m=s.match(/rgba?\\(([^)]+)\\)/);
    if(m){const p=m[1].split(',').map(function(x){return parseFloat(x.trim());});
      return {r:p[0],g:p[1],b:p[2],a:p.length===4?p[3]:1};}
    // color-mix(in <space>, <c1> <pct>, transparent) —— Tailwind v4 的 alpha 语法
    m=s.match(/color-mix\\(in\\s+[^,]+,\\s*([^ ]+)\\s+([0-9.]+)%,\\s*transparent\\)/);
    if(m){const c=window.__parse(m[1]); if(!c)return null;
      const f=parseFloat(m[2])/100; return {r:c.r,g:c.g,b:c.b,a:f};}
    m=s.match(/^#([0-9a-f]{6})$/i);
    if(m){const h=m[1];
      return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),a:1};}
    return null;};
  window.__lum=function(css){const p=window.__parse(css); if(!p)return null;
    const f=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(p.r)+0.7152*f(p.g)+0.0722*f(p.b);};
  window.__contrast=function(f,b){const a=window.__lum(f),c=window.__lum(b);
    if(a===null||c===null)return null;
    const hi=Math.max(a,c),lo=Math.min(a,c);
    return Math.round(((hi+0.05)/(lo+0.05))*100)/100;};
  /** 有效底色：自身 + 全部祖先逐层 alpha 合成，最终与页面白底合成 */
  window.__effBg=function(el){
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
      if(!acc){acc=own;}else{
        const a=own.a,b=acc.a*(1-a),A=a+b; if(A>0)
        acc={r:(own.r*a+acc.r*b)/A,g:(own.g*a+acc.g*b)/A,b:(own.b*a+acc.b*b)/A,a:A};}}
    if(!acc)acc={r:255,g:255,b:255,a:1};
    if(acc.a<1){const a=1-acc.a;
      acc={r:(acc.r*acc.a+255*a),g:(acc.g*acc.a+255*a),b:(acc.b*acc.a+255*a),a:1};}
    return 'rgb('+Math.round(acc.r)+', '+Math.round(acc.g)+', '+Math.round(acc.b)+')';};
})();`;

const MEASURE = `(() => {
  const mk = (cls) => {
    const d = document.createElement('div');
    d.className = cls + ' fixed -left-[9999px] top-0 px-4 py-2 text-sm font-medium';
    d.textContent = '示例文字';
    document.body.appendChild(d);
    const cs = getComputedStyle(d);
    const bg = window.__effBg(d);
    const row = { cls, color: cs.color, bgRaw: cs.backgroundColor, bg, ratio: window.__contrast(cs.color, bg) };
    d.remove();
    return row;
  };
  const s = getComputedStyle(document.documentElement);
  return {
    dark: document.documentElement.classList.contains('dark'),
    tokens: {
      primary: s.getPropertyValue('--color-primary').trim(),
      container: s.getPropertyValue('--color-primary-container').trim(),
      surface: s.getPropertyValue('--color-primary-surface').trim(),
      onSurface: s.getPropertyValue('--color-on-primary-surface').trim(),
    },
    pairs: [
      mk('bg-primary-container text-primary-main'),
      mk('bg-primary-container text-primary-700'),
      mk('surface-primary'),
    ],
  };
})();`;

(async () => {
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const p = await ctx.newPage();
  await p.addInitScript(LUM);
  await p.goto('http://127.0.0.1:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);
  const pw = await p.$('input[type="password"]');
  if (pw) {
    await p.fill('input[type="text"]', 'admin');
    await p.fill('input[type="password"]', 'admin123');
    await p.locator('button[type="submit"], button:has-text("登录"), button:has-text("进入平台")').first().click();
    try { await p.waitForURL(u => !u.pathname.includes('/login'), { timeout: 45000 }); } catch {}
    await p.waitForTimeout(3000);
  }
  await p.goto('http://127.0.0.1:3000/settings?tab=theme', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(2500);

  const GROUP = (l) => `[role="radiogroup"][aria-label="${l}"] [role="radio"]`;
  const paletteNames = ['green', 'blue', 'purple', 'orange', 'red'];

  for (const modeIdx of [0, 1]) {
    await p.locator(GROUP('明暗模式')).nth(modeIdx).click();
    await p.waitForTimeout(700);
    for (let pi = 0; pi < paletteNames.length; pi++) {
      await p.locator(GROUP('配色方案')).nth(pi).click();
      await p.waitForTimeout(500);
      const r = await p.evaluate(MEASURE);
      const ok = (x) => (x === null ? 'n/a ' : (x >= 4.5 ? '✅' : '❌'));
      const a = r.pairs[0], t = r.pairs[1], s = r.pairs[2];
      console.log(
        `[${r.dark ? 'dark ' : 'light'}] ${paletteNames[pi].padEnd(7)} ` +
        `${String(a.ratio).padEnd(6)}${ok(a.ratio)} main-on-container | ` +
        `${String(t.ratio).padEnd(6)}${ok(t.ratio)} primary-700 | ` +
        `${String(s.ratio).padEnd(6)}${ok(s.ratio)} surface-primary | ` +
        `container=${r.tokens.container}`
      );
    }
  }
  await b.close();
})().catch(e => { console.error('PROBE_ERR', e.message); process.exit(1); });
