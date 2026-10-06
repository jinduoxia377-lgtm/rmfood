import { readFileSync, readdirSync, statSync } from 'node:fs';
function walk(d, o = []) {
  for (const e of readdirSync(d)) {
    const p = `${d}/${e}`, s = statSync(p);
    if (s.isDirectory()) { if (e === 'node_modules' || e === '__tests__') continue; walk(p, o); }
    else if (/\.(ts|tsx)$/.test(e)) o.push(p);
  }
  return o;
}
const files = walk('src');
let n = 0;
for (const f of files) {
  const t = readFileSync(f, 'utf8');
  const m = t.match(/from-primary-\d{3}/g);
  if (m) { n += m.length; }
}
console.log(`源码 from-primary-* 出现 ${n} 处（含渐变 to-primary-* 则更多）`);
// 看 @theme 是否注册 primary 色阶（GATE-12 同源判定）
const idx = readFileSync('index.css', 'utf8');
const hasReg = /--color-primary-500/.test(idx) || /--color-primary-600/.test(idx);
console.log(`index.css @theme 是否注册 primary 色阶: ${hasReg ? '是' : '否'}`);
