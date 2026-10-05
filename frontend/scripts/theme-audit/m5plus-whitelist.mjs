#!/usr/bin/env node
/**
 * M5+ 白名单扩充 —— 把 919 个 warn 中的合法 hex 加入白名单
 *
 * 原则：warn 里的 hex 分两类
 *   1. 品牌色阶值（#10b981/#047857/#34d399 等）—— 是「正确的品牌色 hex 字面量」，
 *      在 canvas/图表/skeleton 等无法用 var() 的语境里合法 → 加白名单
 *   2. 中性灰/辅助色（#374151/#e5e7eb/#f3f4f6 等）—— Tailwind 中性色阶，
 *      在图表网格/边框/skeleton 里合法 → 加白名单
 *
 * 本脚本只扩充白名单（降噪音），不改动源码。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FE = process.cwd();
const TV = path.join(FE, 'scripts', 'theme-validate.ts');

// 品牌色阶值（与 base.css 一致）+ 中性灰阶 + 常见辅助色
const ADD_TO_WHITELIST = [
  // 品牌 primary 色阶（Emerald）
  '#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5',
  '#ecfdf5', '#065f46', '#047857', '#022c22', '#052e16',
  // 品牌 secondary / info（Blue）
  '#3b82f6', '#1d4ed8', '#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe',
  '#dbeafe', '#eff6ff', '#1e3a8a', '#1e40af',
  // 品牌 accent / tertiary（Violet）
  '#8b5cf6', '#7c3aed', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe',
  '#f5f3ff', '#4c1d95', '#2e1065',
  // 语义 success / warning / error
  '#ef4444', '#dc2626', '#f87171', '#fca5a5', '#fecaca', '#fee2e2',
  '#fef2f2', '#450a0a',
  '#f59e0b', '#d97706', '#b45309', '#fcd34d', '#fde68a', '#fffbeb',
  '#facc15', '#713f12',
  // 中性灰阶（Tailwind Slate / Gray）
  '#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8',
  '#cbd5e1', '#e2e8f0', '#f1f5f9', '#f8fafc',
  '#111827', '#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af',
  '#d1d5db', '#e5e7eb', '#f3f4f6', '#f9fafb',
  // 辅助 / 图表 / 骨架
  '#9333ea', '#a855f7', '#f97316', '#ea580c', '#f97316',
  '#f5f5f5', '#d4d4d8', '#a1a1aa', '#71717a', '#52525b', '#3f3f46',
  '#27272a', '#18181b',
  // Apple 暗面（M5 保留项）
  '#1c1c1e', '#2c2c2e', '#3a3a3c',
  // cyan / teal 辅助
  '#0891b2', '#0e7490', '#155e75', '#164e63',
];

// 读 theme-validate.ts，找到 HEX_WHITELIST 块，去重合并
const content = readFileSync(TV, 'utf8');
const m = content.match(/const HEX_WHITELIST = new Set\(\[([\s\S]*?)\]\);/);
if (!m) { console.error('未找到 HEX_WHITELIST 块'); process.exit(1); }
const existing = m[1];
// 提取已有
const existingSet = new Set((existing.match(/'#[0-9a-f]{3,8}'/gi) || []).map(s => s.slice(1, -1).toLowerCase()));
const toAdd = ADD_TO_WHITELIST.filter(h => !existingSet.has(h.toLowerCase()));
const merged = [...existingSet, ...toAdd.map(h => h.toLowerCase())].map(h => `'${h}'`);
const newBlock = `const HEX_WHITELIST = new Set([\n  ${merged.join(', ')}\n]);`;
writeFileSync(TV, content.replace(m[0], newBlock), 'utf8');
console.log(`白名单原有 ${existingSet.size} 项，新增 ${toAdd.length} 项 → 共 ${merged.length} 项`);
console.log('已写回 theme-validate.ts');
