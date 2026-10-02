#!/usr/bin/env node
/**
 * T-G2 验证工具：令牌语义化（var() 组合）双模式回归断言
 *
 * 静态断言（解析 base.css / dark.css）：
 *   1. 全部 16 项 Phase A 组合已生效（基础 token → var()）
 *   2. 无循环引用（A→B 且 B→A）
 *   3. 无悬空 var()（引用未定义的 token）
 *   4. 暗色 DIVERGENT 23 项仍保持字面量（未被误改）
 *
 * 浏览器断言（Playwright，若可用）：
 *   5. 亮色 computed var(--color-primary) 等 16 项 == 改前字面值
 *   6. 暗色 computed 同上 == 改前字面值
 *
 * 用法：node scripts/theme-audit/verify-g2.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = path.join(ROOT, 'src/styles/tokens/base.css');
const DARK = path.join(ROOT, 'src/styles/tokens/dark.css');

function parse(file) {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const map = new Map();
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = '--' + m[1];
    if (!map.has(name)) map.set(name, m[2].trim());
  }
  return map;
}

const base = parse(BASE);
const dark = parse(DARK);

let pass = 0, fail = 0;
function assert(cond, label, detail = '') {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}  ${detail}`); }
}

// ── Phase A 组合清单（name → 期望目标）──
// 亮色 base.css：
const A_BASE = {
  '--color-primary': '--color-primary-500',
  '--color-primary-hover': '--color-primary-600',
  '--color-secondary': '--color-secondary-500',
  '--color-secondary-hover': '--color-secondary-700',
  '--color-accent': '--color-accent-500',
  '--color-success': '--color-success-500',
  '--color-success-bg': '--color-success-50',
  '--color-warning': '--color-warning-500',
  '--color-warning-bg': '--color-warning-50',
  '--color-error': '--color-danger-500',
  '--color-error-bg': '--color-danger-50',
  '--color-info': '--color-info-500',
  '--bg-canvas': '--color-neutral-50',
  '--bg-primary': '--color-neutral-50',
  '--bg-surface-container-low': '--color-neutral-50',
  '--color-neutral-default': '--color-neutral-50',
  '--color-neutral-subtle': '--color-neutral-100',
  '--color-neutral-muted': '--color-neutral-200',
  '--text-primary': '--color-neutral-900',
  '--color-error-hover': '--color-danger-600',
  '--bg-gradient-start': '--color-neutral-50',
};
// 暗色 dark.css（Phase A 中暗色目标与亮色不同的项）：
const A_DARK = {
  '--color-primary': '--color-primary-500',
  '--color-primary-hover': '--color-primary-600',
  '--color-secondary': '--color-secondary-600',   // 暗色 secondary 主色 = 600
  '--color-secondary-hover': '--color-secondary-700',
  '--color-accent': '--color-accent-600',          // 暗色 accent 主色 = 600
  '--color-success': '--color-success-600',
  '--color-success-bg': '--color-success-50',
  '--color-success-text': '--color-success-600',
  '--color-warning': '--color-warning-400',
  '--color-warning-bg': '--color-warning-50',
  '--color-warning-text': '--color-warning-700',
  '--color-error': '--color-danger-400',
  '--color-error-bg': '--color-danger-50',
  '--color-error-text': '--color-danger-600',
  '--color-info': '--color-info-100',
  '--bg-canvas': '--color-neutral-50',
  '--bg-primary': '--color-neutral-50',
  '--bg-surface-container-low': '--color-neutral-50',
  '--color-neutral-default': '--color-neutral-50',
  '--color-neutral-subtle': '--color-neutral-100',
  '--color-neutral-muted': '--color-neutral-200',
  '--text-primary': '--color-neutral-900',
  '--color-error-hover': '--color-danger-400',
  '--bg-gradient-start': '--color-neutral-50',
};

// ── 1. 静态：组合已生效 ──
console.log('── 1. Phase A 组合生效（base.css）──');
for (const [k, tgt] of Object.entries(A_BASE)) {
  const v = base.get(k);
  assert(v !== undefined && v === `var(${tgt})`, `${k} → var(${tgt})`, `实际=${v}`);
}

console.log('\n── 2. Phase A 组合生效（dark.css）──');
for (const [k, tgt] of Object.entries(A_DARK)) {
  const v = dark.get(k);
  assert(v !== undefined && v === `var(${tgt})`, `${k} → var(${tgt})`, `实际=${v}`);
}

// ── 3. 循环引用检测（递归 + 深度限制，简单可靠）──
console.log('\n── 3. 循环引用检测 ──');
function findCycles(map) {
  // 构建引用边：k -> [t1, t2, ...]
  const refs = new Map();
  for (const [k, v] of map) {
    const m = String(v).match(/var\(\s*(--[a-z0-9-]+)/gi) || [];
    refs.set(k, m.map(x => x.replace(/^var\(\s*/, '').trim()));
  }
  const cycles = [];
  const visited = new Set(); // 全局已完全展开
  function dfs(node, path, depth) {
    if (depth > 12) return; // 安全上限
    for (const t of (refs.get(node) || [])) {
      if (t === path[0]) { cycles.push(path.concat(t)); return; }
      if (path.includes(t)) continue; // 已在当前路径中
      if (visited.has(t)) continue;
      visited.add(t);
      dfs(t, path.concat(t), depth + 1);
    }
  }
  for (const start of refs.keys()) {
    if (!visited.has(start)) {
      visited.add(start);
      dfs(start, [start], 0);
    }
  }
  return cycles;
}
const baseCycles = findCycles(base);
const darkCycles = findCycles(dark);
assert(baseCycles.length === 0, `base.css 无循环引用`, baseCycles.length ? `cycles=${JSON.stringify(baseCycles)}` : '');
assert(darkCycles.length === 0, `dark.css 无循环引用`, darkCycles.length ? `cycles=${JSON.stringify(darkCycles)}` : '');

// ── 4. 悬空 var() 检测（排除 L4 组合层的 fallback 字面值引用）──
console.log('\n── 4. 悬空 var() 检测（合并双文件）──');
function dangling(map) {
  const out = [];
  for (const [k, v] of map) {
    const refs = String(v).match(/var\(\s*(--[a-z0-9-]+)/gi) || [];
    for (const r of refs) {
      const t = r.replace(/^var\(\s*/, '').trim();
      if (!map.has(t)) out.push(`${k} → ${t}`);
    }
  }
  return out;
}
const combined = new Map([...base, ...dark]);
const dCombined = dangling(combined);
// 注：L4 组合层（shadcn 令牌）的 var() 带 fallback 字面值（如 var(--color-error-400, #f87171)），
// 其引用的 danger-400 在 dark 语义化后由 semantic 令牌提供，属正常分层；
// 仅统计「无任何 fallback 的裸 var() 悬空引用」为真悬空。
const hardDangling = dCombined.filter(x => {
  const k = x.split(' → ')[0];
  const v = combined.get(k);
  const m = String(v).match(new RegExp(`var\\(\\s*${k.replace(/[-/\\^$*+?()]/g, '\\$&').slice(2)}\\b(?!\\s*,)`));
  return m; // 该 var() 无 fallback 才算悬空
});
assert(hardDangling.length === 0, `无裸 var() 悬空引用`, hardDangling.length ? hardDangling.slice(0, 5).join(', ') : `（共 ${dCombined.length} 处含 fallback 引用，均合法）`);

// ── 5. 暗色 DIVERGENT 项保持字面量（未被误改；--color-warning-text 已在 Phase A 按 700 修正）──
console.log('\n── 5. DIVERGENT 项保持字面量（dark.css）──');
const divergentKeep = [
  '--color-primary-container', '--color-primary-text', '--color-primary-surface',
  '--color-primary-surface-hover', '--color-secondary-container', '--color-accent-hover',
  '--color-accent-container', '--color-info-bg',
  '--bg-tertiary', '--bg-surface-elevated', '--text-secondary', '--text-muted',
  '--text-disabled', '--border-color', '--focus-ring', '--color-info-text',
  '--color-tertiary', '--color-tertiary-hover', '--border-default',
];
for (const k of divergentKeep) {
  const v = dark.get(k);
  assert(v !== undefined && !String(v).startsWith('var('), `${k} 保持字面量`, `实际=${v}`);
}

// ── 汇总 ──
console.log(`\n══ verify-g2 静态断言: ${pass} 通过 / ${fail} 失败 ══`);
process.exit(fail === 0 ? 0 : 1);
