import { useCallback, useState, useRef, useLayoutEffect } from 'react'
import { useToast } from '@/components/ui'
import { getErrorInfo, getUserMessage, getSolution, isRetryable, ERROR_CODES } from '@/constants/errorCodes'
import type { ErrorCodeInfo } from '@/constants/errorCodes'

export type FeedbackType = 'success' | 'error' | 'warning' | 'info'

export interface FeedbackConfig {
  type: FeedbackType
  title: string
  message?: string
  duration?: number
  code?: string
  solution?: string
  retryable?: boolean
  onRetry?: () => void
}

export interface OperationState {
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  errorCode?: string
  errorInfo?: ErrorCodeInfo
}

export function useOperationFeedback() {
  const toast = useToast()
  const [operationState, setOperationState] = useState<OperationState>({
    isLoading: false,
    isSuccess: false,
    isError: false,
  })
  const timeoutRef = useRef<number | null>(null)

  // 清理定时器
  useLayoutEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const clearState = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setOperationState({
      isLoading: false,
      isSuccess: false,
      isError: false,
      errorCode: undefined,
      errorInfo: undefined,
    })
  }, [])

  const showFeedback = useCallback((config: FeedbackConfig | FeedbackType, title?: string, message?: string, duration?: number) => {
    let finalConfig: FeedbackConfig

    if (typeof config === 'string') {
      finalConfig = {
        type: config,
        title: title || '',
        message,
        duration,
      }
    } else {
      finalConfig = config
    }

    const { type, title: configTitle, message: configMessage, duration: configDuration, code, solution: _solution, retryable } = finalConfig
    const displayDuration = configDuration ?? (type === 'error' ? 5000 : 3000)
    const fullMessage = configMessage ? `${configTitle}\n${configMessage}` : configTitle

    // 使用Promise.resolve确保微任务立即执行，确保反馈延迟≤300ms
    Promise.resolve().then(() => {
      toast.addToast({
        type,
        message: fullMessage,
        title: undefined,
        duration: displayDuration,
      })
    })

    // 更新操作状态
    if (type === 'error') {
      const errorInfo = code ? getErrorInfo(code) : undefined
      setOperationState({
        isLoading: false,
        isSuccess: false,
        isError: true,
        errorCode: code,
        errorInfo,
      })
    } else if (type === 'success') {
      setOperationState({
        isLoading: false,
        isSuccess: true,
        isError: false,
      })
      // 3秒后清除成功状态
      timeoutRef.current = window.setTimeout(clearState, 3000)
    }

    return {
      dismiss: () => {
        // Toast组件内部已有dismiss逻辑
      },
      retryable: retryable ?? (code ? isRetryable(code) : false),
    }
  }, [toast, clearState])

  const showSuccess = useCallback((title: string, message?: string, duration?: number) => {
    return showFeedback({
      type: 'success',
      title,
      message,
      duration: duration ?? 3000,
    })
  }, [showFeedback])

  const showError = useCallback((title: string, message?: string, duration?: number) => {
    return showFeedback({
      type: 'error',
      title,
      message,
      duration: duration ?? 5000,
    })
  }, [showFeedback])

  const showErrorWithCode = useCallback((errorCode: string, customMessage?: string) => {
    const errorInfo = getErrorInfo(errorCode)
    const userMessage = customMessage || getUserMessage(errorCode)
    const solution = getSolution(errorCode)

    return showFeedback({
      type: 'error',
      title: userMessage,
      message: solution || undefined,
      duration: 5000,
      code: errorCode,
      solution,
      retryable: errorInfo?.retryable ?? true,
    })
  }, [showFeedback])

  const showWarning = useCallback((title: string, message?: string, duration?: number) => {
    return showFeedback({
      type: 'warning',
      title,
      message,
      duration: duration ?? 4000,
    })
  }, [showFeedback])

  const showInfo = useCallback((title: string, message?: string, duration?: number) => {
    return showFeedback({
      type: 'info',
      title,
      message,
      duration: duration ?? 3000,
    })
  }, [showFeedback])

  const startOperation = useCallback(() => {
    clearState()
    setOperationState((prev) => ({ ...prev, isLoading: true }))
  }, [clearState])

  const completeOperation = useCallback((success: boolean, errorCode?: string) => {
    if (success) {
      setOperationState({
        isLoading: false,
        isSuccess: true,
        isError: false,
      })
      timeoutRef.current = window.setTimeout(clearState, 3000)
    } else {
      const errorInfo = errorCode ? getErrorInfo(errorCode) : undefined
      setOperationState({
        isLoading: false,
        isSuccess: false,
        isError: true,
        errorCode,
        errorInfo,
      })
    }
  }, [clearState])

  return {
    showFeedback,
    showSuccess,
    showError,
    showErrorWithCode,
    showWarning,
    showInfo,
    startOperation,
    completeOperation,
    operationState,
    clearState,
    ERROR_CODES,
  }
}

// 批量操作反馈hook
export function useBatchOperationFeedback() {
  const [batchState, setBatchState] = useState<{
    total: number
    completed: number
    success: number
    failed: number
    isRunning: boolean
  }>({
    total: 0,
    completed: 0,
    success: 0,
    failed: 0,
    isRunning: false,
  })

  const startBatch = useCallback((total: number) => {
    setBatchState({
      total,
      completed: 0,
      success: 0,
      failed: 0,
      isRunning: true,
    })
  }, [])

  const updateBatch = useCallback((success: boolean) => {
    setBatchState((prev) => ({
      ...prev,
      completed: prev.completed + 1,
      success: success ? prev.success + 1 : prev.success,
      failed: success ? prev.failed : prev.failed + 1,
      isRunning: prev.completed + 1 < prev.total,
    }))
  }, [])

  const completeBatch = useCallback(() => {
    setBatchState((prev) => ({
      ...prev,
      isRunning: false,
    }))
  }, [])

  const resetBatch = useCallback(() => {
    setBatchState({
      total: 0,
      completed: 0,
      success: 0,
      failed: 0,
      isRunning: false,
    })
  }, [])

  const progress = batchState.total > 0 ? (batchState.completed / batchState.total) * 100 : 0

  return {
    batchState,
    startBatch,
    updateBatch,
    completeBatch,
    resetBatch,
    progress,
  }
}
