/**
 * 统一错误处理系统
 *
 * @description 提供统一的错误类型、处理和显示功能
 * @version 1.0.0
 */

import { logger } from '@/utils/safeLogger'

export type ErrorType =
  | 'network'
  | 'server'
  | 'validation'
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'timeout'
  | 'unknown'

export interface AppErrorOptions {
  type: ErrorType
  message: string
  retryable?: boolean
  details?: Record<string, unknown>
  originalError?: unknown
}

export class AppError extends Error {
  public readonly type: ErrorType
  public readonly retryable: boolean
  public readonly details?: Record<string, unknown>
  public readonly originalError?: unknown

  constructor(options: AppErrorOptions) {
    super(options.message)
    this.name = 'AppError'
    this.type = options.type
    this.retryable = options.retryable ?? false
    this.details = options.details
    this.originalError = options.originalError
    Object.setPrototypeOf(this, AppError.prototype)
  }

  public toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      retryable: this.retryable,
      details: this.details,
    }
  }
}

export const ERROR_MESSAGES: Record<ErrorType, { title: string; description: string; action: string }> = {
  network: {
    title: '网络连接失败',
    description: '请检查您的网络设置',
    action: '检查网络后重试',
  },
  server: {
    title: '服务器错误',
    description: '服务器暂时不可用',
    action: '服务器维护中，请稍后重试',
  },
  validation: {
    title: '输入错误',
    description: '请检查输入的内容',
    action: '修正后重试',
  },
  not_found: {
    title: '资源不存在',
    description: '请求的资源未找到',
    action: '请联系技术支持',
  },
  unauthorized: {
    title: '未授权',
    description: '请先登录',
    action: '登录后重试',
  },
  forbidden: {
    title: '权限不足',
    description: '您没有权限执行此操作',
    action: '联系管理员获取权限',
  },
  timeout: {
    title: '请求超时',
    description: '服务器响应时间过长',
    action: '稍后重试',
  },
  unknown: {
    title: '发生错误',
    description: '发生了未知错误',
    action: '请联系技术支持',
  },
}

export function parseError(error: unknown, defaultMessage?: string): AppError {
  if (error instanceof AppError) {
    return error
  }

  const defaultMsg = defaultMessage || '发生了未知错误'

  if (error instanceof Error) {
    const errorName = error.name.toLowerCase()
    const errorMsg = error.message.toLowerCase()

    if (errorName.includes('network') || errorMsg.includes('network')) {
      return new AppError({
        type: 'network',
        message: error.message || ERROR_MESSAGES.network.description,
        retryable: true,
        originalError: error,
      })
    }

    if (errorMsg.includes('timeout')) {
      return new AppError({
        type: 'timeout',
        message: error.message || ERROR_MESSAGES.timeout.description,
        retryable: true,
        originalError: error,
      })
    }

    if (errorName.includes('notfound') || errorMsg.includes('not found') || errorMsg.includes('404')) {
      return new AppError({
        type: 'not_found',
        message: error.message || ERROR_MESSAGES.not_found.description,
        originalError: error,
      })
    }

    if (errorName.includes('unauthorized') || errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
      return new AppError({
        type: 'unauthorized',
        message: error.message || ERROR_MESSAGES.unauthorized.description,
        originalError: error,
      })
    }

    if (errorName.includes('forbidden') || errorMsg.includes('forbidden') || errorMsg.includes('403')) {
      return new AppError({
        type: 'forbidden',
        message: error.message || ERROR_MESSAGES.forbidden.description,
        originalError: error,
      })
    }

    if (errorMsg.includes('validation') || errorMsg.includes('400')) {
      return new AppError({
        type: 'validation',
        message: error.message || ERROR_MESSAGES.validation.description,
        originalError: error,
      })
    }

    if (errorMsg.includes('server') || errorMsg.includes('500') || errorMsg.includes('502') || errorMsg.includes('503')) {
      return new AppError({
        type: 'server',
        message: error.message || ERROR_MESSAGES.server.description,
        retryable: true,
        originalError: error,
      })
    }

    return new AppError({
      type: 'unknown',
      message: error.message || defaultMsg,
      retryable: true,
      originalError: error,
    })
  }

  return new AppError({
    type: 'unknown',
    message: defaultMsg,
    retryable: true,
    originalError: error,
  })
}

export function getErrorMessage(error: AppError): { title: string; description: string; action: string } {
  const defaultMessage = ERROR_MESSAGES[error.type] || ERROR_MESSAGES.unknown
  return {
    ...defaultMessage,
    description: error.message || defaultMessage.description,
  }
}

export function handleError(error: unknown, context?: string) {
  const appError = parseError(error)

  if (context) {
    logger.error(`[${context}] ${appError.message}`, {
      type: appError.type,
      retryable: appError.retryable,
      details: appError.details,
      originalError: appError.originalError,
    })
  } else {
    logger.error(appError.message, appError.toJSON())
  }

  return appError
}

export function createNetworkError(message?: string, details?: Record<string, unknown>): AppError {
  return new AppError({
    type: 'network',
    message: message || ERROR_MESSAGES.network.description,
    retryable: true,
    details,
  })
}

export function createServerError(message?: string, details?: Record<string, unknown>): AppError {
  return new AppError({
    type: 'server',
    message: message || ERROR_MESSAGES.server.description,
    retryable: true,
    details,
  })
}

export function createValidationError(message?: string, details?: Record<string, unknown>): AppError {
  return new AppError({
    type: 'validation',
    message: message || ERROR_MESSAGES.validation.description,
    retryable: false,
    details,
  })
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
