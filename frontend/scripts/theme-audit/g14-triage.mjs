import { readFileSync, readdirSync, statSync } from 'node:fs';
import { relative } from 'node:path';
function walk(d, o = []) {
  for (const e of readdirSync(d)) {
    const p = `${d}/${e}`, s = statSync(p);
    if (s.isDirectory()) { if (e === 'node_modules' || e === '__tests__') continue; walk(p, o); }
    else if (/\.(ts|tsx)$/.test(e)) o.push(p);
  }
  return o;
}
// 与 g1314.mjs GATE-14 完全同源的三条模式
const comboRe = /bg-(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950)[^"'\`]*\btext-white\b|\btext-white\b[^"'\`]*\b(?:bg-)?(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950)/;
const condRe = /bg-(?:primary|secondary|accent)-\$\{|\btext-white\b[^\n]*bg-(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950)/;
const files = walk('src');
const hits = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^\s*(\/\/|\/\*|\*|<!--)/.test(l)) continue;
    if (comboRe.test(l) || condRe.test(l)) {
      const rel = relative(process.cwd(), f).replace(/\\/g, '/');
      // 分类
      const isGrad = /bg-gradient/.test(l);
      const isBgWhite = /bg-white/.test(l) && !/(primary|secondary|accent)-(400|500|600|700|800|900|950)\s+text-white/.test(l);
      const isHover = /hover:from-(primary|secondary|accent)/.test(l) || /hover:bg-(primary|secondary|accent)-(400|500|600|700|800|900|950)/.test(l);
      const cls = isGrad ? '渐变' : isBgWhite ? 'bg-white误报' : isHover ? 'hover反转' : '基础反转';
      hits.push({ rel, line: i + 1, cls, text: l.trim().slice(0, 70) });
    }
  }
}
const groups = {};
for (const h of hits) (groups[h.cls] = groups[h.cls] || []).push(h);
for (const [cls, arr] of Object.entries(groups)) {
  console.log(`\n══ ${cls}（${arr.length} 处）══`);
  for (const h of arr) console.log(`  ${h.rel}:${h.line}  ${h.text}`);
}
console.log(`\n总计 ${hits.length}`);
