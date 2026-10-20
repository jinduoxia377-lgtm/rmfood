'use client'

import * as React from 'react'
import { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: 'sm' | 'md' | 'lg' | 'xl'
    maxWidth?: string
    maxHeight?: string
  }
>(({ className, children, size = 'md', maxWidth, maxHeight, ...props }, ref) => {
  const sizeClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }
  const widthClass = maxWidth ? `max-w-[${maxWidth}]` : sizeClasses[size]
  const heightClass = maxHeight ? `max-h-[${maxHeight}]` : ''
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-[50%] top-[50%] z-[1001] w-full translate-x-[-50%] translate-y-[-50%] rounded-2xl border bg-card shadow-2xl duration-200',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          widthClass,
          heightClass,
          'max-h-[90vh] overflow-hidden flex flex-col',
          /* 移动端小屏（≤479px）：切换为全屏底部弹层，避免通栏贴边、适配安全区 */
          'max-[479px]:left-0 max-[479px]:top-0 max-[479px]:right-0 max-[479px]:bottom-0 max-[479px]:translate-x-0 max-[479px]:translate-y-0 max-[479px]:max-w-none max-[479px]:max-h-none max-[479px]:rounded-none max-[479px]:border-0 max-[479px]:shadow-none max-[479px]:pb-[max(env(safe-area-inset-bottom),1rem)] max-[479px]:data-[state=open]:slide-in-from-bottom max-[479px]:data-[state=closed]:slide-out-to-bottom',
          className
        )}
        {...props}
      >
        {children}
        {/* 统一右上角关闭按钮（DialogContent 原语级补齐，避免弹层缺失关闭入口） */}
        <DialogPrimitive.Close
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left p-6 pb-0', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 p-6 pt-0', className)} {...props} />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  maxWidth?: string
  maxHeight?: string
}

export function Modal({ open, onClose, title, description, children, className, size = 'md', maxWidth, maxHeight }: ModalProps) {
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!open) return
    previousActiveElement.current = document.activeElement as HTMLElement
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = ''; previousActiveElement.current?.focus() }
  }, [open])

  if (!open || !mounted) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent ref={undefined} size={size} maxWidth={maxWidth} maxHeight={maxHeight} className={className}
        onOpenAutoFocus={(e: Event) => e.preventDefault()} onInteractOutside={(e: Event) => e.preventDefault()}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 dark:bg-neutral-800/90 backdrop-blur-sm opacity-70 hover:opacity-100 transition-opacity focus:outline-none"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        <div className="flex-1 overflow-auto px-6 pb-6">
          {children}
        </div>
        {children && (
          <DialogFooter>
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              关闭
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
