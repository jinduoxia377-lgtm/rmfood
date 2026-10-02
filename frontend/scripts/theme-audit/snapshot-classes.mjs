// 快照编译产物中的类名选择器集合，用于「改动前后不丢工具类」的验收
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const assets = 'D:/RMFOODFP/frontend/dist/assets';
const css = readdirSync(assets).filter(f => f.endsWith('.css'))
  .map(f => readFileSync(join(assets, f), 'utf8')).join('\n');

const set = new Set();
for (const m of css.matchAll(/\.((?:[a-zA-Z0-9_-]|\\.)+)/g)) {
  const cls = m[1].replace(/\\(.)/g, '$1');
  if (/^[a-zA-Z]/.test(cls)) set.add(cls);
}

const tag = process.argv[2] || 'snap';
const out = `D:/RMFOODFP/temp/classes-${tag}.json`;
writeFileSync(out, JSON.stringify([...set].sort()), 'utf8');
console.log(`  [${tag}] 产物中 ${set.size} 个类名选择器 → ${out}`);
