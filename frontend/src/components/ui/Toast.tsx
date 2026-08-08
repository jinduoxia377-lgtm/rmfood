/**
 * Toast Notification System v2.0
 *
 * 基于 UI/UX Pro Max 规范的专业通知系统
 *
 * 特性:
 * - WCAG 2.1 AA 可访问性
 * - 自动消失与手动关闭
 * - 堆叠管理（最多3条）
 * - 动画效果（进入/退出）
 * - 响应式设计
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { type FeedbackMessage, type FeedbackType } from '@/utils/uiuxEnhancement'

interface ToastProps {
  message: FeedbackMessage
  onClose: (id: string) => void
}

const iconMap: Record<FeedbackType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-primary-500" />,
  error: <AlertCircle className="w-5 h-5 text-error-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-warning-500" />,
  info: <Info className="w-5 h-5 text-secondary-500" />,
  loading: <Loader2 className="w-5 h-5 text-secondary-500 animate-spin" />,
}

const colorMap: Record<FeedbackType, string> = {
  success: 'border-l-emerald-500 bg-primary-50 dark:bg-emerald-950/30',
  error: 'border-l-red-500 bg-error-50 dark:bg-red-950/30',
  warning: 'border-l-amber-500 bg-warning-50 dark:bg-amber-950/30',
  info: 'border-l-blue-500 bg-secondary-50 dark:bg-blue-950/30',
  loading: 'border-l-blue-500 bg-secondary-50 dark:bg-blue-950/30',
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  const toastRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }, [])

  const handleClose = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => {
      onClose(message.id)
    }, 300)
  }, [message.id, onClose])

  useEffect(() => {
    const duration = message.duration ?? (message.type === 'loading' ? 0 : 5000)
    if (duration > 0) {
      const timer = setTimeout(handleClose, duration)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [message.duration, message.type, handleClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose()
    }
  }, [handleClose])

  return (
    <div
      ref={toastRef}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`
        relative flex items-start gap-3 p-4 mb-2 rounded-lg border-l-4 shadow-lg
        backdrop-blur-sm transition-all duration-300 ease-out
        max-w-md w-full
        ${colorMap[message.type]}
        ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'}
        ${isExiting ? 'opacity-0 translate-x-full' : ''}
      `}
      style={{ animationDuration: '300ms' }}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {iconMap[message.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          {message.title}
        </p>
        {message.description && (
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {message.description}
          </p>
        )}

        {message.action && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              message.action?.onClick()
              handleClose()
            }}
            className="mt-2 text-sm font-medium text-secondary-600 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-300 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            {message.action.label}
          </button>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={handleClose}
        onKeyDown={handleKeyDown}
        className="flex-shrink-0 p-1 rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
        aria-label="关闭通知"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress Bar (for auto-dismiss) */}
      {message.duration && message.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-200 dark:bg-neutral-700 rounded-b-lg overflow-hidden">
          <div
            className="h-full bg-current opacity-30"
            style={{
              animation: `shrink ${message.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  )
}

// CSS Animation for progress bar — inject once into <head>
const SHRINK_ANIMATION_STYLE_ID = 'rmfood-toast-shrink-keyframes'

function ensureShrinkAnimationInjected() {
  if (typeof document === 'undefined') return
  if (document.getElementById(SHRINK_ANIMATION_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = SHRINK_ANIMATION_STYLE_ID
  style.textContent = `@keyframes shrink{from{width:100%}to{width:0%}}`
  document.head.appendChild(style)
}

// Auto-inject on first module load
ensureShrinkAnimationInjected()


// ============================================================================
// 向后兼容层 - 支持原有的 useToast 和 ToastProvider API
// ============================================================================

import { useToastStore } from '@/stores/toastStore'
import type { ReactNode } from 'react'

/**
 * ToastProvider - 向后兼容组件
 * 在新系统中作为空壳，实际功能由 ToastContainer 提供
 */
export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return <>{children}</>
}

/**
 * useToast - 向后兼容Hook
 * 连接原有的toastStore到新的反馈系统
 */
export const useToast = () => {
  const { addToast, removeToast, clearAll, toasts } = useToastStore()

  interface ToastOptions {
    duration?: number
    title?: string
  }

  return {
    addToast,
    removeToast,
    clearAll,
    toasts,
    success: (message: string, options?: ToastOptions) => addToast({ type: 'success', message, ...options }),
    error: (message: string, options?: ToastOptions) => addToast({ type: 'error', message, ...options }),
    warning: (message: string, options?: ToastOptions) => addToast({ type: 'warning', message, ...options }),
    info: (message: string, options?: ToastOptions) => addToast({ type: 'info', message, ...options }),
  }
}

