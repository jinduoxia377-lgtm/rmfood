import { logger } from '@/utils/safeLogger';

/**
 * 增强版错误处理与日志记录系统
 * 提供分级错误捕获、详细错误日志、用户友好错误提示
 */

// 错误级别
export enum ErrorLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// 错误类型
export enum ErrorCategory {
  NETWORK = 'network',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  RUNTIME = 'runtime',
  RESOURCE = 'resource',
  EXTERNAL = 'external',
  UNKNOWN = 'unknown',
}

// 错误信息接口
export interface AppError {
  id: string;
  level: ErrorLevel;
  category: ErrorCategory;
  timestamp: number;
  message: string;
  detail?: string;
  stack?: string;
  context?: Record<string, any>;
  recoverable: boolean;
  userFriendlyMessage: string;
}

// 错误记录接口
export interface ErrorRecord {
  timestamp: number;
  type: string;
  message: string;
  detail?: string;
  stack?: string;
  level: string;
  url: string;
  userAgent: string;
  context?: Record<string, any>;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private errorBuffer: ErrorRecord[] = [];
  private readonly MAX_BUFFER_SIZE = 100;
  private onErrorCallbacks: ((error: AppError) => void)[] = [];
  private enableConsoleLogging = true;
  private enableRemoteReporting = false;
  private logLevel: ErrorLevel = ErrorLevel.WARNING;

  private constructor() {
    this.initGlobalErrorHandlers();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // 启用/禁用控制台日志
  public setConsoleLogging(enabled: boolean): void {
    this.enableConsoleLogging = enabled;
  }

  // 设置日志级别
  public setLogLevel(level: ErrorLevel): void {
    this.logLevel = level;
  }

  // 添加错误回调
  public addErrorCallback(callback: (error: AppError) => void): () => void {
    this.onErrorCallbacks.push(callback);
    return () => {
      this.onErrorCallbacks = this.onErrorCallbacks.filter(cb => cb !== callback);
    };
  }

  // 初始化全局错误处理器
  private initGlobalErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      // 全局未捕获异常
      window.addEventListener('error', (event) => {
        this.handleGlobalError(event);
      });

      // Promise未捕获异常
      window.addEventListener('unhandledrejection', (event) => {
        this.handlePromiseRejection(event);
      });
    }
  }

  // 处理全局错误
  private handleGlobalError(event: ErrorEvent): void {
    // ── 静默过滤请求被中止的错误（页面导航/组件卸载等正常场景）──
    // 注意：XHR 中止时 event.message 通常为空字符串，错误信息在 event.error 中
    const errorMsg = String(event.message || '') + ' ' + String(event.error?.message || event.error?.code || '')
    if (errorMsg.match(/ERR_ABORTED|canceled|Request aborted|aborted/i)) {
      return;
    }

    const error: AppError = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      level: ErrorLevel.ERROR,
      category: ErrorCategory.RUNTIME,
      timestamp: Date.now(),
      message: event.message || '未知错误',
      detail: String(event.error),
      stack: event.error?.stack,
      recoverable: false,
      userFriendlyMessage: '系统遇到意外错误，请刷新页面重试。',
    };
    this.processError(error);
  }

  // 处理Promise未捕获异常
  private handlePromiseRejection(event: PromiseRejectionEvent): void {
    // ── 静默过滤请求被中止的 rejection ──
    const reason = String(event.reason?.message || event.reason?.code || event.reason || '')
    if (reason.match(/ERR_ABORTED|canceled|Request aborted|aborted/i)) {
      return;
    }

    const error: AppError = {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      level: ErrorLevel.ERROR,
      category: ErrorCategory.RUNTIME,
      timestamp: Date.now(),
      message: String(event.reason),
      stack: event.reason?.stack,
      recoverable: true,
      userFriendlyMessage: '操作执行失败，请重试。',
    };
    this.processError(error);
  }

  // 处理错误（主方法）
  public handleError(
    error: Error | string,
    options: {
      level?: ErrorLevel;
      category?: ErrorCategory;
      context?: Record<string, any>;
      userFriendlyMessage?: string;
      recoverable?: boolean;
    } = {},
  ): AppError {
    const appError = this.createAppError(error, options);
    this.processError(appError);
    return appError;
  }

  // 创建标准化错误对象
  private createAppError(
    error: Error | string,
    options: {
      level?: ErrorLevel;
      category?: ErrorCategory;
      context?: Record<string, any>;
      userFriendlyMessage?: string;
      recoverable?: boolean;
    } = {},
  ): AppError {
    const {
      level = ErrorLevel.ERROR,
      category = ErrorCategory.UNKNOWN,
      context = {},
      userFriendlyMessage = '发生未知错误',
      recoverable = true,
    } = options;

    let message: string;
    let stack: string | undefined;
    let detail: string | undefined;

    if (typeof error === 'string') {
      message = error;
    } else {
      message = error.message || '未知错误';
      stack = error.stack;
      detail = String(error);
    }

    return {
      id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      level,
      category,
      timestamp: Date.now(),
      message,
      detail,
      stack,
      context,
      recoverable,
      userFriendlyMessage,
    };
  }

  // 处理错误
  private processError(error: AppError): void {
    // 添加到缓冲区
    this.addToBuffer(error);

    // 回调通知
    this.onErrorCallbacks.forEach(callback => {
      try {
        callback(error);
      } catch (err) {
        logger.error('错误回调执行失败:', err);
      }
    });

    // 控制台日志
    if (this.enableConsoleLogging && this.shouldLog(error.level)) {
      this.logToConsole(error);
    }

    // 远程上报（可选）
    if (this.enableRemoteReporting) {
      this.reportError(error);
    }
  }

  // 检查是否应该记录
  private shouldLog(level: ErrorLevel): boolean {
    const levelOrder = [
      ErrorLevel.DEBUG,
      ErrorLevel.INFO,
      ErrorLevel.WARNING,
      ErrorLevel.ERROR,
      ErrorLevel.CRITICAL,
    ];
    const currentIndex = levelOrder.indexOf(this.logLevel);
    const errorIndex = levelOrder.indexOf(level);
    return errorIndex >= currentIndex;
  }

  // 添加到缓冲区
  private addToBuffer(error: AppError): void {
    const record: ErrorRecord = {
      timestamp: error.timestamp,
      type: error.category,
      message: error.message,
      detail: error.detail,
      stack: error.stack,
      level: error.level,
      url: typeof window !== 'undefined' ? window.location.href : 'n/a',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'n/a',
      context: error.context,
    };

    this.errorBuffer.push(record);

    // 限制缓冲区大小
    if (this.errorBuffer.length > this.MAX_BUFFER_SIZE) {
      this.errorBuffer.shift();
    }
  }

  // 控制台日志输出
  private logToConsole(error: AppError): void {
    const { level, message, detail, stack, context } = error;

    const logMethod = {
      [ErrorLevel.DEBUG]: console.debug,
      [ErrorLevel.INFO]: console.info,
      [ErrorLevel.WARNING]: console.warn,
      [ErrorLevel.ERROR]: console.error,
      [ErrorLevel.CRITICAL]: console.error,
    };

    const logger = logMethod[level] || console.error;

    const prefix = `[${error.timestamp}] [${error.level.toUpperCase()}]`;

    logger(`${prefix} ${message}`);
    if (detail && detail !== message) {
      logger(`  详情: ${detail}`);
    }
    if (context && Object.keys(context).length > 0) {
      logger('  上下文:', context);
    }
    if (stack) {
      logger('  堆栈:', stack);
    }
  }

  // 上报错误（可扩展）
  private reportError(error: AppError): void {
    logger.debug('错误上报（功能开发中）:', error);
  }

  // 获取错误历史
  public getErrorHistory(): ErrorRecord[] {
    return [...this.errorBuffer];
  }

  // 清除错误历史
  public clearHistory(): void {
    this.errorBuffer = [];
  }

  // 便利方法 - 快速创建警告
  public warning(
    message: string,
    context?: Record<string, any>,
  ): AppError {
    return this.handleError(message, {
      level: ErrorLevel.WARNING,
      category: ErrorCategory.VALIDATION,
      context,
      userFriendlyMessage: message,
    });
  }

  // 便利方法 - 快速创建错误
  public error(
    message: string,
    options?: {
      category?: ErrorCategory;
      context?: Record<string, any>;
      userFriendlyMessage?: string;
      recoverable?: boolean;
    },
  ): AppError {
    return this.handleError(message, {
      level: ErrorLevel.ERROR,
      ...options,
    });
  }

  // 便利方法 - 网络错误
  public networkError(
    error: Error | string,
    context?: Record<string, any>,
  ): AppError {
    return this.handleError(error, {
      level: ErrorLevel.ERROR,
      category: ErrorCategory.NETWORK,
      context,
      userFriendlyMessage: '网络连接失败，请检查网络设置后重试。',
      recoverable: true,
    });
  }

  // 便利方法 - 验证错误
  public validationError(
    message: string,
    field?: string,
  ): AppError {
    return this.handleError(message, {
      level: ErrorLevel.WARNING,
      category: ErrorCategory.VALIDATION,
      context: { field },
      userFriendlyMessage: message,
    });
  }
}

export const errorHandler = ErrorHandler.getInstance();

export default ErrorHandler;
