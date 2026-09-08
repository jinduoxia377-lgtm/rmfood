/**
 * SSE 实时健康监控 Hook
 *
 * 每 10 秒通过 EventSource 获取模型健康状态
 * 替代原有的轮询方式，支持实时推送
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/utils/safeLogger';
import type { ModelHealth } from '@/types/ai.api';

const HEALTH_REFRESH_INTERVAL_MS = 10_000; // 10 秒

export function useModelHealthSSE() {
  const [healthData, setHealthData] = useState<ModelHealth[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 连接 SSE 流
   */
  const connect = useCallback(() => {
    // 关闭旧连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const eventSource = new EventSource('/api/v1/ai/models/health/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      logger.info('[SSE] Model health connection established');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ModelHealth[];
        setHealthData(data);
        setLastUpdated(new Date());
      } catch (err) {
        logger.error('[SSE] Failed to parse health data:', err);
      }
    };

    eventSource.onerror = (event) => {
      setIsConnected(false);
      logger.warn('[SSE] Connection error, will retry in', HEALTH_REFRESH_INTERVAL_MS / 1000, 's');

      // 指数退避重试
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        connect();
      }, HEALTH_REFRESH_INTERVAL_MS);
    };
  }, []);

  /**
   * 断开连接
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    healthData,
    isConnected,
    lastUpdated,
    reconnect: connect,
    disconnect,
  };
}

/**
 * 备用轮询方案（当 SSE 不可用时）
 */
export function useModelHealthPolling(intervalMs: number = HEALTH_REFRESH_INTERVAL_MS) {
  const [healthData, setHealthData] = useState<ModelHealth[]>([]);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/ai/models/health');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as ModelHealth[];
      setHealthData(data);
      setLastUpdated(new Date());
      setIsConnected(true);
    } catch (err) {
      setIsConnected(false);
      logger.warn('[Polling] Health check failed:', err);

      // 延迟重试
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(fetchHealth, intervalMs);
    }
  }, [intervalMs]);

  useEffect(() => {
    fetchHealth();
    const timer = setInterval(fetchHealth, intervalMs);
    return () => {
      clearInterval(timer);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchHealth, intervalMs]);

  return { healthData, isConnected, lastUpdated };
}

/**
 * 自动选择最佳方案（优先 SSE，降级轮询）
 */
export function useModelHealth() {
  const sse = useModelHealthSSE();
  const polling = useModelHealthPolling();

  // SSE 连接成功则使用 SSE 数据，否则使用轮询
  if (sse.isConnected) {
    return { ...sse };
  }
  return { ...polling, reconnect: sse.reconnect };
}
