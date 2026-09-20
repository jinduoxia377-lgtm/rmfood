/**
 * 错误分类器 - 策略模式重构 (ADR-029 P2-2)
 *
 * 将散落在 chatService.ts 中的 136 行错误分类逻辑提取为独立模块，
 * 使用策略模式实现，提高可测试性和可维护性。
 *
 * @version 1.0.0
 * @created 2026-09-21
 */

export enum ErrorType {
  NetworkUnreachable = 'network_unreachable',
  NetworkTimeout = 'network_timeout',
  Unauthorized = 'unauthorized',
  RateLimited = 'rate_limited',
  ServerError = 'server_error',
  Forbidden = 'forbidden',
  StreamInterrupted = 'stream_interrupted',
  Unknown = 'unknown',
}

export interface ClassifiedError {
  type: ErrorType
  message: string
  original_error?: Error
  recoverable: boolean
  user_message: string
  suggestion: string
  can_auto_recover: boolean
  retry_after?: number
  countdown?: number
}

interface ErrorHandler {
  canHandle(error: Error): boolean
  classify(error: Error): ClassifiedError
}

abstract class BaseErrorHandler implements ErrorHandler {
  abstract canHandle(error: Error): boolean
  abstract classify(error: Error): ClassifiedError
}

class NetworkErrorHandler extends BaseErrorHandler {
  private readonly patterns = ['failed to fetch', 'err_aborted', 'aborted', 'networkerror', '无法连接', '网络不可达']

  canHandle(error: Error): boolean {
    const msg = error.message.toLowerCase()
    return this.patterns.some(p => msg.includes(p)) || (error.name === 'TypeError' && /fetch|network/i.test(msg))
  }

  classify(error: Error): ClassifiedError {
    return {
      type: ErrorType.NetworkUnreachable,
      message: error.message,
      original_error: error,
      recoverable: true,
      user_message: '无法连接到 AI 服务，请检查后端服务是否已启动',
      suggestion: '确认后端服务运行在 localhost:8000，或检查 Vite 代理配置',
      can_auto_recover: true,
      retry_after: 3000,
    }
  }
}

class TimeoutErrorHandler extends BaseErrorHandler {
  canHandle(error: Error): boolean {
    return error.name === 'TimeoutError' || error.message.toLowerCase().includes('timeout')
  }

  classify(error: Error): ClassifiedError {
    return {
      type: ErrorType.NetworkTimeout,
      message: error.message,
      original_error: error,
      recoverable: true,
      user_message: '网络连接超时，正在尝试重新连接...',
      suggestion: '请检查您的网络连接后重试',
      can_auto_recover: true,
      retry_after: 1000,
    }
  }
}

class AuthErrorHandler extends BaseErrorHandler {
  private readonly patterns = ['401', 'unauthorized', '认证失败', 'api_key_invalid', 'api key 无效', 'ai服务配置错误']

  canHandle(error: Error): boolean {
    return this.patterns.some(p => error.message.toLowerCase().includes(p))
  }

  classify(error: Error): ClassifiedError {
    const isApiKeyError = /api[_\s]?key|ai服务配置/i.test(error.message)
    return {
      type: ErrorType.Unauthorized,
      message: error.message,
      original_error: error,
      recoverable: false,
      user_message: isApiKeyError ? 'AI 服务未正确配置：API Key 无效或已过期' : '您的登录会话已过期',
      suggestion: isApiKeyError ? '请在系统设置中重新配置有效的 API Key' : '请重新登录以继续使用',
      can_auto_recover: false,
    }
  }
}

class RateLimitErrorHandler extends BaseErrorHandler {
  canHandle(error: Error): boolean {
    return /429|请求过于频繁|rate_limit/i.test(error.message)
  }

  classify(error: Error): ClassifiedError {
    const match = /剩余\s*(\d+)/.exec(error.message)
    const countdown = match ? parseInt(match[1] ?? '') : 60
    return {
      type: ErrorType.RateLimited,
      message: error.message,
      original_error: error,
      recoverable: true,
      user_message: `请求过于频繁，请等待 ${countdown}s`,
      suggestion: '请稍等片刻后再发送消息',
      can_auto_recover: false,
      countdown,
    }
  }
}

class ServerErrorHandler extends BaseErrorHandler {
  canHandle(error: Error): boolean {
    return /500|服务器错误|server error|ai_service_error/i.test(error.message)
  }

  classify(error: Error): ClassifiedError {
    return {
      type: ErrorType.ServerError,
      message: error.message,
      original_error: error,
      recoverable: true,
      user_message: '服务器暂时无法处理请求',
      suggestion: '我们正在努力修复，请稍后重试',
      can_auto_recover: true,
      retry_after: 2000,
    }
  }
}

class ForbiddenErrorHandler extends BaseErrorHandler {
  canHandle(error: Error): boolean {
    return /403|forbidden|权限/i.test(error.message)
  }

  classify(error: Error): ClassifiedError {
    return {
      type: ErrorType.Forbidden,
      message: error.message,
      original_error: error,
      recoverable: false,
      user_message: '权限不足，请重新登录后重试',
      suggestion: '您的登录会话已失效或权限不足，请重新登录',
      can_auto_recover: false,
    }
  }
}

class StreamErrorHandler extends BaseErrorHandler {
  canHandle(error: Error): boolean {
    return /流式|stream|中断/i.test(error.message)
  }

  classify(error: Error): ClassifiedError {
    return {
      type: ErrorType.StreamInterrupted,
      message: error.message,
      original_error: error,
      recoverable: true,
      user_message: 'AI 响应在传输过程中被中断',
      suggestion: '网络连接不稳定，是否重新生成响应？',
      can_auto_recover: true,
      retry_after: 500,
    }
  }
}

class DefaultErrorHandler extends BaseErrorHandler {
  canHandle(): boolean {
    return true
  }

  classify(error: Error): ClassifiedError {
    return {
      type: ErrorType.Unknown,
      message: error.message,
      original_error: error,
      recoverable: true,
      user_message: '发生了未知错误',
      suggestion: '请稍后重试或联系客服获取帮助',
      can_auto_recover: true,
      retry_after: 2000,
    }
  }
}

const ERROR_HANDLERS: Array<new () => BaseErrorHandler> = [
  NetworkErrorHandler,
  TimeoutErrorHandler,
  AuthErrorHandler,
  RateLimitErrorHandler,
  ServerErrorHandler,
  ForbiddenErrorHandler,
  StreamErrorHandler,
  DefaultErrorHandler,
]

export function classifyError(error: Error): ClassifiedError {
  for (const HandlerClass of ERROR_HANDLERS) {
    const handler = new HandlerClass()
    if (handler.canHandle(error)) {
      return handler.classify(error)
    }
  }
  return new DefaultErrorHandler().classify(error)
}

export function getErrorType(error: Error): ErrorType {
  return classifyError(error).type
}
