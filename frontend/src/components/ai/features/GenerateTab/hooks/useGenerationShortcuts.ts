/**
 * useGenerationShortcuts - 配方生成快捷键Hook
 * 
 * @description 提供键盘快捷键支持，提升操作效率
 * @version 1.0.0
 */
import { useEffect, useCallback, useRef } from 'react'

interface ShortcutOptions {
  onGenerate?: () => void
  onCancel?: () => void
  onReset?: () => void
  onSwitchToChat?: () => void
  onToggleAdvanced?: () => void
}

export function useGenerationShortcuts(options: ShortcutOptions = {}) {
  const optionsRef = useRef(options)
  optionsRef.current = options

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl/Cmd + Enter: 生成配方
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      optionsRef.current.onGenerate?.()
    }
    
    // Escape: 取消/重置
    if (e.key === 'Escape') {
      e.preventDefault()
      optionsRef.current.onCancel?.()
    }
    
    // Ctrl/Cmd + Shift + R: 重置
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
      e.preventDefault()
      optionsRef.current.onReset?.()
    }
    
    // Ctrl/Cmd + K: 切换到对话模式
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      optionsRef.current.onSwitchToChat?.()
    }
    
    // Ctrl/Cmd + Shift + A: 切换高级模式
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
      e.preventDefault()
      optionsRef.current.onToggleAdvanced?.()
    }
  }, [])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    shortcuts: {
      generate: 'Ctrl+Enter',
      cancel: 'Escape',
      reset: 'Ctrl+Shift+R',
      chat: 'Ctrl+K',
      advanced: 'Ctrl+Shift+A',
    },
  }
}
