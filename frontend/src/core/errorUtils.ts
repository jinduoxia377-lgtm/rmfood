/**
 * 🟡 P2-3: 错误信息提取工具（纯函数，便于测试）
 */

import type { ErrorContextData, ErrorSeverity, CapturedError } from './types';

/** 生成唯一错误 ID */
export function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** 获取错误消息 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || '发生未知错误';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message || '发生未知错误');
  }
  return '发生未知错误';
}

/** 获取错误堆栈 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/** 智能检测错误类型 */
export function detectErrorType(error: unknown): CapturedError['type'] {
  if (error instanceof Error) {
    const name = error.name.toLowerCase();
    if (name.includes('network') || name.includes('fetch')) return 'network';
    if (name.includes('api') || name.includes('http')) return 'api';
    if (name.includes('promise')) return 'promise';
  }
  return 'unknown';
}

/** 智能检测严重程度 */
export function detectSeverity(message: string, statusCode?: number): ErrorSeverity {
  if (statusCode && statusCode >= 500) return 'critical';
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('critical') || lowerMsg.includes('fatal')) return 'critical';
  if (statusCode && statusCode >= 400) return 'error';
  if (lowerMsg.includes('warning') || lowerMsg.includes('warn')) return 'warning';
  return 'error';
}

/** 获取当前页面路径 */
export function getCurrentPath(): string {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.pathname;
  }
  return 'unknown';
}

/** 获取/创建会话 ID（用于追踪用户会话的错误） */
export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server_side';
  const existing = localStorage.getItem('rmfood_session_id');
  if (existing) return existing;
  const newSession = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem('rmfood_session_id', newSession);
  return newSession;
}

/** 获取上下文数据（用户信息 + 环境信息） */
export function getContextData(
  userInfo: () => { userId?: string; metadata?: Record<string, unknown> },
): ErrorContextData {
  const userData = userInfo();
  return {
    userId: userData.userId,
    path: getCurrentPath(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    sessionId: getSessionId(),
    metadata: userData.metadata,
  };
}

/** 默认上下文 */
export const defaultContext: ErrorContextData = {
  path: '',
  userAgent: '',
  sessionId: '',
};
