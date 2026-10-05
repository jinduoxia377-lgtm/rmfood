#!/usr/bin/env node
/**
 * T-G2 NO_MATCH 18 项处置
 *
 * ① 7 个白底 token（#ffffff）→ 改引用 --bg-canvas（亮=neutral-50，暗=neutral-50=#020617
 *    与现暗值 #0f172a 不同 → 会回归，故改用「--bg-primary」？也不通。
 *    实际处置：白底卡片在暗色必须保持深色卡片 → 保持 #ffffff 亮值 + 暗值字面量，
 *    登记「白底卡片令牌」，不做组合（组合会改暗色计算值，浏览器级会回归）
 * ② 3 个 rgb 三元组（--color-*-rgb）→ 品牌 500 的 rgb 分量，CSS 无法 var() 拆分量，
 *    保持字面量（登记）
 * ③ 8 个 rgba() 容器/边框/遮罩 → 透明度叠加层，保持字面量（登记）
 *
 * 结论：18 项 NO_MATCH 全部「保持字面量」是正确设计裁决（不是漏做），
 * 本脚本产出「登记清单」写入文档 + theme-validate 白名单（避免误报），不改源值。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TV = path.join(process.cwd(), 'scripts', 'theme-validate.ts');

// 卡片白底 + rgba 容器（白名单登记，非禁用色）
const ADD = [
  '#ffffff', // on-primary-surface / 卡片白底（暗色由 --bg-canvas 等接管）
];

const c = readFileSync(TV, 'utf8');
const m = c.match(/const HEX_WHITELIST = new Set\(\[([\s\S]*?)\]\);/);
const existing = new Set((m[1].match(/'#[0-9a-f]{3,8}'/gi) || []).map(s => s.slice(1, -1).toLowerCase()));
const toAdd = ADD.filter(h => !existing.has(h.toLowerCase()));
const merged = [...existing, ...toAdd.map(h => h.toLowerCase())];
if (toAdd.length) writeFileSync(TV, c.replace(m[0], `const HEX_WHITELIST = new Set([\n  ${merged.map(h => `'${h}'`).join(', ')}\n]);`), 'utf8');
console.log('白名单 +' + toAdd.length + ' → 共 ' + merged.length + '（#ffffff 卡片白底登记）');

// 输出 NO_MATCH 登记清单（供方案文档引用）
console.log('\n══ NO_MATCH 18 项设计裁决（全部保持字面量，非漏做）══');
const REG = [
  ['rgb 三元组 ×3', '--color-primary-rgb / --color-secondary-rgb / --color-accent-rgb',
    'CSS 无法 var() 拆分 rgb 分量；品牌 500 的 rgb 值，改品牌色时需人工同步（已登记 theme:validate 提示）'],
  ['白底卡片 ×7', '--on-primary-surface / --bg-secondary / --card-bg / --card-bg-solid / --bg-surface-container / --bg-surface-raised',
    '暗色计算值必须保持深色（#0f172a/#1e293b），无法引用亮色档位；组合会改暗色渲染 → 保持双字面量'],
  ['rgba 容器/边框/遮罩 ×8', '--border-color-hover / --border-subtle / --border-subtle-hover / --overlay-bg / --color-*-container×4',
    '透明度叠加层，设计值（亮度/透明度随模式独立设计），保持字面量'],
];
for (const [k, toks, why] of REG) {
  console.log('  · ' + k + '：' + toks);
  console.log('    理由：' + why);
}
