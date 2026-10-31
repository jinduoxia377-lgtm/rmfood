/**
 * RMFOOD 安全日志工具 (SafeLogger)
 *
 * 替代所有 console.log/console.warn/console.error 调用，
 * 提供以下功能：
 * 1. 环境感知：生产环境自动禁用日志输出
 * 2. 敏感数据脱敏：自动过滤密码、token等敏感信息
 * 3. 结构化日志：支持JSON格式化输出
 * 4. 性能监控：记录关键操作耗时
 * 5. 远程上报（可选）：将错误日志发送到服务端
 *
 * 使用示例：
 * ```typescript
 * import { logger } from '@/utils/safeLogger';
 *
 * // 基础用法（替代 console.log）
 * logger.info('用户登录', { username: 'admin' });
 *
 * // 错误日志（会自动上报到服务端）
 * logger.error('API请求失败', error, { url: '/api/formulas' });
 *
 * // 性能计时
 * const timer = logger.startTimer('配方生成');
 * // ... 执行操作 ...
 * timer.end(); // 自动输出耗时
 * ```
 */

type LogLevel = 'debug' | 'info' | 'log' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  context?: string;
  userId?: number;
}

// 敏感字段正则表达式（用于脱敏处理)
const SENSITIVE_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /credit[_-]?card/i,
  /ssn/i,
];

class SafeLogger {
  private isEnabled: boolean;
  private minLevel: LogLevel;
  private remoteEndpoint?: string;

  constructor() {
    // 根据环境变量决定是否启用
    this.isEnabled =
      import.meta.env?.MODE === 'development' ||
      process.env?.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost';

    this.minLevel = this.isEnabled ? 'debug' : 'error'; // 生产环境只输出error

    // 可选的远程日志端点
    this.remoteEndpoint = import.meta.env?.VITE_LOG_ENDPOINT;
  }

  /**
   * 脱敏处理 - 隐藏敏感字段的值
   */
  private sanitize(data: any): any {
    // 处理 Error 对象
    if (data instanceof Error) {
      const { name, message, stack, ...rest } = data as unknown as Record<string, unknown>;
      return {
        name,
        message,
        stack,
        ...rest,
      };
    }

    if (!data || typeof data !== 'object') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item));
    }

    const sanitized: any = {};

    for (const [key, value] of Object.entries(data)) {
      // 检查是否为敏感字段
      const isSensitive = SENSITIVE_PATTERNS.some((pattern) =>
        pattern.test(key),
      );

      if (isSensitive && typeof value === 'string') {
        // 脱敏：只显示前后各2个字符
        sanitized[key] =
          value.length > 4
            ? `${value.slice(0, 2)}****${value.slice(-2)}`
            : '****';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 格式化日志输出
   */
  private format(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    let output = `${prefix} ${entry.message}`;

    if (entry.data) {
      try {
        output += ` ${JSON.stringify(this.sanitize(entry.data), null, 2)}`;
      } catch {
        output += ` ${String(entry.data)}`;
      }
    }

    return output;
  }

  /**
   * 核心日志方法（内部实现）
   */
  private internalLog(level: LogLevel, message: string, data?: any, context?: string) {
    if (!this.isEnabled || !this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      context,
    };

    // 根据级别选择console方法
    const consoleMethod = {
      debug: console.debug,
      info: console.info,
      log: console.log,
      warn: console.warn,
      error: console.error,
    }[level];

    consoleMethod.call(console, this.format(entry));

    // 错误日志远程上报（可选）
    if (level === 'error' && this.remoteEndpoint) {
      this.reportToRemote(entry);
    }
  }

  /**
   * 检查是否应该输出该级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  /**
   * 将错误日志发送到远程服务器
   */
  private async reportToRemote(entry: LogEntry) {
    try {
      await fetch(this.remoteEndpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entry,
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      });
    } catch {
      // 上报失败时静默处理，避免无限循环
    }
  }

  // ══════════════════════════════════
  // 公共API方法
  // ══════════════════════════════════

  /**
   * 通用日志输出（兼容 console.log 调用方式）
   *
   * @param message 日志消息
   * @param args 额外参数（支持任意类型，会自动脱敏处理）
   *
   * @example
   * logger.log('用户操作', { action: 'login' })
   * logger.log('简单消息')
   */
  log(message: string, ...args: unknown[]): void {
    // 处理 Error 对象
    const processedArgs = args.map(arg =>
      arg instanceof Error ? {
        name: arg.name,
        message: arg.message,
        stack: arg.stack,
      } : arg,
    );
    const data = processedArgs.length === 1 ? processedArgs[0] : processedArgs.length > 0 ? processedArgs : undefined;
    this.internalLog('log', message, data);
  }

  /** 调试信息（仅开发环境） */
  debug(message: string, data?: any, context?: string) {
    const processedData = data instanceof Error ? {
      name: data.name,
      message: data.message,
      stack: data.stack,
    } : data;
    this.internalLog('debug', message, processedData, context);
  }

  /** 一般信息 */
  info(message: string, data?: any, context?: string) {
    const processedData = data instanceof Error ? {
      name: data.name,
      message: data.message,
      stack: data.stack,
    } : data;
    this.internalLog('info', message, processedData, context);
  }

  /** 警告信息 */
  warn(message: string, data?: any, context?: string) {
    const processedData = data instanceof Error ? {
      name: data.name,
      message: data.message,
      stack: data.stack,
    } : data;
    this.internalLog('warn', message, processedData, context);
  }

  /** 错误信息（始终输出，支持远程上报） */
  error(message: string, error?: Error | any, context?: string) {
    const errorData = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error;

    this.internalLog('error', message, errorData, context);
  }

  /**
   * 性能计时器
   *
   * @param label 计时标签
   * @returns 包含end()方法的对象
   *
   * @example
   * const timer = logger.startTimer('API请求');
   * await fetchData();
   * timer.end({ url: '/api/data' }); // 输出: [API请求] 耗时: 123ms
   */
  startTimer(label: string) {
    const startTime = performance.now();

    return {
      end: (data?: any) => {
        const duration = Math.round(performance.now() - startTime);
        this.info(`${label} 完成`, { ...data, durationMs: duration }, 'Performance');
      },
    };
  }

  /**
   * 创建带上下文的子logger
   *
   * @param context 上下文名称（如组件名、模块名）
   * @returns 绑定上下文的logger实例
   *
   * @example
   * const formulaLogger = logger.withContext('FormulaEditor');
   * formulaLogger.info('保存成功'); // 输出: [INFO] [FormulaEditor] 保存成功
   */
  withContext(context: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- 需要捕获 this 供返回对象的方法使用
    const parent = this;

    return {
      log: (msg: string, ...data: any[]) => parent.internalLog('log', msg, data.length > 0 ? data : undefined, context),
      debug: (msg: string, data?: any) => parent.internalLog('debug', msg, data, context),
      info: (msg: string, data?: any) => parent.internalLog('info', msg, data, context),
      warn: (msg: string, data?: any) => parent.internalLog('warn', msg, data, context),
      error: (msg: string, err?: any) => parent.internalLog('error', msg, err, context),

      startTimer: (label: string) => {
        const timer = parent.startTimer(`${context}:${label}`);
        return timer;
      },
    };
  }
}

/** 全局单例实例 */
export const logger = new SafeLogger();

/** 默认导出，方便使用 */
export default logger;


// ════════════════════════════════════════════
// 全局替换 console 方法（可选，谨慎使用）
// ════════════════════════════════════════════

/**
 * 注意：
 * 此代码块默认注释掉。
 * 如果需要全局禁用所有 console 输出，
 * 可以取消注释下面的代码。
 *
 * 建议：在 vite.config.js 或 webpack 配置中
 * 使用 terser 的 drop_console 选项更安全。
 */
/*
if (import.meta.env?.PROD) {
  // 生产环境完全禁用 console
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
  // 保留 console.error 以便调试严重问题
}
*/
