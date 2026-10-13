// 数据库检索中心 主题合规渲染取证（v3）
// 方法论：自身 + 全部祖先逐层 alpha 合成，最终与底色合成（D6）。
// 背景源 = backgroundImage 渐变【全部停靠色】 ∪ backgroundColor；
// 渐变必须解析（Tailwind v4 生成 color-mix / 浏览器序列化为 rgba），
// 白字压在渐变上按【最差停靠色】算对比度。
const { chromium } = require('@playwright/test');

const PARSER = `
const KW = { white:'#ffffff', black:'#000000', transparent:'rgba(0,0,0,0)' };
function parseColor(str){
  if(str == null) return null;
  str = String(str).trim();
  if(!str || str === 'none') return null;
  if(KW[str.toLowerCase()]) str = KW[str.toLowerCase()];
  // color-mix（可能嵌套）
  let cm = str.match(/color-mix\\s*\\(\\s*in\\s+\\w+\\s*,\\s*(.+?)\\s+([\\d.]+)\\s*%\\s*,\\s*(.+?)\\s+([\\d.]+)\\s*%\\s*\\)/i);
  if(cm){
    const ca = parseColor(cm[1]), cb = parseColor(cm[3]);
    if(ca && cb){
      const t = (parseFloat(cm[2])||0)/100;
      return { r:ca.r*t+cb.r*(1-t), g:ca.g*t+cb.g*(1-t), bl:ca.bl*t+cb.bl*(1-t), a:ca.a*t+cb.a*(1-t) };
    }
  }
  // rgba / rgb（非锚定，容忍尾部 0% 等位置值）
  let m = str.match(/rgba?\\s*\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*,\\s*([\\d.]+)\\s*(?:,\\s*([\\d.]+))?\\s*\\)/i);
  if(m) return { r:+m[1], g:+m[2], bl:+m[3], a: m[4]===undefined?1:+m[4] };
  // hsl
  m = str.match(/hsl\\s*\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)%\\s*,\\s*([\\d.]+)%\\s*(?:,\\s*([\\d.]+))?\\s*\\)/i);
  if(m){ const h=+m[1], s=+m[2]/100, l=+m[3]/100, a=m[4]===undefined?1:+m[4];
    const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m2=c-x;
    let R,G,B;
    if(h<60){R=c;G=x;B=0;} else if(h<120){R=x;G=c;B=0;} else if(h<180){R=0;G=c;B=x;}
    else if(h<240){R=0;G=x;B=c;} else if(h<300){R=x;G=0;B=c;} else {R=c;G=0;B=m2;}
    return { r:(R+m2)*255, g:(G+m2)*255, bl:(B+m2)*255, a }; }
  // hex
  m = str.match(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3}|[0-9a-f]{4})\\b/i);
  if(m){ let h=m[1];
    if(h.length===3) h=h.split('').map(c=>c+c).join('');
    if(h.length===4) h=h.split('').map(c=>c+c).join('');
    return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), bl:parseInt(h.slice(4,6),16),
            a: h.length===8 ? parseInt(h.slice(6,8),16)/255 : 1 }; }
  return null;
}
function over(src,dst){
  if(!src) return dst;
  if(!dst) return src && src.a>0 ? src : null;
  const a = src.a + dst.a*(1-src.a);
  if(a===0) return null;
  return { r:(src.r*src.a+dst.r*dst.a*(1-src.a))/a, g:(src.g*src.a+dst.g*dst.a*(1-src.a))/a,
          bl:(src.bl*src.a+dst.bl*dst.a*(1-src.a))/a, a };
}
function lum(c){ const f=v=>{v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};
  return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.bl); }
function ratio(fg,bg){ if(!fg||!bg) return null;
  const a=Math.max(lum(fg),lum(bg)), b=Math.min(lum(fg),lum(bg)); return (a+0.05)/(b+0.05); }
// 提取渐变全部停靠色。关键：停靠色分隔逗号位于 gradient( 内部（depth=1），
// 故先剥离外层 gradient(...)，再去掉方向/位置关键词，最后按 depth=0 逗号切分。
function gradientStops(str){
  if(!str || !str.trim() || str.trim()==='none') return [];
  const s = str.trim();
  const m = s.match(/^(linear-gradient|radial-gradient|conic-gradient)\\s*\\((.+)\\)\\s*$/i);
  if(!m){ const c = parseColor(s); return c ? [c] : []; }
  let inner = m[2]
    .replace(/to\\s+(top|bottom|left|right)(\\s+(top|bottom|left|right))?/gi, '')
    .replace(/at\\s+[^,)]+/gi, '')
    .replace(/[0-9.]+\\s*(deg|grad|rad|turn|px)\\b/gi, '');
  const parts = [];
  let depth = 0, cur = '';
  for(const ch of inner){
    if(ch==='(') depth++;
    else if(ch===')') depth--;
    if(ch===',' && depth===0){ parts.push(cur); cur=''; } else cur+=ch;
  }
  if(cur.trim()) parts.push(cur);
  const out = [];
  for(const p of parts){
    const t = p.trim();
    if(!t) continue;
    const c = parseColor(t);
    if(c) out.push(c);
  }
  return out;
}
`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 200)); });

  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  // 登录 + 导航都带重试：后端冷启动/瞬时 502 会让 auth/me 失败，
  // 页面停在守卫态（元素 136 / Tab 0）。此时做的对比度扫描等于审骨架，结论无效。
  for (let i = 1; i <= 4; i++) {
    await page.fill('input[type="text"]', 'admin');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"], button:has-text("进入平台")');
    await page.waitForTimeout(3500);
    if (!/\/login/.test(page.url())) break;
  }
  await page.waitForTimeout(3000);

  let readiness = { n: 0, tabs: 0 };
  for (let attempt = 1; attempt <= 5; attempt++) {
    await page.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded' });
    // 轮询等待 Tab 出现，而不是固定 sleep
    for (let w = 0; w < 20; w++) {
      await page.waitForTimeout(1000);
      readiness = await page.evaluate(() => ({
        n: document.querySelectorAll('body *').length,
        tabs: document.querySelectorAll('[role="tab"]').length,
      }));
      if (readiness.tabs >= 8) break;
    }
    if (readiness.tabs >= 8) break;
    console.log(`  第 ${attempt} 次导航后 Tab 仍为 ${readiness.tabs}（元素 ${readiness.n}），重试…`);
  }

  if (readiness.n < 400 || readiness.tabs < 8) {
    console.log(`⚠️  内容未真实加载（元素 ${readiness.n} / Tab ${readiness.tabs}）——本次扫描结论无效，中止`);
    await browser.close();
    process.exit(2);
  }
  console.log(`✔ 真实内容已加载：元素 ${readiness.n} / Tab ${readiness.tabs} 个`);

  async function setMode(mode) {
    await page.evaluate((m) => {
      const el = document.documentElement;
      if (m === 'dark') el.classList.add('dark'); else el.classList.remove('dark');
    }, mode);
    await page.waitForTimeout(900);
  }

  async function clickTab(label) {
    // Radix Tabs：按标签文本点触发器
    const t = page.getByRole('tab', { name: label }).first();
    if (await t.count()) { await t.click(); return true; }
    const b = page.locator(`button:has-text("${label}")`).first();
    if (await b.count()) { await b.click(); return true; }
    return false;
  }

  async function measure() {
    return await page.evaluate((PARSER) => {
      eval(PARSER);
      const BASE = document.documentElement.classList.contains('dark')
        ? { r: 2, g: 6, bl: 23, a: 1 } : { r: 255, g: 255, bl: 255, a: 1 };
      const out = [];
      const walk = (el, chainBg) => {
        if (!el || el.nodeType !== 1) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
        if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'LINK', 'META'].includes(el.tagName)) return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        const stops = gradientStops(cs.backgroundImage);
        const bc = parseColor(cs.backgroundColor);
        const local = stops.length ? stops : (bc && bc.a > 0 ? [bc] : []);
        const cands = local.length
          ? local.map(c => over(over(c, chainBg), BASE))
          : [over(chainBg, BASE)];
        const ownText = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
        // 只取【直接文本】：叶子聚合会把子元素的文本算到父容器头上，
        // 用父容器的继承色计算对比度，造成大量伪 P0（实测 7 条）。
        if (ownText && ownText.length < 200) {
          const fg = parseColor(cs.color);
          const effFg = fg && fg.a < 1 ? { r: fg.r, g: fg.g, bl: fg.bl, a: 1 } : fg;
          const rts = cands.map(c => ratio(effFg, c)).filter(v => v !== null);
          const worst = rts.length ? Math.min(...rts) : null;
          out.push({ t: ownText.slice(0, 46), ratio: worst === null ? null : Math.round(worst * 100) / 100,
            color: cs.color,
            bg: cands.map(c => c ? 'rgb(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.bl) + ')' : 'none').slice(0, 2).join(' → '),
            grad: stops.length > 0,
            cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : '',
            tag: el.tagName, fs: parseFloat(cs.fontSize) });
        }
        for (const c of el.children) walk(c, cands[0] || chainBg);
      };
      walk(document.body, null);
      return out;
    }, PARSER);
  }

  const TABS = [['实时概览','dashboard'],['中药材','herbs'],['活性肽','peptides'],['知识图谱','graph'],
    ['药食同源','homology'],['食品原料','food_materials'],['零售产品','retail_products'],
    ['搜索分析','analytics'],['数据管理','sync']];
  const results = [];

  for (const [mode] of [['light'],['dark']]) {
    await setMode(mode);
    for (const [label, id] of TABS) {
      const ok = await clickTab(label);
      if (!ok) { console.log(`  ! 无法点击 Tab「${label}」`); continue; }
      await page.waitForTimeout(2600);
      const rows = await measure();
      const uniq = [], seen = new Set();
      for (const r of rows) { const k = r.t + '|' + r.cls + '|' + r.bg;
        if (seen.has(k)) continue; seen.add(k); uniq.push(r); }
      const bad = uniq.filter(r => r.ratio !== null && r.ratio < 4.5).sort((a, b) => a.ratio - b.ratio);
      results.push({ mode, tab: label, total: rows.length, uniq: uniq.length, bad });
      if (mode === 'dark') await page.screenshot({ path: `scripts/theme-audit/databases-${id}.png` });
    }
  }
  await browser.close();

  console.log('mode  tab            节点   去重  <4.5:1');
  console.log('----- -------------- -----  ----  ------');
  for (const r of results) {
    console.log(`${r.mode.padEnd(5)}  ${r.tab.padEnd(14)} ${String(r.total).padStart(5)}  ${String(r.uniq).padStart(4)}  ${String(r.bad.length).padStart(5)}`);
  }
  for (const mode of ['light', 'dark']) {
    console.log(`\n============ ${mode.toUpperCase()} 全部违规明细 ============`);
    for (const r of results.filter(x => x.mode === mode && x.bad.length)) {
      for (const b of r.bad.slice(0, 10)) {
        const lvl = b.ratio < 3 ? 'P0' : 'P1';
        console.log(`  [${lvl}] ${r.tab}  ${b.ratio}:1  "${b.t}" <${b.tag.toLowerCase()} fs=${b.fs}>${b.grad ? ' ←渐变底' : ''}`);
        console.log(`        fg ${b.color}`);
        console.log(`        bg ${b.bg}`);
        if (b.cls) console.log(`        cls ${b.cls}`);
      }
    }
  }
  console.log('\n-- pageerror / console error --');
  console.log(errs.length ? [...new Set(errs)].slice(0, 8).join('\n') : '(无)');
})();
