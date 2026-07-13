import { logger as safeLogger } from '@/utils/safeLogger'

/**
 * 日志监控配置
 * 用于追踪和分析应用程序的日志
 *
 * 重构说明：
 * - 此模块现在作为 safeLogger 的包装器和配置层
 * - 提供类型定义、常量和高级日志功能
 * - 核心日志功能委托给 safeLogger 处理
 */

export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
} as const

export type LogLevel = typeof LOG_LEVELS[keyof typeof LOG_LEVELS]

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  stack?: string
}

export interface LogConfig {
  enableConsole: boolean
  enableRemote: boolean
  minLevel: LogLevel
  remoteUrl?: string
}

const defaultConfig: LogConfig = {
  enableConsole: true,
  enableRemote: false,
  minLevel: 'info',
  remoteUrl: undefined,
}

let config: LogConfig = { ...defaultConfig }

export function initLogger(userConfig: Partial<LogConfig>): void {
  config = { ...defaultConfig, ...userConfig }
}

/**
 * 核心日志方法 - 委托给 safeLogger
 * 同时支持远程上报功能（如果已配置）
 */
export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  }

  // 委托给 safeLogger 进行实际输出
  switch (level) {
    case 'error':
      safeLogger.error(message, context)
      break
    case 'warn':
      safeLogger.warn(message, context)
      break
    case 'info':
      safeLogger.info(message, context)
      break
    case 'debug':
      safeLogger.debug(message, context)
      break
  }

  // 远程上报功能（保留原有逻辑）
  if (config.enableRemote && config.remoteUrl && shouldSendToRemote(level)) {
    sendToRemote(entry)
  }
}

function shouldSendToRemote(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
  const configLevel = levels.indexOf(config.minLevel)
  const currentLevel = levels.indexOf(level)
  return currentLevel >= configLevel
}

async function sendToRemote(entry: LogEntry): Promise<void> {
  try {
    await fetch(config.remoteUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(entry),
    })
  } catch {
    safeLogger.error('Failed to send log to remote server')
  }
}

/**
 * Logger 实例 - safeLogger 的包装器
 * 提供统一的接口，内部委托给 safeLogger
 */
export const logger = {
  error: (message: string, context?: Record<string, unknown>) => safeLogger.error(message, context),
  warn: (message: string, context?: Record<string, unknown>) => safeLogger.warn(message, context),
  info: (message: string, context?: Record<string, unknown>) => safeLogger.info(message, context),
  debug: (message: string, context?: Record<string, unknown>) => safeLogger.debug(message, context),
}

export function setupGlobalErrorHandler(): void {
  window.onerror = (message, source, lineno, colno, error) => {
    // ── 静默过滤请求被中止的错误（检查 message 和 error 对象）──
    const msg = String(message || '') + ' ' + String(error?.message || (error as Error & { code?: string })?.code || '')
    if (msg.match(/ERR_ABORTED|canceled|Request aborted|aborted/i)) {
      return false
    }

    logger.error(`Global error: ${message}`, {
      source,
      lineno,
      colno,
      stack: error?.stack,
    })
    return false
  }

  window.onunhandledrejection = (event) => {
    // ── 静默过滤请求被中止的 rejection（检查 reason 的 message/code）──
    const reason = String(event.reason?.message || event.reason?.code || event.reason || '')
    if (reason.match(/ERR_ABORTED|canceled|aborted/i)) {
      return
    }

    logger.error('Unhandled promise rejection', {
      reason: event.reason,
    })
  }
}

export function logPageView(pageName: string): void {
  logger.info(`Page view: ${pageName}`, {
    url: window.location.href,
    referrer: document.referrer,
  })
}

export function logUserAction(action: string, details?: Record<string, unknown>): void {
  logger.info(`User action: ${action}`, details)
}

export function logPerformanceMetric(name: string, value: number, unit?: string): void {
  logger.info(`Performance metric: ${name}`, {
    value,
    unit,
  })
}
