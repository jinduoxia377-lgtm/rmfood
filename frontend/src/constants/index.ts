/**
 * 错误码快速访问索引
 * 提供常用错误码的快速引用
 */

export {
  ERROR_CODES,
  ERROR_CODE_MAP,
  ErrorCategory,
  ErrorLevel,
  getErrorInfo,
  getErrorMessage,
  getUserMessage,
  isRetryable,
  getErrorLevel,
  getErrorCategory,
  createErrorCodeRange,
} from './errorCodes'

export {
  AppError,
  createError,
  parseError,
  isAppError,
  isRetryableError,
  ErrorFactory,
  ErrorHandler,
  unifiedErrorHandler,
} from '../utils/errorHandler'

export { default as zhCNErrors } from '../i18n/zh-CN-error'
export { default as enUSErrors } from '../i18n/en-US-error'

export const QUICK_ERRORS = {
  NETWORK: 1002,
  TIMEOUT: 1003,
  NOT_FOUND: 1004,
  UNAUTHORIZED: 3001,
  FORBIDDEN: 3006,
  AI_SERVICE_ERROR: 5000,
  AI_API_KEY_INVALID: 5006,
  AI_RESPONSE_EMPTY: 5011,
  AI_GENERATION_FAILED: 5013,
  EXPORT_FAILED: 4010,
  FORMULA_NOT_FOUND: 4000,
} as const
