// T-A2 批量替换：页头横幅改用 .surface-primary（D-50 / C-24）
// 仅替换逐字相同的模式，避免误伤其它 bg-primary-600 用法。
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = 'D:/RMFOODFP/frontend/src';
const ROOT = 'D:/RMFOODFP/frontend';

// 逐字模式 → 目标
const RULES = [
  ['rounded-xl bg-primary-600 p-6 text-white shadow-sm', 'surface-primary rounded-xl p-6 shadow-sm'],
  ['rounded-xl bg-primary-600 p-5 text-white shadow-sm', 'surface-primary rounded-xl p-5 shadow-sm'],
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|__tests__/.test(e.name)) walk(p, out); }
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const changed = [];
let totalHits = 0;

for (const f of files) {
  const before = readFileSync(f, 'utf8');
  let after = before;
  let hits = 0;
  for (const [from, to] of RULES) {
    const parts = after.split(from);
    if (parts.length > 1) { hits += parts.length - 1; after = parts.join(to); }
  }
  if (hits > 0 && after !== before) {
    writeFileSync(f, after, 'utf8');
    changed.push({ file: relative(ROOT, f).replace(/\\/g, '/'), hits });
    totalHits += hits;
  }
}

console.log('替换文件数:', changed.length);
console.log('替换总处数:', totalHits);
changed.forEach(c => console.log(`  ${String(c.hits).padStart(2)}  ${c.file}`));

// 复核：确认目标文件已无该模式
console.log('\n=== 残留检查 ===');
const PAL = /rounded-xl bg-primary-600 p-\d text-white shadow-sm/;
let residual = 0;
for (const f of walk(SRC)) {
  const t = readFileSync(f, 'utf8');
  const m = t.match(PAL);
  if (m) { residual++; console.log('  残留:', relative(ROOT, f), m[0]); }
}
console.log(residual === 0 ? '✅ 无残留' : `❌ 仍有 ${residual} 处`);
