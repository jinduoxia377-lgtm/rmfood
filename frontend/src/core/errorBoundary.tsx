/**
 * 🟡 P2-3: 错误边界系统（全局错误处理 + React 组件边界）
 *
 * 核心能力:
 * - 组件渲染错误捕获（白屏防护）
 * - Promise rejection 捕获
 * - API 错误智能分类与提示
 * - 状态持久化恢复
 * - 错误上报（可扩展到 Sentry）
 * - 熔断机制（防止同错误刷屏）
 * - 离线错误缓存（网络恢复后自动上报）
 */

import React, { Component, ErrorInfo, ReactNode, useCallback, useEffect, useRef, useState, createContext, useContext } from 'react';
import type {
  CapturedError,
  ErrorHandlerConfig,
  ErrorTrackingContextValue,
  FallbackProps,
  ErrorSeverity,
} from './types';
import {
  generateErrorId,
  getErrorMessage,
  getErrorStack,
  detectErrorType,
  detectSeverity,
  getCurrentPath,
  getSessionId,
  getContextData,
} from './errorUtils';

// ═════════════════════════════════════════════
// 🟡 P2-3: 全局配置管理
// ═════════════════════════════════════════════

const DEFAULT_CONFIG: Required<Omit<ErrorHandlerConfig, 'onError' | 'getUserInfo' | 'filter'>> & ErrorHandlerConfig = {
  onError: undefined,
  logToConsole: true,
  reportToSentry: !!import.meta.env.VITE_SENTRY_DSN,
  maxErrors: 200,
  fuseThreshold: 5,
  filter: undefined,
  getUserInfo: () => ({}),
};

let globalConfig: ErrorHandlerConfig = DEFAULT_CONFIG;

/** 全局错误队列（内存存储 + 定期持久化到 localStorage） */
const errorQueue: CapturedError[] = [];

/** 熔断计数器: { error_signature: count } */
const fuseCounters: Map<string, { count: number; lastTriggered: number }> = new Map();

/** 离线错误缓存的 localStorage key */
const OFFLINE_ERROR_STORAGE_KEY = 'rmfood_offline_errors';

// ═════════════════════════════════════════════
// 🟡 P2-3: 持久化与缓存
// ═════════════════════════════════════════════

function persistErrorsToCache() {
  if (typeof window === 'undefined') return;
  try {
    const maxCached = 50;
    const toCache = errorQueue.slice(-maxCached).filter((e) => !e.reported);
    if (toCache.length > 0) {
      localStorage.setItem(OFFLINE_ERROR_STORAGE_KEY, JSON.stringify(toCache));
    }
  } catch (e) {
    // 忽略 localStorage 失败
  }
}

function loadErrorsFromCache(): CapturedError[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OFFLINE_ERROR_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CapturedError[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clearCachedErrors() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OFFLINE_ERROR_STORAGE_KEY);
  } catch {
    // 忽略
  }
}

// ═════════════════════════════════════════════
// 🟡 P2-3: 熔断机制
// ═════════════════════════════════════════════

function checkFuse(message: string, type: CapturedError['type']): { shouldFuse: boolean } {
  const signature = `${type}_${message.slice(0, 80)}`;
  const now = Date.now();
  const record = fuseCounters.get(signature);

  if (!record) {
    fuseCounters.set(signature, { count: 1, lastTriggered: now });
    return { shouldFuse: false };
  }

  // 60 秒内同一错误触发 N 次 → 熔断
  if (now - record.lastTriggered < 60000) {
    record.count += 1;
    if (record.count >= (globalConfig.fuseThreshold || 5)) {
      record.lastTriggered = now;
      return { shouldFuse: true };
    }
  } else {
    // 超过窗口，重置计数
    record.count = 1;
  }
  record.lastTriggered = now;
  return { shouldFuse: false };
}

// ═════════════════════════════════════════════
// 🟡 P2-3: 核心错误捕获与处理
// ═════════════════════════════════════════════

/** 构建标准化的错误对象 */
export function buildCapturedError(
  error: unknown,
  overrides: Partial<CapturedError> = {},
): CapturedError {
  const message = getErrorMessage(error);
  const statusCode = overrides.statusCode || undefined;

  return {
    id: generateErrorId(),
    type: overrides.type || detectErrorType(error),
    message,
    stack: getErrorStack(error),
    timestamp: new Date().toISOString(),
    severity: overrides.severity || detectSeverity(message, statusCode),
    errorCode: overrides.errorCode,
    statusCode,
    context: getContextData(globalConfig.getUserInfo || (() => ({}))),
    extra: overrides.extra,
    reported: false,
    ...overrides,
  };
}

/** 错误处理核心逻辑 */
export function handleCapturedError(
  error: unknown,
  overrides: Partial<CapturedError> = {},
): CapturedError | null {
  const captured = buildCapturedError(error, overrides);

  // 过滤器检查
  if (globalConfig.filter && !globalConfig.filter(captured)) {
    return null;
  }

  // 熔断检查
  const fuseCheck = checkFuse(captured.message, captured.type);
  if (fuseCheck.shouldFuse) {
    captured.severity = 'warning';
    captured.extra = { ...captured.extra, _fuseTriggered: true };
    return captured; // 记录但不重复上报
  }

  // 加入队列
  const maxErrors = globalConfig.maxErrors || DEFAULT_CONFIG.maxErrors;
  errorQueue.push(captured);
  if (errorQueue.length > maxErrors) {
    errorQueue.splice(0, errorQueue.length - maxErrors);
  }

  // 控制台输出
  if (globalConfig.logToConsole !== false) {
    const logFn =
      captured.severity === 'critical' || captured.severity === 'error'
        ? console.error
        : captured.severity === 'warning'
          ? console.warn
          : console.log;
    logFn(`[ErrorBoundary:${captured.type}] ${captured.message}`);
    if (captured.stack) logFn(captured.stack);
  }

  // 上报钩子
  if (globalConfig.onError) {
    try {
      globalConfig.onError(captured);
      captured.reported = true;
    } catch (reportErr) {
      captured.reported = false;
      persistErrorsToCache();
    }
  }

  // Sentry 上报（如已集成）
  if (globalConfig.reportToSentry) {
    try {
      const win = window as unknown as { Sentry?: { captureException?: (e: unknown, extra?: Record<string, unknown>) => void } };
      if (win.Sentry?.captureException) {
        win.Sentry.captureException(error instanceof Error ? error : new Error(captured.message), {
          extra: { captured },
        });
      }
    } catch {
      // 忽略 Sentry 错误
    }
  }

  return captured;
}

// ═════════════════════════════════════════════
// 🟡 P2-3: 全局事件监听器注册
// ═════════════════════════════════════════

let listenersRegistered = false;

function registerGlobalEventListeners() {
  if (listenersRegistered || typeof window === 'undefined') return;
  listenersRegistered = true;

  // 1. 未捕获的异常
  window.addEventListener('error', (event) => {
    handleCapturedError(event.error || event.message, { type: 'component' });
  });

  // 2. 未处理的 Promise rejection
  window.addEventListener('unhandledrejection', (event) => {
    handleCapturedError(event.reason, { type: 'promise' });
  });

  // 3. 网络状态监听（离线时缓存错误）
  window.addEventListener('offline', () => {
    // 离线标记
    (window as unknown as { _rmfood_offline?: boolean })._rmfood_offline = true;
  });

  window.addEventListener('online', () => {
    (window as unknown as { _rmfood_offline?: boolean })._rmfood_offline = false;
    // 在线时，尝试上报缓存的错误
    const cached = loadErrorsFromCache();
    if (cached.length > 0 && globalConfig.onError) {
      cached.forEach((err) => {
        try {
          globalConfig.onError && globalConfig.onError(err);
        } catch {
          // 忽略
        }
      });
      clearCachedErrors();
    }
  });
}

// ═════════════════════════════════════════════
// 🟡 P2-3: 公共 API
// ═════════════════════════════════════════════

/** 配置全局错误处理 */
export function configureErrorHandler(config: ErrorHandlerConfig): void {
  globalConfig = { ...DEFAULT_CONFIG, ...config };
  registerGlobalEventListeners();
}

/** 主动上报错误（适用于业务代码中捕获的异常） */
export function reportError(
  error: unknown,
  extra: Partial<CapturedError> = {},
): CapturedError | null {
  return handleCapturedError(error, extra);
}

/** 获取最近的错误列表 */
export function getRecentErrors(limit = 20): CapturedError[] {
  return errorQueue.slice(-limit).reverse();
}

/** 清空错误队列 */
export function clearErrorQueue(): void {
  errorQueue.length = 0;
}

/** 错误统计（用于性能监控） */
export function getErrorStats(): {
  total: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  const bySeverity: Record<ErrorSeverity, number> = {
    debug: 0,
    info: 0,
    warning: 0,
    error: 0,
    critical: 0,
  };

  errorQueue.forEach((err) => {
    byType[err.type] = (byType[err.type] || 0) + 1;
    bySeverity[err.severity] = (bySeverity[err.severity] || 0) + 1;
  });

  return { total: errorQueue.length, byType, bySeverity };
}

// ═════════════════════════════════════════════
// 🟡 P2-3: React 错误边界组件
// ═════════════════════════════════════════════

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  capturedError?: CapturedError;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  /** 自定义 Fallback UI */
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  /** 重置回调（通常用于重置状态） */
  onReset?: () => void;
  /** 错误发生回调（用于上报等） */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** 模块名称（用于错误追踪） */
  moduleName?: string;
}

/**
 * 🛡️ React 错误边界组件
 *
 * 捕获子组件树中的渲染期错误，并渲染 fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
    console.error('[ErrorBoundary] Error type:', error.constructor.name);
    console.error('[ErrorBoundary] Error stack:', error.stack);
    if (error.cause) console.error('[ErrorBoundary] Error cause:', error.cause);
    this.setState({ errorInfo: info });

    // 记录到全局错误系统
    const captured = handleCapturedError(error, {
      type: 'component',
      extra: { componentStack: info.componentStack },
    });
    
    // 写入 localStorage 以便调试
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('__rmfood_last_error', JSON.stringify({
          message: error?.message,
          stack: error?.stack,
          componentStack: info?.componentStack,
          time: new Date().toISOString()
        }));
      } catch(e) {}
    }
    
    // 写入 localStorage 以便调试
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('__rmfood_last_error', JSON.stringify({
          message: error?.message,
          stack: error?.stack,
          componentStack: info?.componentStack,
          time: new Date().toISOString()
        }));
      } catch(e) {}
    }

    if (captured) {
      this.setState({ capturedError: captured });
    }

    // 外部回调
    if (this.props.onError) {
      try {
        this.props.onError(error, info);
      } catch {
        // 忽略
      }
    }
  }

  resetErrorBoundary = (): void => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  safeRefresh = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;

      if (typeof fallback === 'function') {
        return fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
          errorDetails:
            this.state.capturedError ||
            buildCapturedError(this.state.error, { type: 'component' }),
          safeRefresh: this.safeRefresh,
        });
      }

      return this.defaultFallback();
    }

    return this.props.children;
  }

  // 将 Fallback UI 提取为类方法，避免在 render 中调用函数组件
  private defaultFallback = (): ReactNode => {
    const error = this.state.error;
    const errorDetails = this.state.capturedError || buildCapturedError(error, { type: 'component' });

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'linear-gradient(135deg, #AF52DE 0%, #7C3AED 100%)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxWidth: '560px',
            width: '100%',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '56px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ margin: '0 0 12px 0', fontSize: '24px', color: '#1D1D1F', fontWeight: 600 }}>
            页面出现问题
          </h1>
          <p style={{ margin: '0 0 24px 0', color: '#6E6E73', fontSize: '14px', lineHeight: 1.6 }}>
            很抱歉，您当前访问的页面出现了问题。我们已记录此错误并会尽快修复。
          </p>
          {error && (<p style={{ margin: '0 0 12px 0', color: '#ef4444', fontSize: '12px', lineHeight: 1.4, wordBreak: 'break-all' }}>{error.message}</p>)}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={this.resetErrorBoundary}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: '#7C3AED',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              重试
            </button>
            <button
              onClick={this.safeRefresh}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      </div>
    );
  };
}

// ═════════════════════════════════════════════
// 🟡 P2-3: 默认 Fallback UI（美观、可操作）
// ═════════════════════════════════════════════

function DefaultFallback({ error, resetErrorBoundary, errorDetails, safeRefresh }: FallbackProps): ReactNode {

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'linear-gradient(135deg, var(--color-tertiary, #AF52DE) 0%, #7C3AED 100%)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif',
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface, #FFFFFF)',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          maxWidth: '560px',
          width: '100%',
          padding: '40px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '56px',
            marginBottom: '16px',
          }}
        >
          ⚠️
        </div>
        <h1
          style={{
            margin: '0 0 12px 0',
            fontSize: '24px',
            color: 'var(--text-primary, #1D1D1F)',
            fontWeight: 600,
          }}
        >
          页面出现问题
        </h1>
        <p
          style={{
            margin: '0 0 24px 0',
            color: 'var(--text-secondary, #6E6E73)',
            fontSize: '14px',
            lineHeight: 1.6,
          }}
        >
          很抱歉，您当前访问的页面出现了问题。我们已记录此错误并会尽快修复。
        </p>

        <div
          style={{
            background: '#fff5f5',
            border: '1px solid #feb2b2',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            fontSize: '13px',
            color: '#c53030',
            textAlign: 'left',
          }}
        >
          <strong>错误信息：</strong>
          <br />
          <span style={{ wordBreak: 'break-all' }}>{error.message || '未知错误'}</span>
          <br />
          <small style={{ color: '#999', marginTop: '8px', display: 'block' }}>
            时间: {new Date().toLocaleString('zh-CN')}
          </small>
          <br />
          <small style={{ color: '#999' }}>
            错误 ID: {errorDetails.id}
          </small>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <button
            onClick={resetErrorBoundary}
            style={{
              padding: '10px 24px',
              background: 'var(--color-secondary, #007AFF)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#5B6ABF';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = '#667eea';
            }}
          >
            尝试恢复
          </button>
          <button
            onClick={safeRefresh}
            style={{
              padding: '10px 24px',
              background: 'var(--bg-surface, #FFFFFF)',
              color: 'var(--text-secondary, #6E6E73)',
              border: `1px solid var(--border-color, rgba(0,0,0,0.06))`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            刷新页面
          </button>
        </div>

        <button
          onClick={() => {}}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-secondary, #007AFF)',
            fontSize: '12px',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          {true ? '隐藏技术详情' : '查看技术详情'}
        </button>

        {true && (
          <div
            style={{
              marginTop: '16px',
              padding: '16px',
              background: '#1a202c',
              color: 'var(--border-color, rgba(0,0,0,0.06))',
              borderRadius: '8px',
              fontSize: '12px',
              textAlign: 'left',
              overflowX: 'auto',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
            }}
          >
            <strong>类型:</strong> {errorDetails.type}
            <br />
            <strong>时间:</strong> {errorDetails.timestamp}
            <br />
            <strong>路径:</strong> {errorDetails.context.path}
            <br />
            <br />
            <strong>堆栈:</strong>
            <br />
            {errorDetails.stack || '无堆栈信息'}
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════
// 🟡 P2-3: React Context & Hooks
// ═════════════════════════════════════════════

const ErrorTrackingContext = createContext<ErrorTrackingContextValue | null>(null);

/** 错误追踪 Provider（在应用根部包裹） */
export function ErrorTrackingProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<CapturedError[]>([]);
  const errorsRef = useRef(errors);
  errorsRef.current = errors;

  const reportError = useCallback(
    (error: unknown, extra: Partial<CapturedError> = {}): CapturedError => {
      const captured =
        handleCapturedError(error, extra) ||
        buildCapturedError(error, { ...extra, reported: false });
      setErrors((prev) => {
        const next = [...prev, captured];
        const maxToKeep = globalConfig.maxErrors || 200;
        return next.length > maxToKeep ? next.slice(-maxToKeep) : next;
      });
      return captured;
    },
    [],
  );

  const clearErrors = useCallback(() => {
    setErrors([]);
    clearErrorQueue();
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const value: ErrorTrackingContextValue = {
    errors,
    reportError,
    clearErrors,
    dismissError,
    recentErrors: errors.slice(-10).reverse(),
    errorCount: errors.length,
  };

  return <ErrorTrackingContext.Provider value={value}>{children}</ErrorTrackingContext.Provider>;
}

/** Hook: 获取错误追踪能力 */
export function useErrorTracking(): ErrorTrackingContextValue {
  // ✓ 所有 hooks 必须在条件语句之前调用
  const ctx = useContext(ErrorTrackingContext);

  // 如果未被 Provider 包裹，提供一个简化的实现
  if (!ctx) {
    return {
      errors: [],
      reportError: (error, extra) => handleCapturedError(error, extra) || buildCapturedError(error, extra),
      clearErrors: () => {},
      dismissError: () => {},
      recentErrors: [],
      errorCount: 0,
    };
  }
  return ctx;
}

// ═════════════════════════════════════════════
// 🟡 P2-3: 便捷 Hook - API 错误处理
// ═════════════════════════════════════════════

/**
 * 🔧 包装 API 请求，自动处理错误
 *
 * 使用:
 *   const { call, loading, error, reset } = useSafeApiCall<Data>(
 *     () => fetch('/api/data').then(r => r.json()),
 *     { onError: (err) => showToast(err.message) }
 *   );
 */
export function useSafeApiCall<T>(
  fn: () => Promise<T>,
  options: {
    onSuccess?: (data: T) => void;
    onError?: (error: CapturedError) => void;
    onSettled?: () => void;
    retryCount?: number;
    retryDelay?: number;
  } = {},
): {
  call: () => Promise<T | null>;
  data: T | null;
  loading: boolean;
  error: CapturedError | null;
  reset: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<CapturedError | null>(null);
  const { reportError } = useErrorTracking();

  const call = useCallback(async () => {
    setLoading(true);
    setError(null);

    const maxAttempts = (options.retryCount || 0) + 1;
    const delay = options.retryDelay || 1000;

    let lastError: CapturedError | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn();
        setData(result);
        setLoading(false);
        options.onSuccess?.(result);
        options.onSettled?.();
        return result;
      } catch (err) {
        lastError = reportError(err, { type: 'api' });
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
      }
    }

    setError(lastError);
    setLoading(false);
    options.onError?.(lastError || buildCapturedError(new Error('请求失败'), { type: 'api' }));
    options.onSettled?.();
    return null;
  }, [fn, options.retryCount, options.retryDelay]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { call, data, loading, error, reset };
}

// ═════════════════════════════════════════════
// 🟡 P2-3: 状态恢复 Hook（崩溃后恢复表单等状态）
// ═════════════════════════════════════════════

/**
 * 💾 状态持久化 Hook（自动保存到 localStorage，崩溃后可恢复）
 *
 * 使用:
 *   const [form, setForm] = usePersistedState('form_data', { name: '' });
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T,
  options: {
    version?: string;
    ttlMinutes?: number;
  } = {},
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const storageKey = `rmfood_state_${key}${options.version ? `_v${options.version}` : ''}`;

  const [value, setValueInternal] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return initialValue;
      const parsed = JSON.parse(raw) as { v: T; t: number };
      if (options.ttlMinutes && Date.now() - parsed.t > options.ttlMinutes * 60 * 1000) {
        localStorage.removeItem(storageKey);
        return initialValue;
      }
      return parsed.v;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValueInternal((prev) => {
        const valueToStore =
          typeof newValue === 'function' ? (newValue as (p: T) => T)(prev) : newValue;
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ v: valueToStore, t: Date.now() }),
          );
        } catch {
          // 忽略存储失败
        }
        return valueToStore;
      });
    },
    [storageKey],
  );

  const clear = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // 忽略
    }
    setValueInternal(initialValue);
  }, [storageKey, initialValue]);

  return [value, setValue, clear];
}

// ═════════════════════════════════════════════
// 🟡 P2-3: 配置便捷函数
// ═════════════════════════════════════════

/** 便捷初始化 - 一次性配置完整错误处理系统 */
export function initErrorSystem(config: ErrorHandlerConfig = {}): void {
  configureErrorHandler(config);
}

// ═════════════════════════════════════════════
// 🟡 P2-3: 对外导出
// ═════════════════════════════════════════

export { DefaultFallback };

// 别名导出 — 向后兼容（GlobalErrorBoundary / ModuleErrorBoundary 就是 ErrorBoundary 的别名）
export { ErrorBoundary as GlobalErrorBoundary, ErrorBoundary as ModuleErrorBoundary };
