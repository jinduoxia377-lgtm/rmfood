/**
 * 图标尺寸标准化工具
 * 基于 design-tokens.ts 中的 ICON_SIZES 规范
 *
 * 尺寸层级说明:
 * - xs (14px): 徽章、紧凑列表、内联标签
 * - sm (16px): 按钮内联、表格操作 ⭐️ **最常用**
 * - md (20px): 导航菜单、侧边栏
 * - lg (24px): 功能入口、空状态插图
 * - xl (32px): Hero区域、特色功能
 * - 2xl (40px): 品牌标识、装饰性元素
 */

import { ICON_SIZES, ICON_USAGE } from '../types/design-tokens';

/**
 * 获取图标尺寸
 * @param sizeKey 尺寸标识
 * @returns CSS尺寸字符串
 */
export function getIconSize(sizeKey: keyof typeof ICON_SIZES): string {
  return ICON_SIZES[sizeKey] || ICON_SIZES.sm;
}

/**
 * 获取图标使用场景配置
 * @param usage 场景名称
 * @returns 场景配置对象
 */
export function getIconUsageConfig(usage: keyof typeof ICON_USAGE) {
  return ICON_USAGE[usage] || ICON_USAGE.button;
}

/**
 * Tailwind CSS 图标尺寸映射
 * 用于快速应用标准尺寸类名
 */
export const ICON_TAILWIND_CLASSES = {
  xs: 'w-3.5 h-3.5',       // 14px
  sm: 'w-4 h-4',           // 16px ⭐️ 最常用
  md: 'w-5 h-5',           // 20px
  lg: 'w-6 h-6',           // 24px
  xl: 'w-8 h-8',           // 32px
  '2xl': 'w-10 h-10',      // 40px
} as const;

/**
 * 获取Tailwind CSS图标类名
 * @param sizeKey 尺寸标识
 * @returns Tailwind类名字符串
 */
export function getIconClasses(sizeKey: keyof typeof ICON_TAILWIND_CLASSES): string {
  return ICON_TAILWIND_CLASSES[sizeKey] || ICON_TAILWIND_CLASSES.sm;
}

/**
 * 预定义常用图标样式组合
 */
export const ICON_PRESETS = {
  // 按钮图标（最常用）
  button: {
    className: `${ICON_TAILWIND_CLASSES.sm}`,
    size: ICON_SIZES.sm,
    strokeWidth: 2,
  },

  // 导航图标
  navigation: {
    className: `${ICON_TAILWIND_CLASSES.md}`,
    size: ICON_SIZES.md,
    strokeWidth: 2,
  },

  // 菜单项图标
  menuItem: {
    className: `${ICON_TAILWIND_CLASSES.sm}`,
    size: ICON_SIZES.sm,
    strokeWidth: 2,
  },

  // 卡片/统计图标
  card: {
    className: `${ICON_TAILWIND_CLASSES.lg}`,
    size: ICON_SIZES.lg,
    strokeWidth: 2,
  },

  // 页面标题图标
  pageTitle: {
    className: `${ICON_TAILWIND_CLASSES.lg}`,
    size: ICON_SIZES.lg,
    strokeWidth: 2,
  },

  // 空状态图标
  emptyState: {
    className: `${ICON_TAILWIND_CLASSES.xl}`,
    size: ICON_SIZES.xl,
    strokeWidth: 1.5,
  },

  // 品牌装饰图标
  brand: {
    className: `${ICON_TAILWIND_CLASSES['2xl']}`,
    size: ICON_SIZES['2xl'],
    strokeWidth: 1.5,
  },
} as const;
