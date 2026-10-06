import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

function walk(d, o = []) {
  for (const e of readdirSync(d)) {
    const p = `${d}/${e}`, s = statSync(p);
    if (s.isDirectory()) { if (e === 'node_modules' || e === '__tests__') continue; walk(p, o); }
    else if (/\.(ts|tsx)$/.test(e)) o.push(p);
  }
  return o;
}
const wip = new Set(execSync('git status --porcelain').toString().split('\n').filter(l => /^\s*M/.test(l)).map(l => l.slice(3).trim()));
// 共现行（GATE-14 同款）：行内有 bg-fam-400..950 且同行有 text-white
const minRe = /bg-(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950).{0,60}\btext-white\b|\btext-white\b.{0,60}bg-(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950)/;
const own = [], w = [];
for (const f of walk('src')) {
  const rel = f.replace(/\\/g, '/');
  if (rel.startsWith('scripts/')) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  let hit = 0;
  for (const l of lines) { if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue; if (minRe.test(l)) hit++; }
  if (hit > 0) (wip.has(rel) ? w : own).push([rel, hit]);
}
const sum = a => a.reduce((x, [, h]) => x + h, 0);
console.log(`══ GATE-14 共现命中 ══`);
console.log(`我名下 ${own.length} 文件 / ${sum(own)} 行`);
own.sort((a, b) => b[1] - a[1]); own.slice(0, 40).forEach(([r, h]) => console.log(`  ${r}  (${h})`));
if (own.length > 40) console.log(`  …（共 ${own.length} 文件）`);
console.log(`\n他人 WIP ${w.length} 文件 / ${sum(w)} 行`);
w.sort((a, b) => b[1] - a[1]); w.forEach(([r, h]) => console.log(`  ⏭ ${r}  (${h})`));
