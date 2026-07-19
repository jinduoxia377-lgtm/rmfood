/**
 * useFocusTrap - 焦点陷阱 Hook (v1.0)
 *
 * 用于模态框、对话框等组件的键盘焦点管理。
 * 确保 Tab 键在指定容器内循环，符合 WCAG 2.1 AA 标准。
 *
 * 功能特性：
 * - 自动捕获 Tab/Shift+Tab 键
 * - 支持初始聚焦元素配置
 * - 支持 Escape 键关闭回调
 * - 支持延迟激活（动画完成后）
 * - 可恢复之前的焦点位置
 * - ARIA 属性自动管理（aria-modal）
 *
 * @version 1.0.0
 * @lastUpdated 2026-05-12
 */

import { useRef, useEffect, useCallback } from 'react'

interface UseFocusTrapOptions {
  /** 是否激活焦点陷阱 */
  active?: boolean
  /** 初始聚焦元素选择器或 ref */
  initialFocus?: string | HTMLElement | null
  /** Escape 键按下时的回调 */
  onEscape?: () => void
  /** 是否恢复之前的焦点 */
  restoreFocus?: boolean
  /** 延迟激活时间 (ms)，用于等待动画完成 */
  delay?: number
}

interface UseFocusTrapReturn {
  /** 容器 ref，需要绑定到模态框根元素 */
  containerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * 焦点陷阱 Hook
 *
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   const { containerRef } = useFocusTrap({
 *     active: isOpen,
 *     onEscape: onClose,
 *     initialFocus: '[data-autofocus]',
 *   })
 *
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       <input data-autofocus />
 *       <button onClick={onClose}>关闭</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useFocusTrap(options: UseFocusTrapOptions = {}): UseFocusTrapReturn {
  const {
    active = true,
    initialFocus = null,
    onEscape,
    restoreFocus = true,
    delay = 0,
  } = options

  const containerRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  /**
   * 获取容器内所有可聚焦元素
   */
  const getFocusableElements = useCallback((): HTMLElement[] => {
    const container = containerRef.current
    if (!container) return []

    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ')

    return Array.from(container.querySelectorAll<HTMLElement>(selector))
  }, [])

  /**
   * 获取第一个可聚焦元素
   */
  const getFirstFocusable = useCallback((): HTMLElement | null => {
    const elements = getFocusableElements()
    return elements[0] || null
  }, [getFocusableElements])

  /**
   * 获取最后一个可聚焦元素
   */
  const getLastFocusable = useCallback((): HTMLElement | null => {
    const elements = getFocusableElements()
    return elements[elements.length - 1] || null
  }, [getFocusableElements])

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Escape 键处理
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onEscape?.()
        return
      }

      // Tab 键处理
      if (event.key === 'Tab') {
        const focusableElements = getFocusableElements()

        if (focusableElements.length === 0) {
          event.preventDefault()
          return
        }

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (event.shiftKey) {
          // Shift + Tab: 向后循环
          if (document.activeElement === firstElement) {
            event.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab: 向前循环
          if (document.activeElement === lastElement) {
            event.preventDefault()
            firstElement.focus()
          }
        }
      }
    },
    [getFocusableElements, onEscape],
  )

  /**
   * 设置初始焦点
   */
  const setInitialFocus = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    let targetElement: HTMLElement | null = null

    if (typeof initialFocus === 'string') {
      targetElement = container.querySelector<HTMLElement>(initialFocus)
    } else if (initialFocus instanceof HTMLElement) {
      targetElement = initialFocus
    } else {
      targetElement = getFirstFocusable()
    }

    if (targetElement) {
      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        targetElement?.focus({ preventScroll: false })
      })
    }
  }, [initialFocus, getFirstFocusable])

  useEffect(() => {
    if (!active || !containerRef.current) return

    const container = containerRef.current

    // 保存当前焦点
    if (restoreFocus && document.activeElement instanceof HTMLElement) {
      previousActiveElement.current = document.activeElement
    }

    // 设置 ARIA 属性
    container.setAttribute('aria-modal', 'true')

    // 延迟设置初始焦点
    const timer = setTimeout(() => {
      setInitialFocus()
    }, delay)

    // 添加键盘监听
    container.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)

      // 移除监听器
      container.removeEventListener('keydown', handleKeyDown)

      // 移除 ARIA 属性
      container.removeAttribute('aria-modal')

      // 恢复之前的焦点
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus({ preventScroll: true })
        previousActiveElement.current = null
      }
    }
  }, [active, delay, handleKeyDown, setInitialFocus, restoreFocus])

  return { containerRef }
}

export default useFocusTrap
