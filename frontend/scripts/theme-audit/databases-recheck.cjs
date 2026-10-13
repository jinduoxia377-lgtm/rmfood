// 复核探针：闭环自查三处未验证结论 + 排查方法论有效性
const { chromium } = require('@playwright/test');

function lum(hex) {
  const h = hex.replace('#', '');
  const v = [0, 2, 4].map(i => { let c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b), hi = Math.max(la, lb), lo = Math.min(la, lb);
  return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const reqs = [];
  page.on('response', r => { if (r.status() >= 400) reqs.push(`${r.status()} ${r.url().replace('http://localhost:3000', '')}`); });

  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"], button:has-text("进入平台")');
  await page.waitForTimeout(4000);
  await page.goto('http://localhost:3000/databases', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4500);

  console.log('════════ 1. 运行时令牌真值 + 对比度精算 ════════');
  const toks = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const g = k => cs.getPropertyValue(k).trim();
    const out = {};
    for (const k of ['--color-primary-500','--color-primary-container','--color-primary-main',
      '--color-secondary-container','--color-secondary-main','--color-accent-container','--color-accent-main',
      '--color-success-500','--color-primary-surface','--color-primary-950']) out[k] = g(k);
    return out;
  });
  for (const [k, v] of Object.entries(toks)) console.log(`  ${k.padEnd(28)} ${v || '⚠️ 空'}`);

  console.log('\n── F2 对照对精算 ──');
  const pairs = [
    ['primary-container + primary-main', 'container', 'main', 'primary'],
    ['secondary-container + secondary-main', 'container', 'main', 'secondary'],
    ['accent-container + accent-main', 'container', 'main', 'accent'],
  ];
  for (const [label, c, m, fam] of pairs) {
    const bg = toks[`--color-${fam}-${c}`], fg = toks[`--color-${fam}-${m}`];
    if (!bg || !fg) { console.log(`  ${label.padEnd(38)} 无值（幻影）`); continue; }
    const norm = v => v.replace('#', '');
    const r = ratio('#' + norm(bg), '#' + norm(fg));
    console.log(`  ${label.padEnd(38)} fg ${fg.padEnd(9)} bg ${bg.padEnd(9)} = ${r}  ${+r >= 4.5 ? '✅' : '❌ 低于 AA'}`);
  }

  console.log('\n════════ 2. RANK_BADGE 是否真实渲染 ════════');
  const badge = await page.evaluate(() => {
    const all = [...document.querySelectorAll('*')];
    const hit = all.filter(e => /RANK|rank|ranking|top-3|Top3/i.test(e.className || '') ||
      /^(1|2|3)$/.test(e.textContent.trim()) && e.children.length === 0);
    const grad = all.filter(e => /from-warning|to-warning|from-neutral-300/.test(e.className || ''));
    return { total: all.length, rankCandidates: hit.length,
      rankSamples: hit.slice(0, 4).map(e => ({ tag: e.tagName, t: e.textContent.trim().slice(0, 24),
        cls: (e.className || '').toString().slice(0, 70) })),
      warningGradientEls: grad.length,
      gradSamples: grad.slice(0, 3).map(e => ({ tag: e.tagName, t: e.textContent.trim().slice(0, 24),
        cls: (e.className || '').toString().slice(0, 90) })) };
  });
  console.log(`  总元素 ${badge.total} | 警告渐变元素 ${badge.warningGradientEls}`);
  for (const g of badge.gradSamples) console.log(`    <${g.tag}> "${g.t}"  ${g.cls}`);
  console.log(`  排名候选 ${badge.rankCandidates}`);
  for (const r of badge.rankSamples) console.log(`    <${r.tag}> "${r.t}"  ${r.cls}`);

  console.log('\n════════ 3. DatabasePage:857 快速操作按钮是否在 DOM ════════');
  const quick = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[class*="primary-container"]')];
    return all.slice(0, 6).map(e => {
      const cs = getComputedStyle(e);
      return { tag: e.tagName, t: (e.textContent || '').trim().slice(0, 22),
        color: cs.color, bg: cs.backgroundColor,
        cls: (e.className || '').toString().slice(0, 78) };
    });
  });
  for (const q of quick) console.log(`  <${q.tag}> "${q.t}" color=${q.color} bg=${q.bg}\n      ${q.cls}`);

  console.log('\n════════ 4. PeptideDetailContent 可达性 ════════');
  const peptide = await page.evaluate(() => {
    const out = {};
    out.aaGrid = document.querySelectorAll('[class*="h-7"][class*="w-6"]').length;
    out.aaLetters = [...document.querySelectorAll('span[title*="("]')].slice(0, 4).map(e => ({
      t: e.textContent, title: e.getAttribute('title'), cls: (e.className || '').slice(0, 60) }));
    return out;
  });
  console.log(`  氨基酸网格元素 ${peptide.aaGrid} | 样例 ${JSON.stringify(peptide.aaLetters)}`);

  console.log('\n════════ 5. 方法论有效性：401 与节点稳定性 ════════');
  const tabs = ['实时概览', '中药材', '活性肽', '知识图谱'];
  const counts = [];
  for (const t of tabs) {
    const el = page.getByRole('tab', { name: t }).first();
    if (await el.count()) { await el.click(); await page.waitForTimeout(2200); }
    const c = await page.evaluate(() => document.querySelectorAll('body *').length);
    counts.push([t, c]);
  }
  for (const [t, c] of counts) console.log(`  ${t.padEnd(10)} 元素数 ${c}`);
  console.log(`  401/错误响应 ${reqs.length} 个:`);
  for (const r of [...new Set(reqs)].slice(0, 8)) console.log(`    ${r}`);

  await browser.close();
})();
