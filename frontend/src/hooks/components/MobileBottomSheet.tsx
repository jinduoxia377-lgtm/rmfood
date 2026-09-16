/**
 * 移动端底部弹出面板组件
 * 支持拖拽调整高度、动画过渡、安全区域适配
 */

import React, { useState, useRef, useEffect } from 'react'
import { X, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSafeArea } from '../useMobile'

interface MobileBottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  height?: string | number
  /** 是否可拖拽调整高度 */
  draggable?: boolean
  /** 是否显示关闭按钮 */
  showClose?: boolean
  /** 是否适配安全区域 */
  safeArea?: boolean
}

export default function MobileBottomSheet({
  open,
  onClose,
  title,
  children,
  height = '70%',
  draggable = true,
  showClose = true,
  safeArea = true,
}: MobileBottomSheetProps) {
  const [sheetHeight, setSheetHeight] = useState(height)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const startHeight = useRef(height)
  const insets = useSafeArea()

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (!draggable) return

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    startHeight.current = typeof sheetHeight === 'number' ? sheetHeight : parseInt(sheetHeight)
  }

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!draggable || !dragStartY.current) return

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const deltaY = dragStartY.current - clientY
    const baseHeight = typeof startHeight.current === 'number' ? startHeight.current : parseFloat(startHeight.current) || 70
    const newHeight = Math.max(30, Math.min(90, baseHeight + (deltaY / window.innerHeight) * 100))
    setSheetHeight(`${newHeight}%`)
  }

  const handleDragEnd = () => {
    dragStartY.current = 0
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
         role="button" tabIndex={0} onClick={onClose}
      />

      {/* 面板 */}
      <div
        ref={sheetRef}
        className={cn(
          'relative w-full max-w-lg bg-white dark:bg-neutral-800 rounded-t-2xl shadow-2xl overflow-hidden',
          'animate-slide-up',
        )}
        style={{
          height: sheetHeight,
          paddingBottom: safeArea ? insets.bottom : undefined,
        }}
      >
        {/* 拖拽手柄 */}
        {draggable && (
          <div
            className="flex justify-center pt-3 pb-2 cursor-grab active:grabbing touch-none"
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          </div>
        )}

        {/* 标题栏 */}
        {(title || showClose) && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700">
            {title && (
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                {title}
              </h3>
            )}
            {showClose && !title && (
              <div className="flex-1" />
            )}
            {showClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all duration-200 touch-target"
                aria-label="关闭面板"
              >
                <X size={20} className="text-neutral-500" />
              </button>
            )}
          </div>
        )}

        {/* 内容区 */}
        <div
          className="overflow-y-auto overscroll-contain"
          style={{ height: 'calc(100% - 60px)' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export { MobileBottomSheet }
