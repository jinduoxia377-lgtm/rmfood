/**
 * RMFOOD 设计系统 — Modal 模态框
 * Portal渲染 + 遮罩 + 缩放动画 + 键盘关闭
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  maxWidth?: string
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export function Modal({ open, onClose, title, description, children, className, size = 'md', maxWidth }: ModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    previousActiveElement.current = document.activeElement as HTMLElement
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // Focus trap: Tab / Shift+Tab within modal
      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusable?.length) {
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault()
            last.focus()
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    // 优先聚焦关闭按钮（如果有），否则聚焦 modal 容器
    if (title || description) {
      closeButtonRef.current?.focus()
    } else {
      modalRef.current?.focus()
    }
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
      previousActiveElement.current?.focus()
    }
  }, [open, onClose])

  if (!open || !mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[var(--z-modal-backdrop,9999)] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        tabIndex={-1}
        className={cn(
          'relative w-full rounded-2xl bg-white dark:bg-neutral-900 shadow-xl',
          'border border-neutral-200 dark:border-neutral-800',
          'animate-scale-in',
          maxWidth ?? sizeClasses[size],
          className,
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
      >
        {(title || description) && (
          <div className="flex items-start justify-between p-6 pb-0">
            <div>
              {title && <h2 id="modal-title" className="text-lg font-semibold text-neutral-900 dark:text-white">{title}</h2>}
              {description && <p id="modal-description" className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors -mr-1.5 -mt-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              aria-label="关闭对话框"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
