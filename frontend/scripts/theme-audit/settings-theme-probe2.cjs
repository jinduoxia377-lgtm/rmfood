// /settings?tab=theme 「主题」面板功能实测
// 校验：区块渲染 / 明暗切换 / 配色注入覆盖率 / 字号注入 / 刷新持久性 / 选中态 / 对比度
const { chromium } = require('@playwright/test');

const CONTRAST = `(function(){
  window.__lum=function(css){const m=String(css).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;
    const p=m[1].split(',').map(function(s){return parseFloat(s.trim());});
    const f=function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
    return 0.2126*f(p[0])+0.7152*f(p[1])+0.0722*f(p[2]);};
  window.__contrast=function(f,b){const a=window.__lum(f),c=window.__lum(b);if(a===null||c===null)return null;
    const hi=Math.max(a,c),lo=Math.min(a,c);return Math.round(((hi+0.05)/(lo+0.05))*100)/100;};
})();`;

const SCOPED_SCAN = `(() => {
  const out={issues:[],checked:0};
  const parse=(c)=>{const m=String(c).match(/rgba?\\(([^)]+)\\)/);if(!m)return null;
    const p=m[1].split(',').map(function(s){return parseFloat(s.trim());});
    return {r:p[0],g:p[1],b:p[2],a:p.length===4?p[3]:1};};
  /**
   * 有效底色：元素自身底色与全部祖先底色逐层 alpha 合成。
   * 旧实现只取「第一个不透明的祖先底色」，半透明卡片叠在半透明/浅色页底上
   * 时会漏算底层实底，把真实的 ~9.6:1 误判成 2.03:1（假低值，D5）。
   */
  function effBg(el){
    const stack=[];
    let n=el.parentElement;
    while(n){const bg=getComputedStyle(n).backgroundColor;
      if(bg&&bg!=='rgba(0, 0, 0, 0)'&&bg!=='transparent')stack.push(bg); n=n.parentElement;}
    let acc=null;
    for(let i=stack.length-1;i>=0;i--){
      const layer=parse(stack[i]); if(!layer)continue;
      if(!acc){acc=layer;continue;}
      const a=layer.a,b=acc.a*(1-a),A=a+b; if(A===0)continue;
      acc={r:(layer.r*a+acc.r*b)/A,g:(layer.g*a+acc.g*b)/A,b:(layer.b*a+acc.b*b)/A,a:A};
    }
    const own=parse(getComputedStyle(el).backgroundColor);
    if(own&&own.a>0){
      if(!acc){acc=own;}else{
        const a=own.a,b=acc.a*(1-a),A=a+b; if(A>0)
        acc={r:(own.r*a+acc.r*b)/A,g:(own.g*a+acc.g*b)/A,b:(own.b*a+acc.b*b)/A,a:A};}
    }
    if(!acc)acc={r:255,g:255,b:255,a:1};
    if(acc.a<1){const a=1-acc.a;
      acc={r:(acc.r*acc.a+255*a),g:(acc.g*acc.a+255*a),b:(acc.b*acc.a+255*a),a:1};}
    return 'rgb('+Math.round(acc.r)+', '+Math.round(acc.g)+', '+Math.round(acc.b)+')';
  }
  for(const e of document.querySelectorAll('body *')){
    const r=e.getBoundingClientRect(); if(r.width<8||r.height<8)continue;
    const t=(e.innerText||'').trim(); if(!t||e.children.length>0)continue;
    out.checked++;
    const cs=getComputedStyle(e);
    const ratio=window.__contrast(cs.color,effBg(e)); if(ratio===null)continue;
    const fs=parseFloat(cs.fontSize),fw=parseInt(cs.fontWeight);
    const large=fs>=24||(fs>=18.66&&fw>=700);
    if(ratio < (large?3:4.5)) out.issues.push({t:t.slice(0,26),r:ratio});
  }
  return out;
})();`;

const GROUP = (label) => `[role="radiogroup"][aria-label="${label}"] [role="radio"]`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const base = 'http://localhost:3000/settings?tab=theme';

  // 登录（/settings 为受保护路由，未登录跳 /login）
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"], button:has-text("进入平台")');
  await page.waitForTimeout(3000);

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const R = {};
  R.url = page.url();

  // ① 区块与控件渲染
  R.headings = await page.evaluate(() =>
    [...document.querySelectorAll('section h3')].map(h => h.textContent.trim()));
  R.counts = {
    mode: await page.locator(GROUP('明暗模式')).count(),
    transition: await page.locator(GROUP('过渡动画')).count(),
    font: await page.locator(GROUP('字体大小')).count(),
    palette: await page.locator(GROUP('配色方案')).count(),
    reducedMotionSwitch: await page.locator('[role="switch"][aria-label="切换减少动画"]').count(),
  };
  R.a11yModeInPanel = await page.evaluate(() =>
    [...document.querySelectorAll('section')].some(s => /无障碍模式|阅读模式|高对比度/.test(s.innerText || '')));

  // ② 明暗切换
  R.darkBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.locator(GROUP('明暗模式')).nth(1).click();
  await page.waitForTimeout(800);
  R.darkAfterClick = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  R.modeAriaChecked = await page.evaluate(() =>
    [...document.querySelectorAll('[role="radiogroup"][aria-label="明暗模式"] [role="radio"]')]
      .map(b => b.getAttribute('aria-checked')));

  // ③ 配色注入覆盖率
  R.primary500Before = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-primary-500').trim());
  await page.locator(GROUP('配色方案')).nth(1).click();
  await page.waitForTimeout(600);
  R.primaryScaleAfter = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    const tiers = ['50','100','200','300','400','500','600','700','800','900','950'];
    return tiers.reduce((a,t) => { a[t] = s.getPropertyValue('--color-primary-'+t).trim(); return a; }, {});
  });
  R.secondaryAfter = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-secondary-500').trim());
  R.accentAfter = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-accent-500').trim());

  // ④ 字号注入
  await page.locator(GROUP('字体大小')).nth(2).click();
  await page.waitForTimeout(500);
  R.textTokensAfterFont = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return ['--text-body','--text-body-sm','--text-caption'].reduce((a,t)=>(a[t]=s.getPropertyValue(t).trim(),a),{});
  });

  // ⑤ 选中态（U-6：必须从状态派生）
  R.fontAriaChecked = await page.evaluate(() =>
    [...document.querySelectorAll('[role="radiogroup"][aria-label="字体大小"] [role="radio"]')]
      .map(b => b.getAttribute('aria-checked')));
  R.paletteAriaChecked = await page.evaluate(() =>
    [...document.querySelectorAll('[role="radiogroup"][aria-label="配色方案"] [role="radio"]')]
      .map(b => b.getAttribute('aria-checked')));

  // ⑥ 刷新持久性
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);
  R.afterReload = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    const raw = localStorage.getItem('rmfood-theme-storage');
    let custom = 0;
    try { custom = (JSON.parse(raw).state.customThemes || []).length } catch (e) {}
    return {
      dark: document.documentElement.classList.contains('dark'),
      primary500: s.getPropertyValue('--color-primary-500').trim(),
      textBody: s.getPropertyValue('--text-body').trim(),
      customThemesPersisted: custom,
    };
  });

  // ⑦ 对比度
  await page.addScriptTag({ content: CONTRAST });
  R.contrast = await page.evaluate(SCOPED_SCAN);

  await browser.close();
  console.log(JSON.stringify(R, null, 2));
})().catch(e => { console.error('PROBE ERROR:', e.message); process.exit(1); });
