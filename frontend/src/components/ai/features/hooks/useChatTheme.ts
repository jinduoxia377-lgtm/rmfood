/**
 * useChatTheme — AI 对话视觉主题 Hook（统一项目主题）
 *
 * 功能：
 * - 使用项目统一的 RMFOOD 品牌主题
 * - 基于项目设计令牌（base.css / dark.css）
 * - 不再支持主题切换，确保 UI 一致性
 *
 * @version 2.0.0
 * @lastUpdated 2026-08-24
 */
import { useState, useCallback } from 'react'
import type { DesignScheme } from '../styles/chatDesignSystem'

export type { DesignScheme }

export interface UseChatThemeReturn {
  scheme: DesignScheme
  schemeInfo: {
    name: string
    nameCN: string
    description: string
  }
  cycleScheme: () => void
  setScheme: (scheme: DesignScheme) => void
}

// 统一使用项目品牌主题
export const UNIFIED_SCHEME: DesignScheme = 'unified'

export const SCHEME_INFO: Record<DesignScheme, { name: string; nameCN: string; description: string }> = {
  unified: {
    name: 'RMFOOD Unified',
    nameCN: '品牌统一',
    description: '基于项目设计令牌，品牌翠绿 #10B981，专业级药食同源配方平台风格',
  },
}

export function useChatTheme(_initialScheme?: DesignScheme): UseChatThemeReturn {
  const [scheme] = useState<DesignScheme>(UNIFIED_SCHEME)

  // 无主题切换功能
  const cycleScheme = useCallback(() => {}, [])
  const setScheme = useCallback((_newScheme: DesignScheme) => {}, [])

  return { scheme, schemeInfo: SCHEME_INFO[scheme], cycleScheme, setScheme }
}

