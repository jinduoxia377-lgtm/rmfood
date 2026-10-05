/**
 * CANVAS_COLORS — canvas 直绘安全色表
 *
 * ⚠️ 仅用于 2D canvas（fillStyle/strokeStyle）—— 它不解析 CSS var()，
 * 必须用 hex 字面量。DOM/CSS/React style 一律用 var(--color-*)，勿用此表。
 *
 * 取值与 base.css/dark.css 品牌色阶一致（M5 对齐）；改品牌色时同步此表。
 */
export const CANVAS_COLORS = {
  primary: '#34d399',      // 品牌主色浅档（Emerald 400，M5 替代）
  primaryBright: '#10b981', // 品牌主色 500
  primaryDeep: '#059669',   // 品牌主色 600
  secondary: '#3b82f6',    // 品牌辅色（M5 替代）
  accent: '#8b5cf6',       // 强调色（M5 替代）
  info: '#0891b2',         // cyan-600（M5 保留）
  danger: '#ef4444',       // 语义 error
  warning: '#f59e0b',      // 语义 warning
  success: '#10b981',      // 语义 success
  surface: '#1c1c1e',      // 暗面（M5 保留）
} as const;

export type CanvasColorName = keyof typeof CANVAS_COLORS;
