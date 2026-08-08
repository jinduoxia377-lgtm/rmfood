/**
 * ThemeToolbar - 主题切换工具栏组件 (v1.0)
 *
 * 职责：
 * - 渲染主题切换按钮
 * - 显示当前主题名称
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import React from 'react'
import { Palette } from 'lucide-react'

interface ThemeToolbarProps {
  scheme: string
  schemeNameCN?: string
  onCycle: () => void
  t: (key: string, fallback?: string) => string
}

export function ThemeToolbar({ scheme, schemeNameCN, onCycle, t }: ThemeToolbarProps) {
  return (
    <button
      onClick={onCycle}
      aria-label="切换主题"
      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-200 hover:shadow-md active:scale-95 bg-slate-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-600 dark:hover:text-violet-400 active:bg-neutral-100 dark:active:bg-neutral-700"
      title={`切换主题: ${schemeNameCN || scheme}`}
    >
      <Palette className="w-4 h-4" />
      <span className="text-xs font-medium hidden sm:inline">{schemeNameCN || scheme}</span>
    </button>
  )
}
