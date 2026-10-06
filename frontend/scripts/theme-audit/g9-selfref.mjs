#!/usr/bin/env node
/**
 * GATE-09 自引用令牌清理（106 个 --x: var(--x) 桥接）
 *
 * 原理：Tailwind v4 编译 @theme 块时，自引用桥接 --x: var(--x) 在 CSS 层是无操作
 * （计算值最终仍落到 :root/.dark 的字面量声明），且 GATE-09 将其判为自引用冗余。
 * 删除 106 个自引用桥接后：
 *   - Tailwind 工具类（bg-primary-500 等）仍能生成：@theme 只要声明了 --color-*
 *     键名（即使值是 var()）就会生成工具类，删的是「值等于自身」的冗余行
 *   - 但！若某令牌在 base/dark 无字面量定义、仅靠 @theme 自引用桥接才"存在"，
 *     删除会导致该令牌消失 → 工具类失效。故需先验证每个自引用键在
 *     base.css/dark.css 有字面量定义，才安全删除。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const IDX = 'src/index.css';
const BASE = 'src/styles/tokens/base.css';
const DARK = 'src/styles/tokens/dark.css';

const base = readFileSync(BASE, 'utf8');
const dark = readFileSync(DARK, 'utf8');
const literalKeys = new Set(
  [...base.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8}|rgb|oklch|\d)/g),
   ...dark.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8}|rgb|oklch|\d)/g)]
    .map(m => m[1])
);
// 含 var() 组合的键（--x: var(--y) 也算"已定义"，y 最终有字面量）
const comboKeys = new Set(
  [...base.matchAll(/--([a-z0-9-]+)\s*:\s*var\(/g),
   ...dark.matchAll(/--([a-z0-9-]+)\s*:\s*var\(/g)].map(m => m[1])
);

let idx = readFileSync(IDX, 'utf8');
let removed = 0, kept = [];
const lines = idx.split('\n');
const out = lines.filter(l => {
  const m = l.match(/^\s*--([a-z0-9-]+)\s*:\s*var\(\s*--([a-z0-9-]+)\s*\);/);
  if (m && m[1] === m[2]) {
    // 自引用：该键在 base/dark 有字面量或组合定义才删（安全）
    if (literalKeys.has(m[1]) || comboKeys.has(m[1])) { removed++; return false; }
    kept.push(l.trim()); // 保留：无下游定义
  }
  return true;
});
writeFileSync(IDX, out.join('\n'), 'utf8');
console.log(`删除 ${removed} 个自引用桥接（均有 base/dark 下游定义）`);
if (kept.length) {
  console.log(`保留 ${kept.length} 个（无下游定义，不可删）：`);
  kept.slice(0, 10).forEach(k => console.log('  ' + k));
}
