#!/usr/bin/env node
/**
 * GATE-09 根治：@theme 自引用登记声明（--x: var(--x)）→ @theme inline
 *
 * 背景（v1.1.5 口径）：@theme 中 --x: var(--x) 是 Tailwind v4 生成工具类的
 * 登记机制（有声明才生成 bg-<族>-<档>），删除会让工具类不生成（D-55 实证）。
 * 根治方向：改用 @theme inline —— 不输出自引用（产物里无 --x:var(--x)），
 * 但仍登记令牌、仍生成工具类。
 *
 * 本脚本把 index.css 的 @theme { ... } 块改为 @theme inline { ... }，
 * 并删除块内所有「值 == var(自身)」的登记声明（inline 模式下 Tailwind 会
 * 直接读 :root/.dark 的字面量，无需自引用登记）。
 * 保留块内「值 != 自身」的实质声明（如 --color-x: var(--color-y) 的跨令牌组合、
 * 带 fallback 的声明、非 var() 的字面量声明）。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const IDX = 'src/index.css';
const BASE = 'src/styles/tokens/base.css';
const DARK = 'src/styles/tokens/dark.css';
const fs = { readFileSync, writeFileSync };
const base = fs.readFileSync(BASE, 'utf8');
const dark = fs.readFileSync(DARK, 'utf8');
// base/dark 有真实定义的键（字面量或跨令牌组合）
const realDefined = new Set(
  [...base.matchAll(/--([a-z0-9-]+)\s*:/g), ...dark.matchAll(/--([a-z0-9-]+)\s*:/g)]
    .map(m => m[1])
);

let idx = fs.readFileSync(IDX, 'utf8');

// 定位 @theme { 块（不含 inline 的那个）
const themeRe = /@theme\s*\{/;
const m = idx.match(themeRe);
if (!m) { console.error('未找到 @theme 块'); process.exit(1); }
const openIdx = m.index + m[0].length - 1; // '{'
// 找配对的 '}'（@theme 块内无嵌套 {}）
let depth = 0, closeIdx = -1;
for (let i = openIdx; i < idx.length; i++) {
  if (idx[i] === '{') depth++;
  else if (idx[i] === '}') { depth--; if (depth === 0) { closeIdx = i; break; } }
}
const block = idx.slice(openIdx + 1, closeIdx);
const lines = block.split('\n');
const keptLines = [];
let removed = 0;
for (const raw of lines) {
  const l = raw.trim();
  if (!l) { keptLines.push(raw); continue; }
  const sm = l.match(/^--([a-z0-9-]+)\s*:\s*var\(\s*--([a-z0-9-]+)\s*\)\s*;/);
  if (sm && sm[1] === sm[2] && realDefined.has(sm[1])) {
    removed++; // 自引用 + 有下游真实定义 → inline 模式下可删
    continue;
  }
  keptLines.push(raw);
}
const newBlock = keptLines.join('\n');
const newIdx = idx.slice(0, openIdx) + 'inline' + '\n' + newBlock + idx.slice(closeIdx);
fs.writeFileSync(IDX, newIdx, 'utf8');
console.log(`@theme → @theme inline；删除 ${removed} 个自引用登记声明，保留 ${keptLines.filter(l=>l.trim()).length - removed} 行（注释/实质声明）`);
