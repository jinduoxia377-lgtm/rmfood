#!/usr/bin/env node
/**
 * P1-9 修复：z-dropdown 令牌缺失 + ThemeSwitcher 面板 z 值
 *
 * 1. base.css 的 --z-* 令牌族补 `--z-dropdown: 500`（dropdown 高于 header/
 *    overlay/sidebar，低于 modal-backdrop；与导航 z 审计对齐：
 *    header 100 < sidebar 301 < dropdown 500 < modal-backdrop 1000）
 * 2. @theme 桥接层补 `--z-dropdown`（若 index.css 有 z 桥接则同步）
 * 3. ThemeSwitcher.tsx 的 `z-dropdown` 工具类保留（现在能解析到 500）
 */
import { readFileSync, writeFileSync } from 'node:fs';

// ── 1. base.css 补 --z-dropdown ──
const baseP = 'src/styles/tokens/base.css';
let base = readFileSync(baseP, 'utf8');
if (!/--z-dropdown/.test(base)) {
  // 插在 --z-tooltip 行之后（保持 z 令牌族连续）
  base = base.replace(/(--z-tooltip:\s*1300;)/, `$1\n  --z-dropdown: 500;        /* 下拉面板：高于 header(100)/sidebar(301)/overlay(300)，低于 modal(1000) */`);
  writeFileSync(baseP, base, 'utf8');
  console.log('  [base.css] 补 --z-dropdown: 500');
} else {
  console.log('  [base.css] --z-dropdown 已存在，跳过');
}

// ── 2. index.css @theme z 桥接（若已有 --z-* 桥接块则补一行）──
const idxP = 'src/index.css';
let idx = readFileSync(idxP, 'utf8');
if (!/--z-dropdown/.test(idx)) {
  // 找 @theme 块内的 --z- 桥接行（若有），插在其后；否则插到 @theme 块结尾前
  if (/--z-(toast|tooltip)/.test(idx)) {
    idx = idx.replace(/(--z-tooltip:\s*var\(--z-tooltip\);)/, `$1\n  --z-dropdown: var(--z-dropdown);`);
    writeFileSync(idxP, idx, 'utf8');
    console.log('  [index.css] @theme 补 --z-dropdown 桥接');
  } else {
    console.log('  [index.css] 无既有 --z-* 桥接块，跳过（z-dropdown 由 base.css 令牌直接提供）');
  }
} else {
  console.log('  [index.css] --z-dropdown 桥接已存在，跳过');
}
console.log('\nP1-9 z-dropdown 修复完成');
