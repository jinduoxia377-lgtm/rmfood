/**
 * ⚠️ **DEPRECATED** - 此文件已废弃，请使用 @/utils/safeLogger 代替
 *
 * @deprecated Since 2026-05-09 - Logger 系统统一重构
 * @see {@link file:///./safeLogger.ts} - 新的统一日志实现
 *
 * 迁移指南：
 * 1. 将 `import { logger } from '@/utils/logger'` 改为 `import { logger } from '@/utils/safeLogger'`
 * 2. 所有方法签名保持兼容（log/info/warn/error/debug）
 * 3. 详细文档请查看: /docs/logger-guide.md
 *
 * 废弃原因：
 * - 项目中存在多个 Logger 实现导致接口冲突
 * - 已统一为 SafeLogger 作为唯一权威实现
 * - 此文件保留仅用于向后兼容，新代码禁止使用
 */

/**
 * RMFOOD 统一日志工具 (Unified Logger) [DEPRECATED]
 *
 * ⚠️ **警告**: 此实现已废弃，新代码请使用 `/utils/safeLogger`
 *
 * 功能特性：
 * 1. 环境感知：开发环境显示所有日志，生产环境只显示错误和警告
 * 2. 日志存储：内存中保留最近100条日志，支持导出
 * 3. 结构化输出：统一的格式 [timestamp] [LEVEL] message
 * 4. 性能监控：支持计时功能 (time/timeEnd)
 * 5. 分组支持：支持 console.group/groupEnd
 *
 * 使用示例：
 * ```typescript
 * import logger from '@/utils/logger';
 *
 * logger.info('用户登录', { username: 'admin' });
 * logger.error('API请求失败', error);
 * logger.debug('调试信息', { step: 1 });
 *
 * // 计时
 * logger.time('API请求');
 * // ... 操作 ...
 * logger.timeEnd('API请求'); // 输出耗时
 * ```
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  data?: unknown
  timestamp: string
}

const isDevelopment = import.meta.env?.MODE === 'development' ||
                       (typeof import.meta !== 'undefined' && import.meta.env?.DEV === true) ||
                       window.location.hostname === 'localhost'

class Logger {
  private logs: LogEntry[] = []
  private maxLogs = 100
  private isRecursiveCall = false  // 防止递归调用的标志

  private shouldLog(level: LogLevel): boolean {
    if (isDevelopment) return true

    switch (level) {
      case 'error':
      case 'warn':
        return true
      default:
        return false
    }
  }

  /**
   * 格式化日志消息
   * 使用原生字符串拼接，避免复杂的对象操作导致异常
   */
  private formatMessage(level: LogLevel, message: string): string {
    try {
      const timestamp = new Date().toISOString()
      return '[' + timestamp + '] [' + level.toUpperCase() + '] ' + message
    } catch (e) {
      // 降级处理：如果格式化失败，返回简单格式
      return '[LOGGER] [' + level.toUpperCase() + '] ' + String(message)
    }
  }

  /**
   * 安全的日志输出方法
   * 直接使用原生console，防止任何形式的递归
   */
  private safeConsoleLog(level: LogLevel, formattedMessage: string, ...data: unknown[]): void {
    // 防止递归调用
    if (this.isRecursiveCall) {
      return
    }

    try {
      this.isRecursiveCall = true

      switch (level) {
        case 'log':
          if (data && data.length > 0) {
            console.log(formattedMessage, ...data)
          } else {
            console.log(formattedMessage)
          }
          break
        case 'info':
          if (data && data.length > 0) {
            console.info(formattedMessage, ...data)
          } else {
            console.info(formattedMessage)
          }
          break
        case 'warn':
          if (data && data.length > 0) {
            console.warn(formattedMessage, ...data)
          } else {
            console.warn(formattedMessage)
          }
          break
        case 'error':
          if (data && data.length > 0) {
            console.error(formattedMessage, ...data)
          } else {
            console.error(formattedMessage)
          }
          break
        case 'debug':
          if (data && data.length > 0) {
            console.debug(formattedMessage, ...data)
          } else {
            console.debug(formattedMessage)
          }
          break
        default:
          console.log(formattedMessage, ...data)
      }
    } catch (e) {
      // 最终降级：如果所有方法都失败，使用最基本的输出
      try {
        console.log('[FALLBACK] ' + formattedMessage)
      } catch (finalError) {
        // 完全无法输出，静默处理
      }
    } finally {
      this.isRecursiveCall = false
    }
  }

  log(message: string, ...data: unknown[]): void {
    const formatted = this.formatMessage('log', message)
    this.safeConsoleLog('log', formatted, ...data)
    const logData = data.length === 1 ? data[0] : data.length > 0 ? data : undefined
    this.storeLog('log', message, logData)
  }

  info(message: string, ...data: unknown[]): void {
    if (this.shouldLog('info')) {
      const formatted = this.formatMessage('info', message)
      this.safeConsoleLog('info', formatted, ...data)
    }
    this.storeLog('info', message, data)
  }

  warn(message: string, ...data: unknown[]): void {
    if (this.shouldLog('warn')) {
      const formatted = this.formatMessage('warn', message)
      this.safeConsoleLog('warn', formatted, ...data)
    }
    this.storeLog('warn', message, data)
  }

  error(message: string, ...data: unknown[]): void {
    if (this.shouldLog('error')) {
      const formatted = this.formatMessage('error', message)
      this.safeConsoleLog('error', formatted, ...data)
    }
    this.storeLog('error', message, data)
  }

  debug(message: string, ...data: unknown[]): void {
    if (isDevelopment && this.shouldLog('debug')) {
      const formatted = this.formatMessage('debug', message)
      this.safeConsoleLog('debug', formatted, ...data)
    }
    this.storeLog('debug', message, data)
  }

  group(label: string): void {
    if (isDevelopment) {
      try {
        console.group(label)
      } catch (e) {
        // 静默处理
      }
    }
  }

  groupEnd(): void {
    if (isDevelopment) {
      try {
        console.groupEnd()
      } catch (e) {
        // 静默处理
      }
    }
  }

  time(label: string): void {
    if (isDevelopment) {
      try {
        console.time(label)
      } catch (e) {
        // 静默处理
      }
    }
  }

  timeEnd(label: string): void {
    if (isDevelopment) {
      try {
        console.timeEnd(label)
      } catch (e) {
        // 静默处理
      }
    }
  }

  /**
   * 创建性能计时器（推荐使用）
   */
  startTimer(label: string): { end: (data?: Record<string, unknown>) => void } {
    const startTime = performance.now()

    return {
      end: (data?: Record<string, unknown>) => {
        const duration = Math.round(performance.now() - startTime)
        this.info(`${label} 完成`, { ...data, durationMs: duration })
      },
    }
  }

  private storeLog(level: LogLevel, message: string, data?: unknown): void {
    try {
      this.logs.push({
        level,
        message,
        data,
        timestamp: new Date().toISOString(),
      })

      if (this.logs.length > this.maxLogs) {
        this.logs.shift()
      }
    } catch (e) {
      // 存储失败不影响主要功能
    }
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
  }

  exportLogs(): string {
    try {
      return JSON.stringify(this.logs, null, 2)
    } catch (e) {
      return '[]'
    }
  }
}

export const logger = new Logger()
export default logger
