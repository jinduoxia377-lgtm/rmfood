// 数据库检索中心 — 静态缺陷量化 + RANK_BADGE 精算
const fs = require('fs');
const path = require('path');

const ROOT = 'src/pages/database';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const FILES = walk(ROOT).filter(f => f.endsWith('.tsx'));

function read(f) { return fs.readFileSync(f, 'utf8'); }
function lines(f) { return read(f).split('\n'); }
function scan(f, re) {
  return lines(f).map((l, i) => re.test(l) ? { n: i + 1, l: l.trim().slice(0, 150) } : null).filter(Boolean);
}

// WCAG
function lum(hex) {
  const h = hex.replace('#', '');
  const v = [0, 2, 4].map(i => { let c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
}

console.log('════════════ RANK_BADGE_STYLES 精算（DashboardOverview.tsx:205-207）════════════');
const badges = [
  ['1st', 'from-warning-400', 'light #fbbf24', 'dark #d97706'],
  ['1st', 'to-warning-500', 'light #f59e0b', 'dark #f59e0b'],
  ['2nd', 'from-neutral-300', 'light #cbd5e1', 'dark #cbd5e1'],
  ['2nd', 'to-neutral-400', 'light #94a3b8', 'dark #94a3b8'],
  ['3rd', 'from-warning-300', 'light #fcd34d', 'dark #b45309'],
  ['3rd', 'to-warning-400', 'light #fbbf24', 'dark #d97706'],
];
console.log('档位            亮色        暗色        白字亮色  白字暗色  判定');
for (const [rank, cls, l, d] of badges) {
  const lh = l.split(' ')[1], dh = d.split(' ')[1];
  const rl = ratio(lh, '#ffffff'), rd = ratio(dh, '#ffffff');
  const judge = Math.min(+rl, +rd) < 3 ? 'P0 双模式失败' : +rl < 4.5 || +rd < 4.5 ? 'P1 单模式失败' : 'OK';
  console.log(`${cls.padEnd(17)} ${l.padEnd(11)} ${d.padEnd(11)} ${rl.padStart(6)}    ${rd.padStart(6)}    ${judge}`);
}

console.log('\n════════════ 静态缺陷量化 ════════════');
const PATTERNS = [
  ['F2: container + main', /bg-(primary|secondary|accent)-container[^"']*text-(primary|secondary|accent)-main|text-(primary|secondary|accent)-main[^"']*bg-(primary|secondary|accent)-container/],
  ['D-50 品牌色阶+白字', /(bg|from|to)-(primary|secondary|accent|warning|neutral)-[3-6]00[^"']*text-white|text-white[^"']*(bg|from|to)-(primary|secondary|accent|warning|neutral)-[3-6]00/],
  ['幻影 --text-secondary-dark', /--text-secondary-dark/],
  ['幻影 --color-violet-500', /--color-violet-500/],
  ['非法 CSS 拼接(拼接18)', /}\s*18'|'18\s*\+|18`,/],
  ['硬编码 hex (JS/className)', /(?<!var\()[#][0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/],
  ['图表硬编码 rgba', /rgba\(\s*\d+/],
  ['fallback hex var(--x,#hex)', /var\(--[a-z-]+,\s*#?[0-9a-fA-F]{3,8}\)/],
  ['非项目族色 (teal/rose/sky/indigo)', /var\(--color-(teal|rose|sky|indigo|slate|cyan|emerald|purple|orange)/],
];

const counts = {};
for (const [name, re] of PATTERNS) counts[name] = [];

for (const f of FILES) {
  const hits = {};
  for (const [name, re] of PATTERNS) {
    const s = scan(f, re);
    if (s.length) { hits[name] = s.length; counts[name].push(`${path.basename(f)}:${s.length}`); }
  }
}

for (const [name, files] of Object.entries(counts)) {
  const total = files.reduce((a, s) => a + +s.split(':')[1], 0);
  console.log(`\n【${name}】 共 ${total} 处 / ${files.length} 文件`);
  for (const f of files) console.log(`    ${f}`);
}

// 非法 CSS 精确定位
console.log('\n════════════ 非法 CSS 拼接 精确定位 ════════════');
for (const f of FILES) {
  const s = lines(f).map((l, i) => ({ n: i + 1, l })).filter(x =>
    /`\$\{[^}]*\}18`/.test(x.l) || /}\s*18`/.test(x.l));
  for (const x of s) console.log(`  ${path.relative(ROOT, f)}:${x.n}  ${x.l.trim().slice(0, 130)}`);
}

console.log('\n════════════ F2 精确定位 ════════════');
for (const f of FILES) {
  const s = scan(f, PATTERNS[0][1]);
  for (const x of s) console.log(`  ${path.relative(ROOT, f)}:${x.n}  ${x.l.slice(0, 120)}`);
}
