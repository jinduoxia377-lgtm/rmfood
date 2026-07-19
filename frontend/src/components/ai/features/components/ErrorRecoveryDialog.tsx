/**
 * ErrorRecoveryDialog - 智能错误恢复对话框 (v7.0)
 *
 * 功能特性：
 * 1. 根据错误类型显示差异化的恢复策略和 UI
 * 2. 支持自动重试机制（可配置重试次数）
 * 3. 提供用户友好的错误提示和操作建议
 * 4. 支持倒计时器（限流错误）
 * 5. 可折叠的技术详情面板
 *
 * 错误类型支持：
 * - NetworkTimeout: 网络超时，自动重试3次
 * - Unauthorized: 401未授权，跳转登录
 * - RateLimited: 429限流，倒计时+禁用发送
 * - ServerError: 500服务器错误，指数退避重试
 * - StreamInterrupted: 流式中断，重连选项
 * - Unknown: 未知错误，通用恢复策略
 *
 * @version 7.0.0
 * @lastUpdated 2026-05-11
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  AlertTriangle,
  WifiOff,
  Lock,
  Timer,
  ServerCrash,
  Unplug,
  RefreshCw,
  X,
  LogIn,
  Bug,
  Lightbulb,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { logger } from '@/utils/safeLogger'

export enum ErrorType {
  NetworkTimeout = 'network_timeout',
  NetworkUnreachable = 'network_unreachable',
  Unauthorized = 'unauthorized',
  RateLimited = 'rate_limited',
  ServerError = 'server_error',
  StreamInterrupted = 'stream_interrupted',
  Unknown = 'unknown',
}

interface ClassifiedError {
  type: ErrorType
  originalError: Error
  userMessage: string
  suggestion: string
  canAutoRecover: boolean
  retryAfter?: number
  countdown?: number
}

export interface ErrorRecoveryDialogProps {
  error: Error | null
  errorType?: ErrorType
  onRetry?: () => Promise<void>
  onDismiss?: () => void
  onLogin?: () => void
  autoRetryCount?: number
  showDetails?: boolean
  className?: string
}

const ERROR_CONFIG: Record<ErrorType, {
  icon: React.ElementType
  title: string
  colorClass: string
  bgClass: string
}> = {
  [ErrorType.NetworkTimeout]: {
    icon: WifiOff,
    title: '连接超时',
    colorClass: 'text-orange-600 dark:text-orange-400',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
  },
  [ErrorType.NetworkUnreachable]: {
    icon: WifiOff,
    title: '无法连接服务',
    colorClass: 'text-error-600 dark:text-error-400',
    bgClass: 'bg-error-100 dark:bg-error-900/30',
  },
  [ErrorType.Unauthorized]: {
    icon: Lock,
    title: '会话已过期',
    colorClass: 'text-error-600 dark:text-error-400',
    bgClass: 'bg-error-100 dark:bg-error-900/30',
  },
  [ErrorType.RateLimited]: {
    icon: Timer,
    title: '请求过于频繁',
    colorClass: 'text-yellow-600 dark:text-yellow-400',
    bgClass: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  [ErrorType.ServerError]: {
    icon: ServerCrash,
    title: '服务器繁忙',
    colorClass: 'text-accent-600 dark:text-accent-400',
    bgClass: 'bg-accent-100 dark:bg-accent-900/30',
  },
  [ErrorType.StreamInterrupted]: {
    icon: Unplug,
    title: '响应中断',
    colorClass: 'text-secondary-600 dark:text-secondary-400',
    bgClass: 'bg-secondary-100 dark:bg-secondary-900/30',
  },
  [ErrorType.Unknown]: {
    icon: AlertTriangle,
    title: '发生错误',
    colorClass: 'text-neutral-600 dark:text-neutral-400',
    bgClass: 'bg-neutral-100 dark:bg-neutral-900/30',
  },
}

const SUGGESTIONS: Record<ErrorType, string> = {
  [ErrorType.NetworkTimeout]: '请检查您的网络连接后重试',
  [ErrorType.NetworkUnreachable]: 'AI 服务暂时不可用，请确认后端服务已启动 (端口 8000)',
  [ErrorType.Unauthorized]: '请重新登录以继续使用',
  [ErrorType.RateLimited]: '请稍等片刻后再发送消息',
  [ErrorType.ServerError]: '我们正在努力修复，请稍后重试',
  [ErrorType.StreamInterrupted]: '网络连接不稳定，是否重新生成响应？',
  [ErrorType.Unknown]: '请稍后重试或联系客服获取帮助',
}

function classifyError(error: Error): ClassifiedError {
  const errorMessage = error.message.toLowerCase()
  const errorName = error.name

  // ── 网络不可达：后端未启动 / 代理连接失败 / fetch 本身失败 ──
  const isNetworkUnreachable =
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('err_aborted') ||
    errorMessage.includes('aborted') ||
    errorMessage.includes('networkerror') ||
    (errorName === 'TypeError' && (errorMessage.includes('fetch') || errorMessage.includes('network')))

  if (isNetworkUnreachable) {
    return {
      type: ErrorType.NetworkUnreachable,
      originalError: error,
      userMessage: '无法连接到 AI 服务，请检查后端服务是否已启动',
      suggestion: SUGGESTIONS[ErrorType.NetworkUnreachable],
      canAutoRecover: true,
      retryAfter: 3000,
    }
  }

  if (errorName === 'TimeoutError' || errorMessage.includes('timeout')) {
    return {
      type: ErrorType.NetworkTimeout,
      originalError: error,
      userMessage: '网络连接超时，正在尝试重新连接...',
      suggestion: SUGGESTIONS[ErrorType.NetworkTimeout],
      canAutoRecover: true,
      retryAfter: 1000,
    }
  }

  if (
    errorMessage.includes('401') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('认证失败')
  ) {
    return {
      type: ErrorType.Unauthorized,
      originalError: error,
      userMessage: '您的登录会话已过期',
      suggestion: SUGGESTIONS[ErrorType.Unauthorized],
      canAutoRecover: false,
    }
  }

  if (errorMessage.includes('429') || errorMessage.includes('请求过于频繁') || errorMessage.includes('rate limit')) {
    const countdownMatch = /剩余\s*(\d+)/.exec(error.message)
    const countdown = countdownMatch ? parseInt(countdownMatch[1]) : 60

    return {
      type: ErrorType.RateLimited,
      originalError: error,
      userMessage: `请求过于频繁，请等待 ${countdown}s`,
      suggestion: SUGGESTIONS[ErrorType.RateLimited],
      canAutoRecover: false,
      countdown,
    }
  }

  if (
    errorMessage.includes('500') ||
    errorMessage.includes('服务器错误') ||
    errorMessage.includes('server error')
  ) {
    return {
      type: ErrorType.ServerError,
      originalError: error,
      userMessage: '服务器暂时无法处理请求',
      suggestion: SUGGESTIONS[ErrorType.ServerError],
      canAutoRecover: true,
      retryAfter: 2000,
    }
  }

  if (
    errorMessage.includes('流式') ||
    errorMessage.includes('stream') ||
    errorMessage.includes('中断')
  ) {
    return {
      type: ErrorType.StreamInterrupted,
      originalError: error,
      userMessage: 'AI 响应在传输过程中被中断',
      suggestion: SUGGESTIONS[ErrorType.StreamInterrupted],
      canAutoRecover: true,
      retryAfter: 500,
    }
  }

  return {
    type: ErrorType.Unknown,
    originalError: error,
    userMessage: '发生了未知错误',
    suggestion: SUGGESTIONS[ErrorType.Unknown],
    canAutoRecover: true,
    retryAfter: 2000,
  }
}

export function ErrorRecoveryDialog({
  error,
  errorType: propErrorType,
  onRetry,
  onDismiss,
  onLogin,
  autoRetryCount = 3,
  showDetails = false,
  className = '',
}: ErrorRecoveryDialogProps) {
  const [retryCount, setRetryCount] = useState(0)
  const [isRetrying, setIsRetrying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [autoRetryExhausted, setAutoRetryExhausted] = useState(false)

  const classifiedError = useMemo(() => {
    if (!error) return null
    const classified = classifyError(error)
    return propErrorType ? { ...classified, type: propErrorType } : classified
  }, [error, propErrorType])

  useEffect(() => {
    if (classifiedError?.type !== ErrorType.RateLimited || !classifiedError.countdown) {
      return
    }

    setCountdown(classifiedError.countdown)
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [classifiedError])

  useEffect(() => {
    if (!classifiedError || !classifiedError.canAutoRecover || !onRetry || autoRetryExhausted) {
      return
    }

    const attemptAutoRetry = async () => {
      for (let i = 0; i < autoRetryCount; i++) {
        if (!classifiedError?.canAutoRecover) break

        await new Promise(resolve => setTimeout(resolve, classifiedError.retryAfter || 1000))

        try {
          setIsRetrying(true)
          setRetryCount(prev => prev + 1)
          logger.info(`[ErrorRecoveryDialog] 自动重试第 ${i + 1}/${autoRetryCount} 次`)
          await onRetry()
          logger.info('[ErrorRecoveryDialog] 自动重试成功')
          return
        } catch (retryError) {
          logger.warn(`[ErrorRecoveryDialog] 自动重试第 ${i + 1} 次失败:`, retryError)
          if (i === autoRetryCount - 1) {
            setAutoRetryExhausted(true)
          }
        } finally {
          setIsRetrying(false)
        }
      }
    }

    attemptAutoRetry()
  }, [classifiedError, onRetry, autoRetryCount, autoRetryExhausted])

  const handleRetry = useCallback(async () => {
    if (!onRetry || isRetrying) return

    try {
      setIsRetrying(true)
      setRetryCount(prev => prev + 1)
      logger.info('[ErrorRecoveryDialog] 用户手动重试')
      await onRetry()
    } catch (retryError) {
      logger.error('[ErrorRecoveryDialog] 手动重试失败:', retryError)
    } finally {
      setIsRetrying(false)
    }
  }, [onRetry, isRetrying])

  const handleLogin = useCallback(() => {
    logger.info('[ErrorRecoveryDialog] 用户点击登录')
    onLogin?.()
  }, [onLogin])

  const handleDismiss = useCallback(() => {
    logger.info('[ErrorRecoveryDialog] 用户关闭错误提示')
    onDismiss?.()
  }, [onDismiss])

  if (!error || !classifiedError) {
    return null
  }

  const config = ERROR_CONFIG[classifiedError.type]
  const IconComponent = config.icon
  const canShowRetry =
    classifiedError.canAutoRecover &&
    (autoRetryExhausted || retryCount >= autoRetryCount)

  return (
    <div className={`error-recovery-dialog rounded-lg border p-6 shadow-lg ${className}`}>
      <div className="flex items-start gap-4">
        <div className={`flex-shrink-0 w-12 h-12 rounded-full ${config.bgClass} flex items-center justify-center`}>
          <IconComponent className={`w-6 h-6 ${config.colorClass}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
              {config.title}
            </h3>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 ml-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-3">
            {classifiedError.userMessage}
          </p>

          <div className="flex items-start gap-2 mb-4 text-sm text-neutral-600 dark:text-neutral-400">
            <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{classifiedError.suggestion}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {classifiedError.type === ErrorType.Unauthorized && onLogin && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleLogin}
                className="inline-flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                重新登录
              </Button>
            )}

            {classifiedError.type === ErrorType.RateLimited && countdown > 0 && (
              <Button variant="outline" size="sm" disabled className="inline-flex items-center gap-2">
                <Timer className="w-4 h-4" />
                等待 {countdown}s
              </Button>
            )}

            {canShowRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? '重试中...' : `重试 (${retryCount}/${autoRetryCount})`}
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="inline-flex items-center gap-2"
            >
              关闭
            </Button>
          </div>

          {showDetails && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-xs font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300 inline-flex items-center gap-1">
                <Bug className="w-3 h-3" />
                技术详情
              </summary>
              <pre className="mt-2 p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg text-xs text-error-600 dark:text-error-400 overflow-auto max-h-40 whitespace-pre-wrap">
                {classifiedError.originalError.message}
                {'\n\n'}
                {classifiedError.originalError.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  )
}

export default ErrorRecoveryDialog
