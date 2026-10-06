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
const minRe = /bg-(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950).{0,60}\btext-white\b|\btext-white\b.{0,60}bg-(?:primary|secondary|accent)-(?:400|500|600|700|800|900|950)/;
let total = 0; const byFile = [];
for (const f of walk('src')) {
  const lines = readFileSync(f, 'utf8').split('\n');
  let hit = 0;
  for (const l of lines) { if (/^\s*(\/\/|\/\*|\*)/.test(l)) continue; if (minRe.test(l)) hit++; }
  if (hit) { total += hit; byFile.push([f, hit]); }
}
console.log(`剩余共现 ${total} 行 / ${byFile.length} 文件`);
byFile.sort((a, b) => b[1] - a[1]);
byFile.slice(0, 20).forEach(([r, h]) => console.log(`  ${r} (${h})`));
