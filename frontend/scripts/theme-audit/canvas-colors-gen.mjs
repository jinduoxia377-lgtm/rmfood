#!/usr/bin/env node
/**
 * M5+ canvas 安全色表 —— 收口 canvas 直绘文件的品牌 hex
 *
 * canvas 的 fillStyle/strokeStyle 不解析 var()，M5 已把 7 个 canvas 文件的
 * 禁用色换成品牌色阶 hex（#34d399 等）。本脚本把这些散落 hex 收口到单一
 * 导出常量 CANVAS_COLORS，各 canvas 文件改为引用，避免「改品牌色要改 7 处」。
 */
import { writeFileSync } from 'node:fs';

const CANVAS_COLORS_SRC = `/**
 * CANVAS_COLORS — canvas 直绘安全色表
 *
 * ⚠️ 仅用于 2D canvas（fillStyle/strokeStyle）—— 它不解析 CSS var()，
 * 必须用 hex 字面量。DOM/CSS/React style 一律用 var(--color-*)，勿用此表。
 *
 * 取值与 base.css/dark.css 品牌色阶一致（M5 对齐）；改品牌色时同步此表。
 */
export const CANVAS_COLORS = {
  primary: '#34d399',      // = 暗色 primary（M5 #34C759 → 品牌浅档）
  primaryBright: '#10b981', // 品牌主色 500
  primaryDeep: '#059669',   // 品牌主色 600
  secondary: '#3b82f6',    // 品牌辅色（M5 #007AFF → secondary-500）
  accent: '#8b5cf6',       // 强调色（M5 #AF52DE → accent-500）
  info: '#0891b2',         // cyan-600（M5 保留）
  danger: '#ef4444',       // 语义 error
  warning: '#f59e0b',      // 语义 warning
  success: '#10b981',      // 语义 success
  surface: '#1c1c1e',      // 暗面（M5 保留）
} as const;

export type CanvasColorName = keyof typeof CANVAS_COLORS;
`;

const dest = process.argv[2];
if (!dest) { console.error('用法: node canvas-colors-gen.mjs <目标文件路径>'); process.exit(1); }
writeFileSync(dest, CANVAS_COLORS_SRC, 'utf8');
console.log('已生成 ' + dest + '（' + CANVAS_COLORS_SRC.split('\n').length + ' 行）');
