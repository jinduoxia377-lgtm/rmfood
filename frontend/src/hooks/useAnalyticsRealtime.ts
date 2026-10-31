/**
 * 分析页面实时数据更新 Hook — 增强版
 *
 * 优先级：
 * 1. WebSocket 实时推送（如果启用且连接成功）
 * 2. HTTP 轮询拉取真实后端数据（作为降级方案）
 *
 * 原来完全依赖模拟数据，现在对接真实后端。
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { wsService, type MessageHandler, type WebSocketMessage } from '@/services/websocket'
import { logger } from '@/utils/safeLogger'
import { envConfig } from '@/config/env'

export interface AnalyticsRealtimeData {
  type: 'kpi_update' | 'chart_update' | 'system_health' | 'activity'
  payload: Record<string, unknown>
  timestamp: number
}

export interface AnalyticsStats {
  total_formulas: number
  total_experiments: number
  active_users: number
  data_points: number
  success_rate: number
  avg_processing_time: number
}

export interface UseAnalyticsRealtimeOptions {
  enabled?: boolean
  refreshInterval?: number
  onDataUpdate?: (data: AnalyticsRealtimeData) => void
}

const BASE = envConfig.api.baseUrl

export function useAnalyticsRealtime(options: UseAnalyticsRealtimeOptions = {}) {
  const {
    enabled = true,
    refreshInterval = 30000,
    onDataUpdate,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [isRealTime, setIsRealTime] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now())

  // 从真实 API 拉取的统计数据
  const [stats, setStats] = useState<AnalyticsStats>({
    total_formulas: 0,
    total_experiments: 0,
    active_users: 0,
    data_points: 0,
    success_rate: 0,
    avg_processing_time: 0,
  })

  const messageHandlerRef = useRef<MessageHandler | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── 从 API 拉取最新 KPI ──────────────────────────────────
  const fetchKPIs = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/analytics/kpi`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const metrics = data.metrics ?? []

      const map = new Map(metrics.map((m: { id: string; value: number }) => [m.id, m.value]))

      setStats(prev => ({
        ...prev,
        total_formulas: Number(map.get('total_formulas') ?? prev.total_formulas),
        total_experiments: Number(map.get('total_experiments') ?? prev.total_experiments),
        active_users: Number(map.get('active_users') ?? prev.active_users),
        data_points: Number(map.get('ai_generations') ?? prev.data_points),
        success_rate: Number(map.get('published_formulas') ?? prev.success_rate),
        avg_processing_time: Number(map.get('storage_usage') ?? prev.avg_processing_time),
      }))
      setLastUpdate(Date.now())
    } catch (e) {
      logger.error('[useAnalyticsRealtime] fetchKPIs failed:', e)
    }
  }, [])

  // ─── WebSocket 消息处理 ───────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    messageHandlerRef.current = (message: WebSocketMessage) => {
      try {
        const data: AnalyticsRealtimeData = {
          type: message.type as AnalyticsRealtimeData['type'],
          payload: message.data as Record<string, unknown>,
          timestamp: Date.now(),
        }

        if (message.type === 'data_update') {
          const entityType = message.data?.entity_type as string
          if (entityType === 'formula' || entityType === 'experiment') {
            const updates = message.data?.data as Record<string, number>
            if (updates) {
              setStats(prev => ({ ...prev, ...updates }))
              setLastUpdate(Date.now())
            }
          }
        }

        if (message.type === 'kpi_update') {
          const kpiData = message.data as Record<string, number>
          if (kpiData) {
            setStats(prev => ({ ...prev, ...kpiData }))
            setLastUpdate(Date.now())
          }
        }

        if (message.type === 'system_health') {
          logger.info('System health update', message.data)
        }

        onDataUpdate?.(data)
      } catch (error) {
        logger.error('Error processing analytics message', { error })
      }
    }

    const unsubscribe = wsService.onMessage(messageHandlerRef.current)

    wsService.connect().then((connected) => {
      setIsConnected(connected)
      setIsRealTime(connected)
      logger.info(`Analytics WebSocket ${connected ? 'connected' : 'not connected'}`)
    })

    return () => {
      unsubscribe()
    }
  }, [enabled, onDataUpdate])

  // ─── 降级方案：HTTP 轮询 ──────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    // 如果 WebSocket 未连接，使用 HTTP 轮询
    if (!isRealTime) {
      // 立即拉取一次
      fetchKPIs()

      pollRef.current = setInterval(fetchKPIs, refreshInterval)
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [enabled, isRealTime, refreshInterval, fetchKPIs])

  // ─── 控制函数 ─────────────────────────────────────────────
  const connect = useCallback(async () => {
    const connected = await wsService.connect()
    setIsConnected(connected)
    setIsRealTime(connected)
    return connected
  }, [])

  const disconnect = useCallback(() => {
    wsService.disconnect()
    setIsConnected(false)
    setIsRealTime(false)
  }, [])

  const forceRefresh = useCallback(() => {
    if (isRealTime) {
      wsService.send({ type: 'refresh_analytics', timestamp: Date.now() })
    } else {
      fetchKPIs()
    }
  }, [isRealTime, fetchKPIs])

  const updateStats = useCallback((newStats: Partial<AnalyticsStats>) => {
    setStats(prev => ({ ...prev, ...newStats }))
    setLastUpdate(Date.now())
  }, [])

  return {
    stats,
    isConnected,
    isRealTime,
    lastUpdate,
    connect,
    disconnect,
    forceRefresh,
    updateStats,
  }
}

export interface UseRealtimeChartDataOptions {
  enabled?: boolean
  chartType: string
}

export function useRealtimeChartData(options: UseRealtimeChartDataOptions) {
  const { enabled = true, chartType } = options
  const [data, setData] = useState<Array<Record<string, string | number>>>([])
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    if (!enabled) return

    const handler: MessageHandler = (message: WebSocketMessage) => {
      if (message.type === 'chart_update' && message.data?.chart_type === chartType) {
        setIsUpdating(true)

        setTimeout(() => {
          const newData = message.data?.data as Array<Record<string, string | number>>
          if (newData && Array.isArray(newData)) {
            setData(newData)
          }
          setIsUpdating(false)
        }, 100)
      }
    }

    const unsubscribe = wsService.subscribe(chartType, handler)

    return () => {
      unsubscribe()
    }
  }, [enabled, chartType])

  return {
    data,
    isUpdating,
  }
}
