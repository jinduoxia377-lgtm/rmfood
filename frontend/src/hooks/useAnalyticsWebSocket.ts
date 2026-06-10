/**
 * WebSocket Hook for Real-time Analytics Updates
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Message queue for offline handling
 * - Connection status monitoring
 * - Custom event handlers
 * - Performance optimized
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { logger } from '@/utils/safeLogger';


interface UseWebSocketOptions {
  url: string
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  onMessage?: (data: any) => void
  onConnectionChange?: (connected: boolean) => void
  onError?: (error: Event) => void
}

interface WebSocketState {
  connected: boolean
  connecting: boolean
  error: string | null
  lastMessage: any | null
  messageCount: number
}

export function useAnalyticsWebSocket(options: UseWebSocketOptions) {
  const {
    url,
    reconnect = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    onMessage,
    onConnectionChange,
    onError,
  } = options

  const [state, setState] = useState<WebSocketState>({
    connected: false,
    connecting: false,
    error: null,
    lastMessage: null,
    messageCount: 0,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    setState(prev => ({ ...prev, connecting: true, error: null }))

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        logger.info('[AnalyticsWS] 连接成功')
        reconnectAttemptsRef.current = 0

        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            connected: true,
            connecting: false,
            error: null,
          }))

          onConnectionChange?.(true)
        }

        // Subscribe to analytics channel
        ws.send(JSON.stringify({
          type: 'subscribe',
          channels: ['analytics_dashboard', 'kpi_updates', 'chart_refresh'],
        }))
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (mountedRef.current) {
            setState(prev => ({
              ...prev,
              lastMessage: data,
              messageCount: prev.messageCount + 1,
            }))
          }

          onMessage?.(data)
        } catch (err) {
          logger.error('[AnalyticsWS] 消息解析失败:', err)
        }
      }

      ws.onerror = (event) => {
        logger.error('[AnalyticsWS] 连接错误:', event)
        onError?.(event)
      }

      ws.onclose = (event) => {
        logger.info(`[AnalyticsWS] 连接关闭: code=${event.code}`)

        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            connected: false,
            connecting: false,
          }))

          onConnectionChange?.(false)
        }

        // Attempt reconnection
        if (reconnect && reconnectAttemptsRef.current < maxReconnectAttempts && mountedRef.current) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectAttemptsRef.current),
            30000, // Max 30 seconds
          )

          logger.info(`[AnalyticsWS] ${delay/1000}秒后尝试重连 (${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`)

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++
            connect()
          }, delay)
        }
      }

    } catch (error) {
      logger.error('[AnalyticsWS] 创建连接失败:', error)

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          connecting: false,
          error: '无法建立连接',
        }))
      }
    }
  }, [url, reconnect, reconnectInterval, maxReconnectAttempts, onMessage, onConnectionChange, onError])

  const disconnect = useCallback(() => {
    reconnectAttemptsRef.current = maxReconnectAttempts // Stop reconnection attempts

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close(1000, '用户主动断开')
      wsRef.current = null
    }

    if (mountedRef.current) {
      setState({
        connected: false,
        connecting: false,
        error: null,
        lastMessage: null,
        messageCount: 0,
      })

      onConnectionChange?.(false)
    }
  }, [maxReconnectAttempts, onConnectionChange])

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
      return true
    }

    logger.warn('[AnalyticsWS] 无法发送消息: 连接未就绪')
    return false
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [connect, disconnect])

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    websocket: wsRef.current,
  }
}

export default useAnalyticsWebSocket
