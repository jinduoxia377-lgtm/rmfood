/**
 * 统一错误处理系统
 * 基于错误码集中管理，支持国际化
 */

import {
  ERROR_CODES,
  getErrorInfo,
  getUserMessage,
  isRetryable,
  getErrorLevel,
  getErrorCategory,
  ErrorCategory,
  ErrorLevel,
} from '@/constants/errorCodes'
import { zhCNErrors } from '@/constants'

export interface AppErrorOptions {
  code?: string
  message?: string
  details?: Record<string, unknown>
  originalError?: unknown
  context?: Record<string, unknown>
}

export class AppError extends Error {
  public readonly code: string
  public readonly details?: Record<string, unknown>
  public readonly originalError?: unknown
  public readonly context?: Record<string, unknown>
  public readonly retryable: boolean
  public readonly category: ErrorCategory
  public readonly level: ErrorLevel
  public readonly userMessage: string
  public readonly timestamp: number

  constructor(options: AppErrorOptions = {}) {
    const code = options.code ?? ERROR_CODES.COMMON_UNKNOWN
    const errorInfo = getErrorInfo(code)

    const message = options.message || errorInfo?.message || zhCNErrors.errors.COMMON_UNKNOWN
    super(message)

    this.name = 'AppError'
    this.code = code
    this.message = message
    this.details = options.details
    this.originalError = options.originalError
    this.context = options.context
    this.retryable = isRetryable(code)
    this.category = getErrorCategory(code)
    this.level = getErrorLevel(code)
    this.userMessage = getUserMessage(code)
    this.timestamp = Date.now()

    if (typeof (Error as any).captureStackTrace === 'function') {
      (Error as any).captureStackTrace(this, AppError)
    }
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      category: this.category,
      level: this.level,
      retryable: this.retryable,
      details: this.details,
      context: this.context,
      timestamp: this.timestamp,
    }
  }

  override toString(): string {
    return `[${this.code}] ${this.message}`
  }

  public withContext(context: Record<string, unknown>): AppError {
    return new AppError({
      code: this.code,
      message: this.message,
      details: this.details,
      originalError: this.originalError,
      context: { ...this.context, ...context },
    })
  }
}

export function createError(code: string, options?: Omit<AppErrorOptions, 'code'>): AppError {
  return new AppError({ code, ...options })
}

export function parseError(error: unknown, defaultCode: string = ERROR_CODES.COMMON_UNKNOWN): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    const errorMsg = error.message.toLowerCase()

    if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('连接')) {
      return new AppError({
        code: ERROR_CODES.COMMON_NETWORK_ERROR,
        message: error.message,
        originalError: error,
      })
    }

    if (errorMsg.includes('timeout') || errorMsg.includes('超时')) {
      return new AppError({
        code: ERROR_CODES.COMMON_TIMEOUT,
        message: error.message,
        originalError: error,
      })
    }

    if (errorMsg.includes('401') || errorMsg.includes('unauthorized') || errorMsg.includes('认证') || errorMsg.includes('登录')) {
      return new AppError({
        code: ERROR_CODES.AUTH_TOKEN_INVALID,
        message: error.message,
        originalError: error,
      })
    }

    if (errorMsg.includes('403') || errorMsg.includes('forbidden') || errorMsg.includes('权限')) {
      return new AppError({
        code: ERROR_CODES.AUTH_PERMISSION_DENIED,
        message: error.message,
        originalError: error,
      })
    }

    if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('不存在')) {
      return new AppError({
        code: ERROR_CODES.COMMON_NOT_FOUND,
        message: error.message,
        originalError: error,
      })
    }

    if (errorMsg.includes('400') || errorMsg.includes('validation') || errorMsg.includes('验证')) {
      return new AppError({
        code: ERROR_CODES.COMMON_VALIDATION_FAILED,
        message: error.message,
        originalError: error,
      })
    }

    if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('频繁')) {
      return new AppError({
        code: ERROR_CODES.COMMON_RATE_LIMITED,
        message: error.message,
        originalError: error,
      })
    }

    if (errorMsg.includes('500') || errorMsg.includes('server') || errorMsg.includes('服务器')) {
      return new AppError({
        code: ERROR_CODES.API_SERVER_ERROR,
        message: error.message,
        originalError: error,
      })
    }

    if (errorMsg.includes('502') || errorMsg.includes('503') || errorMsg.includes('504') || errorMsg.includes('网关')) {
      return new AppError({
        code: ERROR_CODES.API_GATEWAY_ERROR,
        message: error.message,
        originalError: error,
      })
    }

    if (errorMsg.includes('ai') || errorMsg.includes('openai') || errorMsg.includes('模型')) {
      return new AppError({
        code: ERROR_CODES.AI_SERVICE_ERROR,
        message: error.message,
        originalError: error,
      })
    }

    return new AppError({
      code: defaultCode,
      message: error.message,
      originalError: error,
    })
  }

  if (typeof error === 'string') {
    return new AppError({
      code: defaultCode,
      message: error,
    })
  }

  return new AppError({
    code: defaultCode,
    message: '发生未知错误',
    originalError: error,
  })
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.retryable
  }
  return true
}

export const ErrorFactory = {
  network: (message?: string, details?: Record<string, unknown>) =>
    createError(ERROR_CODES.COMMON_NETWORK_ERROR, { message, details }),

  timeout: (message?: string, details?: Record<string, unknown>) =>
    createError(ERROR_CODES.COMMON_TIMEOUT, { message, details }),

  notFound: (message?: string, details?: Record<string, unknown>) =>
    createError(ERROR_CODES.COMMON_NOT_FOUND, { message, details }),

  validation: (message?: string, details?: Record<string, unknown>) =>
    createError(ERROR_CODES.COMMON_VALIDATION_FAILED, { message, details }),

  unauthorized: (message?: string, details?: Record<string, unknown>) =>
    createError(ERROR_CODES.AUTH_TOKEN_INVALID, { message, details }),

  forbidden: (message?: string, details?: Record<string, unknown>) =>
    createError(ERROR_CODES.AUTH_PERMISSION_DENIED, { message, details }),

  serverError: (message?: string, details?: Record<string, unknown>) =>
    createError(ERROR_CODES.API_SERVER_ERROR, { message, details }),

  rateLimited: (message?: string, details?: Record<string, unknown>) =>
    createError(ERROR_CODES.COMMON_RATE_LIMITED, { message, details }),

  formula: {
    notFound: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.BUSINESS_FORMULA_NOT_FOUND, { message, details }),

    saveFailed: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.BUSINESS_FORMULA_SAVE_FAILED, { message, details }),

    deleteFailed: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.BUSINESS_FORMULA_DELETE_FAILED, { message, details }),

    invalid: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.BUSINESS_FORMULA_INVALID, { message, details }),
  },

  ai: {
    serviceError: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_SERVICE_ERROR, { message, details }),

    unavailable: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_SERVICE_UNAVAILABLE, { message, details }),

    timeout: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_SERVICE_TIMEOUT, { message, details }),

    apiKeyInvalid: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_API_KEY_INVALID, { message, details }),

    apiKeyMissing: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_API_KEY_MISSING, { message, details }),

    responseEmpty: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_RESPONSE_EMPTY, { message, details }),

    generationFailed: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_GENERATION_FAILED, { message, details }),

    analysisFailed: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_ANALYSIS_FAILED, { message, details }),

    safetyCheckFailed: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_SAFETY_CHECK_FAILED, { message, details }),

    synergyError: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_SYNERGY_ERROR, { message, details }),

    peptideDesignError: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_PEPTIDE_DESIGN_ERROR, { message, details }),

    optimizationError: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_OPTIMIZATION_ERROR, { message, details }),

    predictionError: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AI_PREDICTION_ERROR, { message, details }),
  },

  auth: {
    tokenExpired: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AUTH_TOKEN_EXPIRED, { message, details }),

    tokenInvalid: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AUTH_TOKEN_INVALID, { message, details }),

    refreshFailed: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AUTH_REFRESH_FAILED, { message, details }),

    loginFailed: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AUTH_LOGIN_FAILED, { message, details }),

    permissionDenied: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.AUTH_PERMISSION_DENIED, { message, details }),
  },

  export: {
    failed: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.BUSINESS_EXPORT_FAILED, { message, details }),
  },

  import: {
    failed: (message?: string, details?: Record<string, unknown>) =>
      createError(ERROR_CODES.BUSINESS_IMPORT_FAILED, { message, details }),
  },
}

export class ErrorHandler {
  private static instance: ErrorHandler
  private errorListeners: ((error: AppError) => void)[] = []

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  public handle(error: unknown, context?: Record<string, unknown>): AppError {
    const appError = parseError(error).withContext(context || {})

    this.errorListeners.forEach(listener => {
      try {
        listener(appError)
      } catch {
        // ignore
      }
    })

    return appError
  }

  public addListener(listener: (error: AppError) => void): () => void {
    this.errorListeners.push(listener)
    return () => {
      this.errorListeners = this.errorListeners.filter(l => l !== listener)
    }
  }

  public removeListener(listener: (error: AppError) => void): void {
    this.errorListeners = this.errorListeners.filter(l => l !== listener)
  }
}

export const unifiedErrorHandler = ErrorHandler.getInstance()

export default {
  AppError,
  createError,
  parseError,
  isAppError,
  isRetryableError,
  ErrorFactory,
  ErrorHandler,
  unifiedErrorHandler,
}
