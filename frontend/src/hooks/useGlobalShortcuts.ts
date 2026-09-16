/**
 * useGlobalShortcuts — 统一全局快捷键注册与冲突检测
 *
 * 所有快捷键在此集中注册，自动检测冲突并记录。
 * 优先级：global > local（input 聚焦时 local 接管）
 *
 * @example
 * useGlobalShortcuts([
 *   { key: 'k', ctrl: true, action: toggleSearch, scope: 'global' },
 *   { key: 'Escape', action: closeAll, scope: 'global' },
 * ])
 */
import { useEffect, useCallback, useRef } from 'react'

export interface GlobalShortcut {
  /** 按键（小写） */
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  meta?: boolean
  /** 作用域：global = 始终监听；local = 仅在 no focus 时触发 */
  scope?: 'global' | 'local'
  /** 描述，用于调试/帮助面板 */
  description?: string
  /** 按键处理函数 */
  action: (e: KeyboardEvent) => void
  /** 是否启用 */
  enabled?: boolean
  /** 命中优先级，数字越大越优先（默认 0） */
  priority?: number
}

/** 当前是否有 focus 在 input/textarea/contenteditable 内 */
function isFocusInInput(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    (el as HTMLElement).contentEditable === 'true' ||
    (el as HTMLElement).getAttribute('role') === 'textbox'
  )
}

let _registeredShortcuts: GlobalShortcut[] = []
let _conflictLog: Array<{ keys: string; descriptions: string[] }> = []

function keyDesc(s: GlobalShortcut): string {
  const parts: string[] = []
  if (s.ctrl || s.meta) parts.push('Ctrl')
  if (s.shift) parts.push('Shift')
  if (s.alt) parts.push('Alt')
  parts.push(s.key.toUpperCase())
  return parts.join('+')
}

export function useGlobalShortcuts(shortcuts: GlobalShortcut[], enabled = true) {
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

  // 冲突检测
  useEffect(() => {
    if (!enabled) return
    const conflicts = new Map<string, string[]>()
    for (const s of shortcuts) {
      if (s.enabled === false) continue
      const desc = keyDesc(s)
      const existing = conflicts.get(desc)
      if (existing) {
        existing.push(s.description ?? '(unnamed)')
      } else {
        conflicts.set(desc, [s.description ?? '(unnamed)'])
      }
    }
    _conflictLog = Array.from(conflicts.entries())
      .filter(([, descs]) => descs.length > 1)
      .map(([keys, descs]) => ({ keys, descriptions: descs }))
    if (_conflictLog.length > 0) {
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    if (!enabled) return
    _registeredShortcuts = shortcuts

    const handler = (e: KeyboardEvent) => {
      const inInput = isFocusInInput()

      // 排序：priority 高的优先
      const sorted = [...shortcuts]
        .filter((s) => s.enabled !== false)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))

      for (const shortcut of sorted) {
        if (shortcut.enabled === false) continue
        // local scope 时，不在 input 中才触发
        if (shortcut.scope === 'local' && inInput) continue

        const matches =
          shortcut.key.toLowerCase() === e.key.toLowerCase() &&
          (!!shortcut.ctrl === e.ctrlKey || shortcut.ctrl === undefined) &&
          (!!shortcut.shift === e.shiftKey || shortcut.shift === undefined) &&
          (!!shortcut.alt === e.altKey || shortcut.alt === undefined) &&
          (!!shortcut.meta === e.metaKey || shortcut.meta === undefined)

        if (matches) {
          e.preventDefault()
          shortcut.action(e)
          break
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [shortcuts, enabled])

  return { conflicts: _conflictLog }
}

/** 导出冲突日志，供快捷键帮助面板使用 */
export function getShortcutConflicts(): Array<{ keys: string; descriptions: string[] }> {
  return _conflictLog
}
