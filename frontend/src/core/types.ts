/**
 * 🟡 P2-3: 错误系统类型定义
 */

/** 错误严重程度 */
export type ErrorSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

/** 错误上下文数据（用于追踪和调试） */
export interface ErrorContextData {
  /** 用户 ID */
  userId?: string;
  /** 当前页面路径 */
  path: string;
  /** 用户代理 */
  userAgent: string;
  /** 会话 ID */
  sessionId: string;
  /** 自定义元数据 */
  metadata?: Record<string, unknown>;
}

/** 已捕获的错误（结构化数据） */
export interface CapturedError {
  /** 唯一错误 ID */
  id: string;
  /** 错误类型 */
  type: 'component' | 'promise' | 'api' | 'network' | 'unknown';
  /** 错误消息 */
  message: string;
  /** 错误堆栈 */
  stack?: string;
  /** 发生时间（ISO 格式） */
  timestamp: string;
  /** 严重程度 */
  severity: ErrorSeverity;
  /** 业务错误码（如 AUTH_001） */
  errorCode?: string;
  /** HTTP 状态码（如果适用） */
  statusCode?: number;
  /** 上下文信息 */
  context: ErrorContextData;
  /** 额外信息 */
  extra?: Record<string, unknown>;
  /** 是否已上报 */
  reported: boolean;
}

/** 错误处理器配置 */
export interface ErrorHandlerConfig {
  /** 错误上报回调（可接入监控系统） */
  onError?: (error: CapturedError) => void;
  /** 是否输出到 console */
  logToConsole?: boolean;
  /** 是否启用 Sentry 上报（如集成） */
  reportToSentry?: boolean;
  /** 最大错误队列大小（防止内存溢出） */
  maxErrors?: number;
  /** 同错误熔断阈值（N 次后触发降级） */
  fuseThreshold?: number;
  /** 错误过滤器（返回 false 表示不记录） */
  filter?: (error: CapturedError) => boolean;
  /** 用户信息获取函数 */
  getUserInfo?: () => { userId?: string; metadata?: Record<string, unknown> };
}

/** 错误追踪 Hook 返回类型 */
export interface ErrorTrackingContextValue {
  errors: CapturedError[];
  reportError: (
    error: unknown,
    extra?: Partial<CapturedError>,
  ) => CapturedError;
  clearErrors: () => void;
  dismissError: (id: string) => void;
  recentErrors: CapturedError[];
  errorCount: number;
}

/** 错误边界 Fallback 组件参数 */
export interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
  errorDetails: CapturedError;
  safeRefresh: () => void;
}
