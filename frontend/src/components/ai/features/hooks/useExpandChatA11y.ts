/**
 * useExpandChatA11y — 「放大对话窗口」展开态的可访问性副作用收口
 *
 * 职责（仅当 isExpanded=true 时生效，折叠态零开销）：
 * - Esc 关闭：keydown 挂在 stage 元素上（不挂 window），避免与全局快捷键 useKeyboardShortcuts 的 Esc 冲突
 * - body 滚动锁：展开时锁 body 滚动，折叠时还原（照抄 components/ui/Modal.tsx:127-128）
 * - 焦点陷阱：Tab / Shift+Tab 在展开面内圈闭，不让焦点跑到展开面之外
 * - 焦点还原：折叠时把焦点还给触发按钮（expandTriggerRef）
 *
 * 设计约束：本 hook 只编排副作用，不做任何布局/渲染决策（ADR-029 纯布局原则）。
 *
 * @version 1.0.0
 */
import * as React from 'react'

/** 可聚焦元素选择器（排除 disabled 与隐藏元素） */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

export function useExpandChatA11y(opts: {
  isExpanded: boolean
  /** 展开态根容器（role="dialog"）——Esc 监听与焦点陷阱的作用域 */
  stageRef: React.RefObject<HTMLDivElement | null>
  /** 触发放大的按钮——折叠时焦点还原目标 */
  triggerRef: React.RefObject<HTMLButtonElement | null>
  /** 折叠回调（Esc 触发） */
  onCollapse: () => void
}): void {
  const { isExpanded, stageRef, triggerRef, onCollapse } = opts

  // 记录展开前的焦点元素，折叠时还原（优先还给触发按钮，触发按钮不可用时退回原焦点）
  const previousActiveElement = React.useRef<HTMLElement | null>(null)

  // ── 进入展开态：记录焦点 + body 滚动锁；退出：还原滚动 + 焦点还原 ──
  React.useEffect(() => {
    if (!isExpanded) return

    previousActiveElement.current = document.activeElement as HTMLElement | null
    // 照抄 Modal.tsx:127 body 滚动锁
    document.body.style.overflow = 'hidden'

    return () => {
      // 还原 body 滚动（Modal.tsx:128）
      document.body.style.overflow = ''
      // 焦点还原：优先触发按钮，退回展开前的元素
      const restoreTarget = triggerRef.current ?? previousActiveElement.current
      restoreTarget?.focus?.()
    }
  }, [isExpanded, triggerRef])

  // ── Esc 关闭 + Tab 焦点陷阱（挂 stage，仅展开态挂载） ──
  React.useEffect(() => {
    if (!isExpanded) return
    const stage = stageRef.current
    if (!stage) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCollapse()
        return
      }

      if (e.key === 'Tab') {
        const focusables = Array.from(
          stage.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter(el => el.offsetParent !== null || el === document.activeElement)
        if (focusables.length === 0) {
          e.preventDefault()
          return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement as HTMLElement | null

        if (e.shiftKey) {
          // Shift+Tab：从第一个元素往回 → 跳到最后一个
          if (active === first || !stage.contains(active)) {
            e.preventDefault()
            last.focus()
          }
        } else {
          // Tab：从最后一个元素往前 → 跳到第一个
          if (active === last || !stage.contains(active)) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    stage.addEventListener('keydown', handleKeyDown)
    return () => stage.removeEventListener('keydown', handleKeyDown)
  }, [isExpanded, stageRef, onCollapse])
}

export default useExpandChatA11y
