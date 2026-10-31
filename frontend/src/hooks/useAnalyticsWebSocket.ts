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
  // 标记「本次 WebSocket 关闭是主动行为」（组件卸载、用户退出、切换 URL 等）。
  // 主动关闭不应产生 error 级别的日志噪音。
  const intentionalCloseRef = useRef(false)

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    setState(prev => ({ ...prev, connecting: true, error: null }))

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws
      // 新建连接代表新的生命周期：重置主动关闭标记，
      // 确保后续真实断线/网络异常仍会正常记录 error 并触发重连。
      intentionalCloseRef.current = false

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
        // React StrictMode 开发模式会「挂载→卸载→再挂载」：首次 connect() 创建的 ws 在握手阶段
        // 被 cleanup 主动 close() 后，浏览器仍会触发 error（code=1006）。此时 intentionalCloseRef
        // 可能已被第二次 connect() 重置为 false，因此还需判断触发事件的 ws 是否仍是当前活跃连接
        // （wsRef.current === ws）。若已被主动关闭/替换（陈旧连接），属于预期行为，仅记 debug 而不记
        // error；真实网络异常（当前活跃连接报错）仍会正常记录 error 并走原有重连逻辑。
        const isIntentionalClose =
          intentionalCloseRef.current || wsRef.current !== ws

        if (isIntentionalClose) {
          logger.debug('[AnalyticsWS] 连接已主动关闭，跳过错误日志:', event)
        } else {
          logger.error('[AnalyticsWS] 连接错误:', event)
        }

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
    // 主动断开（组件卸载、用户退出、切换 URL 等）：先标记主动关闭，
    // 再 close()，避免浏览器对握手中的连接触发 error（code=1006）时记录错误日志。
    intentionalCloseRef.current = true

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
