/**
 * HotkeyManager - 全局快捷键管理系统 (v6.0)
 *
 * 功能特性：
 * 1. 注册/注销全局快捷键
 * 2. 冲突检测（避免与浏览器原生快捷键冲突）
 * 3. 作用域控制（global/input）
 * 4. 快捷键提示 UI 集成
 * 5. 自动清理（组件卸载时）
 *
 * 使用示例：
 * ```typescript
 * const hotkeyManager = new HotkeyManager()
 *
 * hotkeyManager.register('ctrl+enter', () => {
 *   handleSend()
 * }, { description: '发送消息' })
 *
 * // 清理
 * useEffect(() => {
 *   return () => hotkeyManager.destroy()
 * }, [])
 * ```
 *
 * @version 6.0.0
 * @lastUpdated 2026-05-10
 */

export interface HotkeyOptions {
  description: string
  enabled?: boolean
  scope?: 'global' | 'input'
  preventDefault?: boolean
}

interface HotkeyBinding {
  keyCombo: string
  handler: (e: KeyboardEvent) => void
  options: HotkeyOptions
}

const BROWSER_RESERVED_KEYS = new Set([
  'ctrl+t',      // 新标签页
  'ctrl+w',      // 关闭标签页
  'ctrl+n',      // 新窗口
  'ctrl+r',      // 刷新页面
  'ctrl+h',      // 历史记录
  'ctrl+l',      // 地址栏
  'f5',          // 刷新
  'f11',         // 全屏
  'f12',         // 开发者工具
])

export class HotkeyManager {
  private bindings = new Map<string, HotkeyBinding>()
  private isDestroyed = false

  /**
   * 注册快捷键
   *
   * @param keyCombo - 快捷键组合（如 'ctrl+enter', 'escape', '/'）
   * @param handler - 触发时的回调函数
   * @param options - 配置选项
   */
  register(keyCombo: string, handler: (e: KeyboardEvent) => void, options: HotkeyOptions): void {
    if (this.isDestroyed) {
      logger.warn('[HotkeyManager] ⚠️ 无法在已销毁的实例上注册快捷键')
      return
    }

    const normalizedKey = this.normalizeKeyCombo(keyCombo)

    // 冲突检测
    if (BROWSER_RESERVED_KEYS.has(normalizedKey)) {
      logger.warn(`[HotkeyManager] ⚠️ 快捷键 "${normalizedKey}" 与浏览器保留快捷键冲突`)
    }

    if (this.bindings.has(normalizedKey)) {
      logger.warn(`[HotkeyManager] ⚠️ 快捷键 "${normalizedKey}" 已存在，将被覆盖`)
    }

    this.bindings.set(normalizedKey, {
      keyCombo: normalizedKey,
      handler,
      options: { ...options },
    })

    if (this.bindings.size === 1) {
      this.attachGlobalListener()
    }
  }

  /**
   * 注销快捷键
   *
   * @param keyCombo - 要注销的快捷键组合
   */
  unregister(keyCombo: string): void {
    const normalizedKey = this.normalizeKeyCombo(keyCombo)
    this.bindings.delete(normalizedKey)

    if (this.bindings.size === 0) {
      this.detachGlobalListener()
    }
  }

  /**
   * 销毁管理器，清理所有监听器
   */
  destroy(): void {
    this.isDestroyed = true
    this.bindings.clear()
    this.detachGlobalListener()
  }

  /**
   * 获取所有已注册的快捷键信息（用于帮助面板）
   */
  getRegisteredHotkeys(): { keyCombo: string; description: string; scope: string }[] {
    return Array.from(this.bindings.values()).map(binding => ({
      keyCombo: binding.keyCombo,
      description: binding.options.description,
      scope: binding.options.scope || 'global',
    }))
  }

  /**
   * 标准化快捷键组合字符串
   */
  private normalizeKeyCombo(keyCombo: string): string {
    return keyCombo.toLowerCase().replace(/\s+/g, '')
  }

  /**
   * 解析键盘事件为标准化的快捷键字符串
   */
  private parseKeyEvent(e: KeyboardEvent): string {
    const parts: string[] = []

    if (e.ctrlKey || e.metaKey) parts.push('ctrl')
    if (e.altKey) parts.push('alt')
    if (e.shiftKey) parts.push('shift')
    parts.push(e.key.toLowerCase())

    return parts.join('+')
  }

  /**
   * 检查事件目标是否是输入元素
   */
  private isInputTarget(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement
    const tag = target.tagName.toLowerCase()
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      target.isContentEditable
    )
  }

  /**
   * 全局键盘事件处理器
   */
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.isDestroyed) return

    const parsedKey = this.parseKeyEvent(e)
    const binding = this.bindings.get(parsedKey)

    if (!binding) return

    // 检查是否启用
    if (binding.options.enabled === false) return

    // 检查作用域
    const isInputScope = binding.options.scope === 'input'
    const isInInput = this.isInputTarget(e)

    if (isInputScope && !isInInput) return
    if (!isInputScope && isInInput && parsedKey !== 'escape') return

    // 执行处理函数
    try {
      if (binding.options.preventDefault !== false) {
        e.preventDefault()
        e.stopPropagation()
      }

      binding.handler(e)
    } catch (error) {
      logger.error('[HotkeyManager] ❌ 快捷键处理器执行失败:', error)
    }
  }

  /**
   * 附加全局监听器
   */
  private attachGlobalListener(): void {
    window.addEventListener('keydown', this.handleKeyDown, true)
  }

  /**
   * 移除全局监听器
   */
  private detachGlobalListener(): void {
    window.removeEventListener('keydown', this.handleKeyDown, true)
  }
}

// ===== React Hook 封装 =====

import { useEffect, useRef } from 'react'


import { logger } from '@/utils/safeLogger';
interface UseHotkeysReturn {
  register: (keyCombo: string, handler: (e: KeyboardEvent) => void, options?: HotkeyOptions) => void
  unregister: (keyCombo: string) => void
  getRegisteredHotkeys: () => { keyCombo: string; description: string; scope: string }[]
}

/**
 * useHotkeys - React Hook 封装的快捷键管理器
 *
 * 自动在组件卸载时清理所有快捷键绑定。
 *
 * @example
 * ```tsx
 * const { register } = useHotkeys()
 *
 * useEffect(() => {
 *   register('ctrl+enter', () => send(), { description: '发送消息' })
 *   register('escape', () => closeAll(), { description: '关闭所有模态框' })
 * }, [])
 * ```
 */
export function useHotkeys(): UseHotkeysReturn {
  const managerRef = useRef<HotkeyManager | null>(null)

  useEffect(() => {
    managerRef.current = new HotkeyManager()

    return () => {
      managerRef.current?.destroy()
      managerRef.current = null
    }
  }, [])

  const register = (keyCombo: string, handler: (e: KeyboardEvent) => void, options?: HotkeyOptions) => {
    managerRef.current?.register(keyCombo, handler, options || { description: '' })
  }

  const unregister = (keyCombo: string) => {
    managerRef.current?.unregister(keyCombo)
  }

  const getRegisteredHotkeys = () => {
    return managerRef.current?.getRegisteredHotkeys() || []
  }

  return { register, unregister, getRegisteredHotkeys }
}

// ===== 默认导出 =====
export default HotkeyManager
