/**
 * 全局 Console 替换模块
 * 在生产环境中安全地使用 Logger
 */

import { logger } from './safeLogger'

// 保留原始 console 引用（用于调试）
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
}

/**
 * 启用安全的全局 console
 * 将所有 console 调用重定向到 logger
 */
export function enableSafeConsole(): void {
  // 包装函数以正确处理参数
  const logWrapper = (...args: unknown[]) => {
    if (args.length > 0) {
      const message = String(args[0])
      const rest = args.slice(1)
      logger.log(message, ...rest)
    }
  }

  const warnWrapper = (...args: unknown[]) => {
    if (args.length > 0) {
      const message = String(args[0])
      const rest = args.slice(1)
      logger.warn(message, ...rest)
    }
  }

  const errorWrapper = (...args: unknown[]) => {
    if (args.length > 0) {
      const message = String(args[0])
      const rest = args.slice(1)
      logger.error(message, ...rest)
    }
  }

  const infoWrapper = (...args: unknown[]) => {
    if (args.length > 0) {
      const message = String(args[0])
      const rest = args.slice(1)
      logger.info(message, ...rest)
    }
  }

  const debugWrapper = (...args: unknown[]) => {
    if (args.length > 0) {
      const message = String(args[0])
      const rest = args.slice(1)
      logger.debug(message, ...rest)
    }
  }

  console.log = logWrapper as typeof console.log
  console.warn = warnWrapper as typeof console.warn
  console.error = errorWrapper as typeof console.error
  console.info = infoWrapper as typeof console.info
  console.debug = debugWrapper as typeof console.debug
}

/**
 * 恢复原始 console
 */
export function restoreConsole(): void {
  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error
  console.info = originalConsole.info
  console.debug = originalConsole.debug
}

/**
 * 获取原始 console（用于需要绕过 logger 的场景）
 */
export function getOriginalConsole() {
  return { ...originalConsole }
}
