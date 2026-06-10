/**
 * RealTimeDataUpdater - 实时数据更新组件
 * 集成WebSocket实现数据实时推送、自动刷新、状态监控
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { logger } from '@/utils/safeLogger'
import {
  Wifi, WifiOff, Activity, RefreshCw, AlertCircle,
  Clock, TrendingUp, Zap,
} from 'lucide-react'

// ─── 类型定义 ───
export interface RealtimeConfig {
  endpoint: string
  updateInterval?: number        // 轮询间隔（毫秒），默认30秒
  enableWebSocket?: boolean      // 是否启用WebSocket，默认true
  reconnectAttempts?: number     // 最大重连次数，默认5次
  heartbeatInterval?: number     // 心跳检测间隔，默认15秒
  dataBufferMaxSize?: number     // 数据缓冲区最大容量，默认1000条
  onMessage?: (data: any) => void
  onError?: (error: Error) => void
  onReconnect?: (attempt: number) => void
}

interface ConnectionStatus {
  connected: boolean
  mode: 'websocket' | 'polling' | 'offline'
  lastUpdate: Date | null
  latency: number              // 延迟（毫秒）
  messagesReceived: number
  errorsCount: number
}

interface DataPoint {
  id: string
  timestamp: Date
  type: string
  data: any
  processed: boolean
}

// ─── WebSocket Hook ───
function useWebSocket(config: RealtimeConfig) {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: false,
    mode: 'offline',
    lastUpdate: null,
    latency: 0,
    messagesReceived: 0,
    errorsCount: 0,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
	const heartbeatTimerRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  const queryClient = useQueryClient()

  // 数据缓冲区
  const [dataBuffer, setDataBuffer] = useState<DataPoint[]>([])

  // 连接WebSocket
  const connect = useCallback(() => {
    if (!config.enableWebSocket) {
      setStatus(prev => ({ ...prev, mode: 'polling' }))
      return
    }

    try {
      const wsUrl = config.endpoint.startsWith('ws')
        ? config.endpoint
        : `ws://${window.location.host}${config.endpoint}`

      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        logger.info('[RealTimeDataUpdater] WebSocket connected')
        setStatus({
          connected: true,
          mode: 'websocket',
          lastUpdate: new Date(),
          latency: 0,
          messagesReceived: status.messagesReceived,
          errorsCount: status.errorsCount,
        })
        setReconnectAttempt(0)

        // 启动心跳检测
        startHeartbeat()

        config.onReconnect?.(reconnectAttempt)
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          const startTime = performance.now()

          // 处理消息
          handleMessage(message)

          // 更新状态
          setStatus(prev => ({
            ...prev,
            lastUpdate: new Date(),
            latency: Math.round(performance.now() - startTime),
            messagesReceived: prev.messagesReceived + 1,
          }))

          // 触发回调
          config.onMessage?.(message)

          // 使相关查询失效以触发重新获取
          invalidateRelatedQueries(message.type)

        } catch (error) {
          logger.error('[RealTimeDataUpdater] Failed to parse message:', error)
          handleConnectionError(error as Error)
        }
      }

      wsRef.current.onerror = (error) => {
        logger.error('[RealTimeDataUpdater] WebSocket error:', error)
        handleConnectionError(new Error('WebSocket connection error'))
      }

      wsRef.current.onclose = () => {
        logger.info('[RealTimeDataUpdater] WebSocket disconnected')
        setStatus(prev => ({ ...prev, connected: false }))
        stopHeartbeat()
        scheduleReconnect()
      }

    } catch (error) {
      logger.error('[RealTimeDataUpdater] Connection failed:', error)
      handleConnectionError(error as Error)
    }
  }, [config.endpoint, config.enableWebSocket])

  // 处理接收到的消息
  const handleMessage = useCallback((data: any) => {
    const newDataPoint: DataPoint = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      type: data.type || 'unknown',
      data,
      processed: false,
    }

    // 添加到缓冲区
    setDataBuffer(prev => {
      const updated = [...prev, newDataPoint]
      // 保持缓冲区大小在限制内
      return updated.slice(-(config.dataBufferMaxSize ?? 1000))
    })

    // 标记为已处理
    setTimeout(() => {
      setDataBuffer(prev =>
        prev.map(p => p.id === newDataPoint.id ? { ...p, processed: true } : p),
      )
    }, 100)
  }, [config.dataBufferMaxSize])

  // 处理连接错误
  const handleConnectionError = useCallback((error: Error) => {
    setStatus(prev => ({
      ...prev,
      errorsCount: prev.errorsCount + 1,
    }))
    config.onError?.(error)
  }, [config.onError])

  // 计划重连
  const scheduleReconnect = useCallback(() => {
    const maxAttempts = config.reconnectAttempts || 5

    if (reconnectAttempt >= maxAttempts) {
      logger.warn(`[RealTimeDataUpdater] Max reconnect attempts (${maxAttempts}) reached`)
      setStatus(prev => ({ ...prev, mode: 'polling' })) // 降级为轮询模式
      return
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000)

    reconnectTimerRef.current = setTimeout(() => {
      setReconnectAttempt(prev => prev + 1)
      connect()
    }, delay)
  }, [reconnectAttempt, config.reconnectAttempts, connect])

  // 启动心跳检测
  const startHeartbeat = useCallback(() => {
    const interval = config.heartbeatInterval || 15000

    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pingStart = performance.now()

        wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))

        // 测量延迟（简化版）
        setTimeout(() => {
          setStatus(prev => ({
            ...prev,
            latency: Math.round(performance.now() - pingStart),
          }))
        }, 50)
      }
    }, interval)
  }, [config.heartbeatInterval])

  // 停止心跳
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
    }
  }, [])

  // 使相关查询失效
  const invalidateRelatedQueries = useCallback((dataType: string) => {
    // 根据消息类型使相关查询失效
    const queryKeysToInvalidate: string[][] = []

    switch (dataType) {
      case 'kpi_update':
        queryKeysToInvalidate.push(['analytics', 'kpis'])
        break
      case 'chart_update':
        queryKeysToInvalidate.push(['analytics', 'charts'])
        break
      case 'activity':
        queryKeysToInvalidate.push(['analytics', 'activity'])
        break
      default:
        queryKeysToInvalidate.push(['analytics'])
    }

    queryKeysToInvalidate.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key })
    })
  }, [queryClient])

  // 断开连接
  const disconnect = useCallback(() => {
    stopHeartbeat()

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setStatus({
      connected: false,
      mode: 'offline',
      lastUpdate: null,
      latency: 0,
      messagesReceived: 0,
      errorsCount: 0,
    })
  }, [stopHeartbeat])

  // 初始化和清理
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // 如果WebSocket不可用，使用轮询模式
  useEffect(() => {
    if (!config.enableWebSocket || status.mode === 'polling') {
      const interval = setInterval(() => {
        // 通过使查询失效来触发数据刷新
        queryClient.invalidateQueries({ queryKey: ['analytics'] })
        setStatus(prev => ({
          ...prev,
          lastUpdate: new Date(),
          mode: 'polling',
        }))
      }, config.updateInterval || 30000)

      return () => clearInterval(interval)
    }
    return undefined
  }, [config.enableWebSocket, status.mode, config.updateInterval, queryClient])

  return {
    status,
    dataBuffer,
    connect,
    disconnect,
    reconnect: connect,
  }
}

// ─── 主组件 ───
export const RealTimeDataUpdater: React.FC<{
  config: RealtimeConfig
  children?: React.ReactNode
}> = ({ config, children }) => {
  const { status, dataBuffer, reconnect } = useWebSocket(config)

  // 格式化最后更新时间
  const formatLastUpdate = useCallback((date: Date | null) => {
    if (!date) return '从未'

    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)

    if (seconds < 60) return `${seconds}秒前`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`
    return date.toLocaleString()
  }, [])

  // 状态指示器颜色
  const getStatusColor = (mode: string, connected: boolean) => {
    if (connected && mode === 'websocket') return 'text-green-500 bg-green-50 dark:bg-green-900/20'
    if (mode === 'polling') return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20'
    return 'text-red-500 bg-red-50 dark:bg-red-900/20'
  }

  return (
    <div className="relative">
      {/* 实时状态指示器 */}
      <div className="absolute top-4 right-4 z-10">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
          getStatusColor(status.mode, status.connected)
        }`}>
          {status.connected && status.mode === 'websocket' ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>实时</span>
              <span className="opacity-70">{formatLastUpdate(status.lastUpdate)}</span>
            </>
          ) : status.mode === 'polling' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>轮询</span>
              <span className="opacity-70">每{Math.round((config.updateInterval || 30000) / 1000)}s</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>离线</span>
              <button
                onClick={reconnect}
                className="ml-1 underline hover:no-underline"
              >
                重连
              </button>
            </>
          )}
        </div>
      </div>

      {/* 子内容 */}
      {children}

      {/* 数据流统计面板（可折叠） */}
      <div className="mt-4 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg border border-gray-200 dark:border-slate-700">
        <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          数据流状态
        </h4>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <div>
              <div className="font-medium text-text-primary">最后更新</div>
              <div className="text-text-muted text-xs">{formatLastUpdate(status.lastUpdate)}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <div>
              <div className="font-medium text-text-primary">接收消息</div>
              <div className="text-text-muted text-xs">{status.messagesReceived.toLocaleString()} 条</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-gray-400" />
            <div>
              <div className="font-medium text-text-primary">网络延迟</div>
              <div className="text-text-muted text-xs">{status.latency} ms</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AlertCircle className={`w-4 h-4 ${status.errorsCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
            <div>
              <div className="font-medium text-text-primary">错误次数</div>
              <div className={`text-xs ${status.errorsCount > 0 ? 'text-red-500' : 'text-text-muted'}`}>
                {status.errorsCount}
              </div>
            </div>
          </div>
        </div>

        {/* 数据缓冲区大小 */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between text-xs text-text-muted">
          <span>缓冲区容量: {dataBuffer.length}/{config.dataBufferMaxSize || 1000}</span>
          <span>连接模式: {status.mode.toUpperCase()}</span>
        </div>
      </div>
    </div>
  )
}

// ─── 模拟数据生成器（用于演示） ───
export function generateRealtimeMockData(): any[] {
  const types = ['kpi_update', 'chart_update', 'activity', 'alert', 'metric_change']

  return Array.from({ length: 10 }, (_, i) => ({
    type: types[Math.floor(Math.random() * types.length)],
    timestamp: new Date(Date.now() - i * 5000).toISOString(),
    data: {
      value: Math.floor(Math.random() * 1000),
      change: (Math.random() - 0.5) * 20,
      metadata: {
        source: `source-${i}`,
        category: ['formulas', 'experiments', 'users'][Math.floor(Math.random() * 3)],
      },
    },
  }))
}

// ─── 导出配置工具 ───
export function createDefaultRealtimeConfig(endpoint: string): RealtimeConfig {
  return {
    endpoint,
    updateInterval: 30000,
    enableWebSocket: true,
    reconnectAttempts: 5,
    heartbeatInterval: 15000,
    dataBufferMaxSize: 1000,
    onMessage: (data) => {
      logger.info('[RealTime] Received:', data.type)
    },
    onError: (error) => {
      logger.error('[RealTime] Error:', error.message)
    },
    onReconnect: (attempt) => {
      logger.info(`[RealTime] Reconnecting... Attempt ${attempt}`)
    },
  }
}

export default RealTimeDataUpdater
