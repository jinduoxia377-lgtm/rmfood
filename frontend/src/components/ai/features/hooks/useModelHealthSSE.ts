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
  // 先探测端点是否存在：EventSource 对 404/405 的响应体会当作"连接失败"，
  // 而 onerror 会无条件指数重试 —— 若端点根本不存在，就会每 10 秒白发一个
  // 注定失败的请求，同时轮询方案还在正常跑，等于双倍开销。
  const [sseAvailable, setSseAvailable] = useState(false);
  const probedRef = useRef(false);
  // 用 ref 保存最新值：首次连接成功后 probedRef.current=true，
  // 但 state 闭包中的 sseAvailable 仍是初始 false。若 probeEndpoint 读取 state，
  // 断线重试时（stale closure）会返回旧值 false，导致 EventSource 永不重建。
  const sseAvailableRef = useRef(false);

  /**
   * 探测 /ai/models/health/stream 是否真的存在。
   * 只探测一次，结果缓存（同步写入 ref，供任意闭包读取最新值）。
   */
  const probeEndpoint = useCallback(async (): Promise<boolean> => {
    if (probedRef.current) return sseAvailableRef.current;
    try {
      // Accept: text/event-stream 使探测请求与被 EventSource 使用的资源类型一致
      const res = await fetch('/api/v1/ai/models/health/stream', {
        method: 'GET',
        headers: { Accept: 'text/event-stream' },
      });
      const ok = res.ok && (res.headers.get('content-type') || '').includes('text/event-stream');
      if (!ok) {
        logger.info(`[SSE] /ai/models/health/stream 不可用（HTTP ${res.status}），改用轮询`);
      }
      probedRef.current = true;
      sseAvailableRef.current = ok;
      setSseAvailable(ok);
      return ok;
    } catch (err) {
      logger.warn('[SSE] 探测健康流端点失败，改用轮询:', err);
      probedRef.current = true;
      sseAvailableRef.current = false;
      setSseAvailable(false);
      return false;
    }
  }, []);

  /**
   * 连接 SSE 流
   */
  const everOpenedRef = useRef(false);

  const connect = useCallback(async () => {
    // 关闭旧连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // 端点不存在就不开 EventSource，直接让 useModelHealth 走轮询分支
    if (!(await probeEndpoint())) return;

    const eventSource = new EventSource('/api/v1/ai/models/health/stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      everOpenedRef.current = true;
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

    eventSource.onerror = () => {
      setIsConnected(false);
      // 从未成功建立过连接就不重试了：端点大概率不存在或已停服，
      // 轮询方案仍在持续工作，没必要再每 10 秒发一个注定失败的请求。
      // 已连上过又断开的（网络抖动）才重试。
      if (!everOpenedRef.current) {
        eventSource.close();
        eventSourceRef.current = null;
        logger.info('[SSE] 健康流连接从未成功，停止重试，依赖轮询获取数据');
        return;
      }
      logger.warn('[SSE] Connection error, will retry in', HEALTH_REFRESH_INTERVAL_MS / 1000, 's');

      // 指数退避重试
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        connect();
      }, HEALTH_REFRESH_INTERVAL_MS);
    };
  }, [probeEndpoint]);

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
    sseAvailable,
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
