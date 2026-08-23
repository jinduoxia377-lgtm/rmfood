/**
 * RMFOOD 设计系统 — Modal 模态框 (shadcn/ui Dialog 兼容层)
 *
 * Phase 5: 使用 Radix Dialog 替代自研实现，保留相同 API (open/onClose/title/description/size)
 * 键盘关闭、焦点陷阱、Portal 渲染全部由 Radix 原生支持
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './shadcn/dialog'

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

export function Modal({ open, onClose, title, description, children, className, size = 'md', maxWidth }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    previousActiveElement.current = document.activeElement as HTMLElement
    return () => {
      document.body.style.overflow = ''
      previousActiveElement.current?.focus()
    }
  }, [open])

  if (!open || !mounted) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        ref={modalRef}
        size={size}
        maxWidth={maxWidth}
        className={className}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  )
}

export type { ModalProps }
