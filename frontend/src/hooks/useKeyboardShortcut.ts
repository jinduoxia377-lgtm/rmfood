import { useEffect, useCallback } from 'react'

interface KeyboardShortcutOptions {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  callback: () => void
  preventDefault?: boolean
}

export function useKeyboardShortcut(options: KeyboardShortcutOptions) {
  const { key, ctrlKey = false, shiftKey = false, metaKey: _metaKey = false, callback, preventDefault = true } = options

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isCtrl = ctrlKey ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey
      const isShift = shiftKey ? event.shiftKey : !event.shiftKey

      if (event.key.toLowerCase() === key.toLowerCase() && isCtrl && isShift) {
        if (preventDefault) event.preventDefault()
        callback()
      }
    },
    [key, ctrlKey, shiftKey, callback, preventDefault],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
