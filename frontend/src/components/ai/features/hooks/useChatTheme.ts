/**
 * useChatTheme — AI 对话视觉方案切换 Hook
 *
 * 功能：
 * - 三套方案切换 (academic / glassmorphism / professional)
 * - localStorage 持久化
 * - 循环切换
 *
 * 使用方式：在容器 div 上使用 className={`chat-theme-${scheme} chat-area`}
 */
import { useState, useCallback } from 'react'
import type { DesignScheme } from '../styles/chatDesignSystem'

const STORAGE_KEY = 'rmfood_chat_theme'

interface UseChatThemeReturn {
  scheme: DesignScheme
  setScheme: (scheme: DesignScheme) => void
  cycleScheme: () => void
  schemeInfo: {
    name: string
    nameCN: string
    description: string
  }
}

export const SCHEME_ORDER: DesignScheme[] = ['academic', 'glassmorphism', 'professional']

export const SCHEME_INFO: Record<DesignScheme, { name: string; nameCN: string; description: string }> = {
  academic: {
    name: 'Academic Minimal',
    nameCN: '学术极简',
    description: '高留白、克制色彩、严谨层级',
  },
  glassmorphism: {
    name: 'Tech Glassmorphism',
    nameCN: '科技玻璃态',
    description: '毛玻璃效果、渐变光晕、沉浸体验',
  },
  professional: {
    name: 'Professional Card',
    nameCN: '专业卡片式',
    description: '清晰边界、结构化信息、效率优先',
  },
}

export function useChatTheme(initialScheme?: DesignScheme): UseChatThemeReturn {
  const [scheme, setSchemeState] = useState<DesignScheme>(() => {
    if (initialScheme) return initialScheme
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored && SCHEME_ORDER.includes(stored as DesignScheme)) {
        return stored as DesignScheme
      }
    } catch {}
    return 'professional'
  })

  const setScheme = useCallback((newScheme: DesignScheme) => {
    setSchemeState(newScheme)
    try { localStorage.setItem(STORAGE_KEY, newScheme) } catch {}
  }, [])

  // 循环切换：academic → glassmorphism → professional → academic
  const cycleScheme = useCallback(() => {
    const currentIndex = SCHEME_ORDER.indexOf(scheme)
    const nextIndex = (currentIndex + 1) % SCHEME_ORDER.length
    setScheme(SCHEME_ORDER[nextIndex])
  }, [scheme, setScheme])

  return { scheme, setScheme, cycleScheme, schemeInfo: SCHEME_INFO[scheme] }
}

export type { UseChatThemeReturn }
