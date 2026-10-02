#!/usr/bin/env node
/**
 * T-G2 前置：穷举 base.css 语义层 token 的潜在 var() 组合关系（纯分析，不修改源）
 *
 * 对每个「字面量」token，在其同文件中寻找值相等的 primitive 候选：
 *   - 颜色 token：与任意 --color-<族>-<档> 的 10 档（50..950）比对
 *   - 若相等 → 输出「可组合候选」，并按「暗色下两者是否仍相等」分类：
 *       STABLE   = 暗色下 primitive 与语义值仍相等（可安全组合）
 *       DIVERGENT= 暗色下两者分叉（组合会改变暗色计算值，需人工裁决）
 *   - 暗色未重定义该 primitive → INHERIT（随 primitive 自然变化）
 *
 * 用法：node scripts/theme-audit/measure-g2.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'); // frontend/
const BASE = path.join(ROOT, 'src/styles/tokens/base.css');
const DARK = path.join(ROOT, 'src/styles/tokens/dark.css');

function parseTokens(file) {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const map = new Map();
  const re = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = '--' + m[1];
    if (map.has(name)) continue; // 同名取首个
    const raw = m[2].trim();
    map.set(name, { raw, isVar: raw.includes('var('), value: raw });
  }
  return map;
}

const base = parseTokens(BASE);
const dark = parseTokens(DARK);

const SCALE_RE = /^--color-(primary|secondary|accent|success|warning|error|danger|info|neutral|orange|purple|cyan)-(\d{2,3})$/;
// 语义 token（排除色阶 primitive）
function isSemantic(name) {
  if (SCALE_RE.test(name)) {
    // 10 档的 success/warning/danger 是「semantic 10-scale」primitive，排除；
    // info/tertiary 的 10 档也排除
    return false;
  }
  // 排除 shadcn --background/--foreground 等 L4 组合层（它们本来就是 var() 组合的）
  if (/^--(background|foreground|card|popover|primary|secondary|muted|accent|destructive|success|warning|border|input|ring|radius)(?!-)/.test(name)) return false;
  // 排除 typography/spacing/radius/shadow/duration/ease/font/layout/safe-area/skeleton/badge/hero/glass/material/gradient/grid/scrollbar 等非颜色语义
  if (/^(--text-(h\d|body|caption|overline|tiny)|--space|--radius|--shadow|--duration|--ease|--font|--sidebar|--header|--z-|--safe-area|--badge|--hero|--glass|--material|--gradient|--grid|--scrollbar|--fill|--bg-grid)/.test(name)) return false;
  // 保留：颜色语义（--color-* 非 10 档）+ --bg-* + --card-bg* + --text-primary/secondary/muted/disabled + --border* + --focus-ring + --overlay-bg
  return /^--(color|bg|card-bg|text-primary|text-secondary|text-muted|text-disabled|border|focus-ring|overlay-bg)/.test(name);
}

function norm(v) {
  // 归一化颜色值（小写、压缩空格）以便比对；非字符串（数字等）直接转字符串
  if (v == null) return v;
  return String(v).toLowerCase().replace(/\s+/g, '');
}

// 候选：base.css 中是「字面量」的语义 token
const literalSemantics = [...base.entries()].filter(([n, v]) => isSemantic(n) && !v.isVar).map(([n]) => n);

// primitive 池（base.css 的全部色阶值）
const scaleVals = {}; // name -> value
for (const [n, v] of base) if (SCALE_RE.test(n)) scaleVals[n] = v.value;

const buckets = { STABLE: [], DIVERGENT: [], INHERIT: [], NO_MATCH: [] };

for (const name of literalSemantics) {
  const bVal = norm(base.get(name).value);
  // 在 primitive 池中找值相等的候选
  const matches = Object.entries(scaleVals).filter(([pn, pv]) => norm(pv) === bVal).map(([pn]) => pn);
  if (matches.length === 0) { buckets.NO_MATCH.push({ name }); continue; }

  // 取「族名最相关」的候选（优先同族）；若多档同值，列出全部
  const primaryCandidate = matches[0];
  const dVal = dark.has(name) ? norm(dark.get(name).value) : null; // 暗色语义值
  const dPrim = dark.has(primaryCandidate) ? norm(dark.get(primaryCandidate).value) : null; // 暗色 primitive 值

  let cls;
  if (dVal === null) cls = 'INHERIT';                       // 暗色未重定义语义，随 primitive 变
  else if (dPrim === null) cls = 'INHERIT';                 // 暗色未重定义 primitive（不会发生，色阶都重定义了）
  else if (dVal === dPrim) cls = 'STABLE';                  // 暗色仍相等 → 安全
  else cls = 'DIVERGENT';                                     // 暗色分叉 → 需人工

  buckets[cls].push({ name, target: primaryCandidate, all: matches, baseVal: base.get(name).value, darkVal: dVal, darkPrim: dPrim });
}

const order = ['STABLE', 'INHERIT', 'DIVERGENT', 'NO_MATCH'];
let total = 0;
for (const cls of order) {
  const arr = buckets[cls];
  total += arr.length;
  const label = { STABLE: '✅ STABLE（亮暗双模式值不变，可安全组合）', INHERIT: '♻️ INHERIT（暗色未重定义，随 primitive 自然变化）', DIVERGENT: '⚠️ DIVERGENT（暗色分叉，需人工裁决）', NO_MATCH: '• NO_MATCH（primitive 池无同值，保持字面量）' }[cls];
  console.log(`\n══ ${label}：${arr.length} ══`);
  for (const r of arr) {
    if (cls === 'NO_MATCH') {
      const v = base.get(r.name);
      console.log(`  ${r.name}  [值=${v ? v.value : '?'}]`);
      continue;
    }
    const extra = r.all.length > 1 ? `（${r.all.length} 档同值：${r.all.slice(0, 6).join(', ')}${r.all.length > 6 ? '…' : ''}）` : '';
    if (cls === 'DIVERGENT') {
      console.log(`  ${r.name} → var(${r.target})  [亮=${r.baseVal} 暗语义=${r.darkVal} 暗primitive=${r.darkPrim}] ${extra}`);
    } else {
      console.log(`  ${r.name} → var(${r.target})  [亮=${r.baseVal}] ${extra}`);
    }
  }
}

console.log(`\n══ 汇总 ══`);
console.log(`  base.css 总 token: ${base.size}，其中 var() 组合 ${[...base.values()].filter(v => v.isVar).length}（${Math.round([...base.values()].filter(v=>v.isVar).length/base.size*100)}%）`);
console.log(`  字面量语义 token: ${literalSemantics.length}`);
console.log(`  可组合（STABLE+INHERIT）: ${buckets.STABLE.length + buckets.INHERIT.length}，需人工（DIVERGENT）: ${buckets.DIVERGENT.length}，保持字面量（NO_MATCH）: ${buckets.NO_MATCH.length}`);
