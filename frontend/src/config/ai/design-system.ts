
/**
 * AI页面设计系统配置
 * 参照数据库页面设计规范
 */

import {
  MessageSquare,
  Sparkles,
  Shield,
  GitMerge,
  Cherry,
  BarChart3,
  Settings,
  Bot,
} from 'lucide-react'

// ==========================================
// 1. 图标配置
// ==========================================

export const AI_ICONS = {
  chat: MessageSquare,
  generate: Sparkles,
  safety: Shield,
  synergy: GitMerge,
  taste: Cherry,
  stability: BarChart3,
  config: Settings,
  modelStatus: Bot,
} as const

// ==========================================
// 2. 色彩主题配置
// ==========================================

export const AI_COLORS = {
  primary: {
    text: 'text-primary-600 dark:text-primary-400',
    bg: 'bg-primary-50 dark:bg-primary-950/40',
    border: 'border-primary-100 dark:border-primary-900/30',
  },
  blue: {
    text: 'text-secondary-600 dark:text-secondary-400',
    bg: 'bg-secondary-50 dark:bg-blue-950/40',
    border: 'border-blue-100 dark:border-blue-900/30',
  },
  amber: {
    text: 'text-warning-600 dark:text-warning-400',
    bg: 'bg-warning-50 dark:bg-amber-950/40',
    border: 'border-amber-100 dark:border-amber-900/30',
  },
  emerald: {
    text: 'text-primary-600 dark:text-primary-400',
    bg: 'bg-primary-50 dark:bg-emerald-950/40',
    border: 'border-emerald-100 dark:border-emerald-900/30',
  },
  red: {
    text: 'text-error-600 dark:text-error-400',
    bg: 'bg-error-50 dark:bg-red-950/40',
    border: 'border-red-100 dark:border-red-900/30',
  },
  accent: {
    text: 'text-accent-600 dark:text-accent-400',
    bg: 'bg-accent-50 dark:bg-accent-950/40',
    border: 'border-accent-100 dark:border-accent-900/30',
  },
} as const

// ==========================================
// 3. 子模块主题映射
// ==========================================

export const AI_TAB_THEMES = {
  chat: AI_COLORS.primary,
  generate: AI_COLORS.blue,
  safety: AI_COLORS.amber,
  synergy: AI_COLORS.emerald,
  taste: AI_COLORS.accent,
  stability: AI_COLORS.blue,
  config: AI_COLORS.primary,
} as const

// ==========================================
// 4. Badge变体配置
// ==========================================

export const AI_TAB_BADGE_VARIANTS = {
  chat: 'primary',
  generate: 'info',
  safety: 'warning',
  synergy: 'success',
  taste: 'neutral',
  stability: 'neutral',
  config: 'neutral',
} as const

// ==========================================
// 5. 图标尺寸常量
// ==========================================

export const AI_ICON_SIZES = {
  statsCard: 'w-5 h-5',
  header: 'w-4 h-4',
  search: 'w-5 h-5',
} as const

// ==========================================
// 6. 统计卡片配置
// ==========================================

export function getAIStatsConfig(
  chatCount: number,
  generateCount: number,
  safetyChecks: number,
  synergyCount: number,
  llmAvailable: boolean,
) {
  return [
    {
      label: '智能对话',
      value: chatCount,
      icon: AI_ICONS.chat,
      color: AI_TAB_THEMES.chat.text,
      bg: AI_TAB_THEMES.chat.bg,
      border: AI_TAB_THEMES.chat.border,
      tab: 'chat' as const,
    },
    {
      label: '配方生成',
      value: generateCount,
      icon: AI_ICONS.generate,
      color: AI_TAB_THEMES.generate.text,
      bg: AI_TAB_THEMES.generate.bg,
      border: AI_TAB_THEMES.generate.border,
      tab: 'generate' as const,
    },
    {
      label: '安全检查',
      value: safetyChecks,
      icon: AI_ICONS.safety,
      color: AI_TAB_THEMES.safety.text,
      bg: AI_TAB_THEMES.safety.bg,
      border: AI_TAB_THEMES.safety.border,
      tab: 'safety' as const,
    },
    {
      label: '协同分析',
      value: synergyCount,
      icon: AI_ICONS.synergy,
      color: AI_TAB_THEMES.synergy.text,
      bg: AI_TAB_THEMES.synergy.bg,
      border: AI_TAB_THEMES.synergy.border,
      tab: 'synergy' as const,
    },
    {
      label: '模型状态',
      value: llmAvailable ? '在线' : '离线',
      icon: AI_ICONS.modelStatus,
      color: llmAvailable ? AI_COLORS.emerald.text : AI_COLORS.red.text,
      bg: llmAvailable ? AI_COLORS.emerald.bg : AI_COLORS.red.bg,
      border: llmAvailable ? AI_COLORS.emerald.border : AI_COLORS.red.border,
      tab: 'config' as const,
    },
  ]
}

