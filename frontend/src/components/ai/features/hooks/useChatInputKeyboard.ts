/**
 * useChatInputKeyboard - 键盘事件处理 Hook (v1.0)
 *
 * 职责：
 * - Enter 发送 / Shift+Enter 换行
 * - Escape 关闭面板
 * - Tab 接受第一个建议
 *
 * @version 1.0.0
 * @author RMFOOD Team
 */

import { useCallback } from 'react'
import type { SmartSuggestion } from './useChatInputSuggestions'

export interface UseChatInputKeyboardOptions {
  canSend: boolean
  showSuggestions: boolean
  suggestions: SmartSuggestion[]
  applySuggestion: (s: SmartSuggestion) => void
  setShowSuggestions: (v: boolean) => void
  setShowDeepThinkingPanel: (v: boolean) => void
  setShowSearchPanel: (v: boolean) => void
  onSend?: () => void
}

export function useChatInputKeyboard(opts: UseChatInputKeyboardOptions) {
  const { canSend, showSuggestions, suggestions, applySuggestion,
    setShowSuggestions, setShowDeepThinkingPanel, setShowSearchPanel, onSend } = opts

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend && onSend) onSend()
      return
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false)
      setShowDeepThinkingPanel(false)
      setShowSearchPanel(false)
    }
    if (e.key === 'Tab' && showSuggestions && suggestions.length > 0) {
      e.preventDefault()
      applySuggestion(suggestions[0])
    }
  }, [canSend, showSuggestions, suggestions, applySuggestion,
    setShowSuggestions, setShowDeepThinkingPanel, setShowSearchPanel, onSend])

  return { handleKeyDown }
}
