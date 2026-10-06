/**
 * 排版系统工具函数
 * 提供标准化的字体大小、行高、字重等属性
 * 基于 design-tokens.ts 设计令牌系统
 */

import { FONT_SIZES, LINE_HEIGHTS, FONT_WEIGHTS } from '../types/design-tokens';

/**
 * 获取字体大小
 * @param level 字体层级名称
 * @returns CSS字体大小值
 */
export function getFontSize(level: keyof typeof FONT_SIZES): string {
  return FONT_SIZES[level] || FONT_SIZES['body-md'];
}

/**
 * 获取行高
 * @param level 行高层级名称
 * @returns CSS行高值
 */
export function getLineHeight(level: keyof typeof LINE_HEIGHTS): string {
  return LINE_HEIGHTS[level] || LINE_HEIGHTS['body-md'];
}

/**
 * 获取字重
 * @param level 字重层级名称
 * @returns CSS字重值
 */
export function getFontWeight(level: keyof typeof FONT_WEIGHTS): number {
  return Number(FONT_WEIGHTS[level] || FONT_WEIGHTS.regular);
}

/**
 * 获取完整的排版样式对象（用于React inline style）
 * @param fontLevel 字体层级
 * @param fontWeightLevel 字重层级（可选）
 * @param lineHeightLevel 行高层级（可选）
 * @returns React CSS Properties 对象
 */
export function getTypographyStyles(
  fontLevel: keyof typeof FONT_SIZES,
  fontWeightLevel?: keyof typeof FONT_WEIGHTS,
  lineHeightLevel?: keyof typeof LINE_HEIGHTS,
): React.CSSProperties {
  const styles: React.CSSProperties = {
    fontSize: getFontSize(fontLevel),
    lineHeight: getLineHeight(lineHeightLevel || 'body-md'),
  };

  if (fontWeightLevel) {
    styles.fontWeight = getFontWeight(fontWeightLevel);
  }

  return styles;
}

/**
 * 预定义常用排版样式映射表
 * 用于快速应用标准排版组合
 */
export const TYPOGRAPHY_PRESETS = {
  // Display 级别 - 品牌展示/超大标题
  display: {
    fontSize: FONT_SIZES.display,
    lineHeight: LINE_HEIGHTS.display,
    fontWeight: FONT_WEIGHTS.bold,
  },
  'display-sm': {
    fontSize: FONT_SIZES['display-sm'],
    lineHeight: LINE_HEIGHTS['display-sm'],
    fontWeight: FONT_WEIGHTS.bold,
  },

  // Headline 级别 - 页面/章节标题
  'headline-lg': {
    fontSize: FONT_SIZES['headline-lg'],
    lineHeight: LINE_HEIGHTS['headline-lg'],
    fontWeight: FONT_WEIGHTS.bold,
  },
  'headline-md': {
    fontSize: FONT_SIZES['headline-md'],
    lineHeight: LINE_HEIGHTS['headline-md'],
    fontWeight: FONT_WEIGHTS.semibold,
  },
  'headline-sm': {
    fontSize: FONT_SIZES['headline-sm'],
    lineHeight: LINE_HEIGHTS['headline-sm'],
    fontWeight: FONT_WEIGHTS.semibold,
  },

  // Title 级别 - 卡片/组件标题
  'title-lg': {
    fontSize: FONT_SIZES['title-lg'],
    lineHeight: LINE_HEIGHTS['title-lg'],
    fontWeight: FONT_WEIGHTS.medium,
  },
  'title-md': {
    fontSize: FONT_SIZES['title-md'],
    lineHeight: LINE_HEIGHTS['title-md'],
    fontWeight: FONT_WEIGHTS.medium,
  },
  'title-sm': {
    fontSize: FONT_SIZES['title-sm'],
    lineHeight: LINE_HEIGHTS['title-sm'],
    fontWeight: FONT_WEIGHTS.medium,
  },

  // Body 级别 - 正文内容
  'body-lg': {
    fontSize: FONT_SIZES['body-lg'],
    lineHeight: LINE_HEIGHTS['body-lg'],
    fontWeight: FONT_WEIGHTS.regular,
  },
  'body-md': {
    fontSize: FONT_SIZES['body-md'],
    lineHeight: LINE_HEIGHTS['body-md'],
    fontWeight: FONT_WEIGHTS.regular,
  },
  'body-sm': {
    fontSize: FONT_SIZES['body-sm'],
    lineHeight: LINE_HEIGHTS['body-sm'],
    fontWeight: FONT_WEIGHTS.regular,
  },

  // Label 级别 - 标签/说明文字
  'label-lg': {
    fontSize: FONT_SIZES['label-lg'],
    lineHeight: LINE_HEIGHTS['label-lg'],
    fontWeight: FONT_WEIGHTS.medium,
  },
  'label-md': {
    fontSize: FONT_SIZES['label-md'],
    lineHeight: LINE_HEIGHTS['label-md'],
    fontWeight: FONT_WEIGHTS.medium,
  },
  'label-sm': {
    fontSize: FONT_SIZES['label-sm'],
    lineHeight: LINE_HEIGHTS['label-sm'],
    fontWeight: FONT_WEIGHTS.medium,
  },
} as const;

/**
 * 获取预设排版样式
 * @param presetName 预设名称
 * @returns React CSS Properties 对象
 */
export function getPresetTypography(
  presetName: keyof typeof TYPOGRAPHY_PRESETS,
): React.CSSProperties {
  return TYPOGRAPHY_PRESETS[presetName] || TYPOGRAPHY_PRESETS['body-md'];
}

/**
 * 图表专用排版配置
 * 用于ECharts/Recharts等图表库的文字样式
 */
export const CHART_TYPOGRAPHY = {
  axisLabel: {
    fontSize: parseInt(FONT_SIZES['body-sm']), // 12px
    fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
    color: 'var(--text-secondary)',
  },
  axisTitle: {
    fontSize: parseInt(FONT_SIZES['label-md']), // 12px
    fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
    fontWeight: Number(FONT_WEIGHTS.medium),
    color: 'var(--text-secondary)',
  },
  legendText: {
    fontSize: parseInt(FONT_SIZES['body-md']), // 14px
    fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
    color: 'var(--text-secondary)',
  },
  tooltipTitle: {
    fontSize: parseInt(FONT_SIZES['body-md']), // 14px
    fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
    fontWeight: Number(FONT_WEIGHTS.semibold),
    color: 'var(--text-primary)',
  },
  tooltipContent: {
    fontSize: parseInt(FONT_SIZES['body-sm']), // 12px
    fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
    color: 'var(--text-secondary)',
  },
  dataLabel: {
    fontSize: parseInt(FONT_SIZES['label-md']), // 12px
    fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
    fontWeight: Number(FONT_WEIGHTS.medium),
    color: 'var(--text-primary)',
  },
} as const;
