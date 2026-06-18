/**
 * WebSocket 客户端服务
 * - 管理WebSocket连接
 * - 实现自动重连
 * - 处理实时数据同步
 * - 提供消息订阅机制
 * - 支持消息批量处理和防抖优化
 */

import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/safeLogger'
import { authApi } from '@/api/auth'


interface WebSocketMessage {
  type: string
  data: Record<string, unknown>
  timestamp: string
  channel?: string
  [key: string]: unknown
}

interface WebSocketOptions {
  url: string
  autoReconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  batchProcessing?: boolean
  batchInterval?: number
}

type MessageHandler = (message: WebSocketMessage) => void
type BatchMessageHandler = (messages: WebSocketMessage[]) => void

interface ChannelSubscription {
  channel: string
  handler: MessageHandler
}

export class WebSocketService {
  private ws: WebSocket | null = null
  private url: string
  private autoReconnect: boolean
  private maxReconnectAttempts: number
  private reconnectAttempts = 0
  private isConnecting = false
  private isConnected = false
  private messageHandlers: MessageHandler[] = []
  private batchMessageHandlers: BatchMessageHandler[] = []
  private channelSubscriptions: ChannelSubscription[] = []
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private messageBuffer: WebSocketMessage[] = []
  private connectionId: string
  private lastHeartbeat = 0
  private _lastErrorLogTime = 0  // 错误日志去重时间戳
  private _consecutiveFailures = 0  // 连续失败计数
  private _backendUnreachable = false  // 后端不可达标记
  private static readonly MAX_CONSECUTIVE_FAILURES = 5  // 一个完整重连周期即判定后端不可达
  private stats: { messagesSent: number; bytesSent: number; messagesReceived: number } = {
    messagesSent: 0,
    bytesSent: 0,
    messagesReceived: 0,
  }
  private batchProcessing: boolean
  private batchInterval: number

  constructor(options: WebSocketOptions) {
    this.url = options.url
    this.autoReconnect = options.autoReconnect ?? true
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5
    this.batchProcessing = options.batchProcessing ?? true
    this.batchInterval = options.batchInterval ?? 100
    this.connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  get getLastHeartbeat(): number {
    return this.lastHeartbeat
  }

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnecting || this.isConnected) {
        resolve(this.isConnected)
        return
      }

      // 后端已标记为不可达 → 直接返回，不再尝试连接
      if (this._backendUnreachable) {
        resolve(false)
        return
      }

      // 预检：sessionStorage 中记录的后端不可达状态（跨 HMR 生效）
      const STORAGE_KEY = 'ws_backend_unreachable_until'
      const storedUntil = sessionStorage.getItem(STORAGE_KEY)
      if (storedUntil && Number(storedUntil) > Date.now()) {
        this._backendUnreachable = true
        resolve(false)
        return
      }

      this.isConnecting = true

      try {
        // 🔒 P0 安全修复: Token 存储在 HttpOnly Cookie 中，前端无法直接读取
        // WebSocket 连接时浏览器会自动携带同源 Cookie，后端可通过 Cookie 认证
        // 不再通过 URL query param 传递 token（更安全）
        const authState = useAuthStore.getState()
        const isAuthenticated = authState?.isAuthenticated

        if (!isAuthenticated) {
          logger.warn('WebSocket: 用户未认证，跳过连接')
          this.isConnecting = false
          resolve(false)
          return
        }

        const url = `${this.url}?connection_id=${this.connectionId}&client_info=${encodeURIComponent(JSON.stringify({
          userAgent: navigator.userAgent,
          screenSize: `${window.screen.width}x${window.screen.height}`,
          timestamp: new Date().toISOString(),
        }))}`

        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
          logger.info('WebSocket: Connected')
          this.isConnected = true
          this.isConnecting = false
          this.reconnectAttempts = 0
          this._consecutiveFailures = 0  // 重置连续失败计数
          this._backendUnreachable = false  // 重置不可达标记
          sessionStorage.removeItem('ws_backend_unreachable_until')  // 清除持久化标记
          this.startHeartbeat()
          // 发送连接成功事件
          this.emit('connected', {})
          resolve(true)
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as WebSocketMessage
            this.handleMessage(message)
          } catch (error) {
            logger.error('WebSocket: Error parsing message', { error })
            // 发送解析错误事件
            this.emit('error', { type: 'parse_error', error })
          }
        }

        this.ws.onclose = (event) => {
          logger.info(`WebSocket: Disconnected (code: ${event.code}, reason: ${event.reason})`)
          this.isConnected = false
          this.isConnecting = false
          this.stopHeartbeat()
          // 发送断开连接事件
          this.emit('disconnected', { code: event.code, reason: event.reason })
          if (this.autoReconnect) {
            // 只在非正常关闭时重连
            if (event.code !== 1000) { // 1000 = Normal Closure
              this.scheduleReconnect()
            }
          }
        }

        this.ws.onerror = (error) => {
          this._consecutiveFailures++

          // 连续失败达到阈值 → 标记后端不可达，停止所有重连
          if (this._consecutiveFailures >= WebSocketService.MAX_CONSECUTIVE_FAILURES && !this._backendUnreachable) {
            this._backendUnreachable = true
            // 持久化到 sessionStorage，跨 HMR 生效（5 分钟有效期）
            const STORAGE_KEY = 'ws_backend_unreachable_until'
            sessionStorage.setItem(STORAGE_KEY, String(Date.now() + 5 * 60 * 1000))
            logger.warn(`WebSocket: 后端不可达（连续 ${this._consecutiveFailures} 次失败），已自动禁用重连。如需恢复请刷新页面或配置 VITE_WEBSOCKET_ENABLED=true`)
            this.emit('backend_unreachable', { consecutiveFailures: this._consecutiveFailures })
          }

          // 去重：同一重连周期内只记录一次错误，避免控制台刷屏
          const now = Date.now()
          if (!this._lastErrorLogTime || now - this._lastErrorLogTime > 10000) {
            this._lastErrorLogTime = now
            const errorInfo = {
              type: error.type,
              message: 'WebSocket error',
              attempt: this.reconnectAttempts,
              maxAttempts: this.maxReconnectAttempts,
              consecutiveFailures: this._consecutiveFailures,
            }
            logger.error('WebSocket: Error', errorInfo)
          }
          // 发送错误事件
          this.emit('error', { type: 'connection_error', error: { type: error.type, message: 'WebSocket error' } })
          this.isConnecting = false
          resolve(false)
        }

      } catch (error) {
        this._consecutiveFailures++

        if (this._consecutiveFailures >= WebSocketService.MAX_CONSECUTIVE_FAILURES && !this._backendUnreachable) {
          this._backendUnreachable = true
          const STORAGE_KEY = 'ws_backend_unreachable_until'
          sessionStorage.setItem(STORAGE_KEY, String(Date.now() + 5 * 60 * 1000))
          logger.warn(`WebSocket: 后端不可达（连续 ${this._consecutiveFailures} 次失败），已自动禁用重连`)
        }

        // 提取错误信息，避免直接传递Error对象
        const errorInfo = {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
        logger.error('WebSocket: Connection error', errorInfo)
        // 发送连接错误事件
        this.emit('error', { type: 'connection_error', error: errorInfo })
        this.isConnecting = false
        resolve(false)
      }
    })
  }

  disconnect() {
    this.autoReconnect = false
    this.stopHeartbeat()

    // 清理批量处理定时器
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    // 清理重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    // 清理消息缓冲区
    this.messageBuffer = []

    // 关闭WebSocket连接
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.isConnected = false
    this.isConnecting = false
  }

  private scheduleReconnect() {
    // 后端不可达 → 不再调度重连
    if (this._backendUnreachable) {
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('WebSocket: Max reconnect attempts reached')
      this.emit('reconnect_failed', {
        attempts: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      })
      return
    }

    // 指数退避策略：1s, 2s, 4s, 8s, 16s, 30s
    const baseDelay = 1000
    const maxDelay = 30000
    const delay = Math.min(maxDelay, baseDelay * Math.pow(2, this.reconnectAttempts)) + Math.random() * 1000

    logger.info(`WebSocket: Scheduling reconnect in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`)

    // 发送重连尝试事件
    this.emit('reconnect_attempt', {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: this.maxReconnectAttempts,
      delay: Math.round(delay),
    })

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.connect().then((connected) => {
        if (connected) {
          logger.info('WebSocket: Reconnect successful')
          this.emit('reconnect_success', {})
        } else {
          logger.warn('WebSocket: Reconnect failed, scheduling next attempt')
        }
      })
    }, delay)
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        try {
          this.ws.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now(),
          }))
        } catch (error) {
          logger.error('WebSocket: Error sending heartbeat', { error })
        }
      }
    }, 30000)
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private handleMessage(message: WebSocketMessage) {
    this.stats.messagesReceived++

    // 处理心跳响应（不参与批量处理）
    if (message.type === 'pong') {
      this.lastHeartbeat = Date.now()
      this.emit('heartbeat', { timestamp: message.timestamp })
      return
    }

    // 处理连接建立（不参与批量处理）
    if (message.type === 'connection_established') {
      logger.info('WebSocket: Connection established', message)
      this.emit('connection_established', message.data)
      return
    }

    // 处理错误消息（不参与批量处理）
    if (message.type === 'error') {
      logger.error('WebSocket: Server error', message.data)
      this.emit('error', { type: 'server_error', error: message.data })
      return
    }

    // 如果启用批量处理，将消息加入缓冲区
    if (this.batchProcessing) {
      this.messageBuffer.push(message)
      this.scheduleBatchProcessing()
    } else {
      // 立即处理消息
      this.processMessageImmediately(message)
    }
  }

  private scheduleBatchProcessing() {
    if (this.batchTimer) return

    this.batchTimer = setTimeout(() => {
      this.flushMessageBuffer()
    }, this.batchInterval)
  }

  private flushMessageBuffer() {
    if (this.messageBuffer.length === 0) {
      this.batchTimer = null
      return
    }

    const messages = [...this.messageBuffer]
    this.messageBuffer = []
    this.batchTimer = null

    // 调用批量消息处理器
    this.batchMessageHandlers.forEach(handler => {
      try {
        handler(messages)
      } catch (error) {
        logger.error('WebSocket: Error in batch message handler', { error })
      }
    })

    // 单独处理每条消息
    messages.forEach(message => {
      this.processMessageImmediately(message)
    })
  }

  private processMessageImmediately(message: WebSocketMessage) {
    // 处理用户状态更新
    if (message.type === 'user_status') {
      logger.info('WebSocket: User status update', message)
      this.emit('user_status', message.data)
    }

    // 处理数据更新
    if (message.type === 'data_update') {
      logger.info('WebSocket: Data update', message)
      this.emit('data_update', message.data)
    }

    // 处理特定频道的消息
    if (message.channel) {
      this.emit(message.channel, message.data)
    }

    // 调用所有消息处理器
    this.messageHandlers.forEach(handler => {
      try {
        handler(message)
      } catch (error) {
        logger.error('WebSocket: Error in message handler', { error })
      }
    })

    // 调用频道订阅处理器
    this.channelSubscriptions.forEach(subscription => {
      if (this.messageMatchesChannel(message, subscription.channel)) {
        try {
          subscription.handler(message)
        } catch (error) {
          logger.error('WebSocket: Error in channel handler', { error })
        }
      }
    })
  }

  private messageMatchesChannel(message: WebSocketMessage, channel: string): boolean {
    // 实现频道匹配逻辑
    if (channel === '*') return true
    if (channel === message.type) return true
    if (message.type === 'data_update' && message.data?.entity_type === channel) return true
    return false
  }

  send(message: Record<string, unknown>): boolean {
    if (!this.isConnected || !this.ws) {
      logger.warn('WebSocket: Not connected, cannot send message')
      this.emit('send_failed', { message, error: 'Not connected' })
      return false
    }

    try {
      const messageStr = JSON.stringify(message)
      this.ws.send(messageStr)
      // 记录发送的消息
      this.stats.messagesSent++
      this.stats.bytesSent += messageStr.length
      return true
    } catch (error) {
      logger.error('WebSocket: Error sending message', { error })
      this.emit('send_failed', { message, error })
      // 尝试重新连接
      if (!this.isConnecting) {
        this.scheduleReconnect()
      }
      return false
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler)
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler)
    }
  }

  onBatchMessage(handler: BatchMessageHandler): () => void {
    this.batchMessageHandlers.push(handler)
    return () => {
      this.batchMessageHandlers = this.batchMessageHandlers.filter(h => h !== handler)
    }
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    const subscription: ChannelSubscription = { channel, handler }
    this.channelSubscriptions.push(subscription)
    return () => {
      this.channelSubscriptions = this.channelSubscriptions.filter(
        sub => sub.channel !== channel || sub.handler !== handler,
      )
    }
  }

  unsubscribe(channel: string) {
    this.channelSubscriptions = this.channelSubscriptions.filter(
      sub => sub.channel !== channel,
    )
  }

  getIsConnected(): boolean {
    return this.isConnected
  }

  getConnectionId(): string {
    return this.connectionId
  }

  on(event: string, _handler: (data?: Record<string, unknown>) => void): () => void {
    // 这里简单实现事件订阅，实际项目中可能需要更复杂的事件系统
    logger.info(`WebSocket subscribe to event: ${event}`)
    return () => {
      logger.info(`WebSocket unsubscribe from event: ${event}`)
    }
  }

  private emit(event: string, data?: Record<string, unknown>) {
    // 这里简单实现事件发送，实际项目中可能需要更复杂的事件系统
    logger.info(`WebSocket event: ${event}`, data)
  }
}

/**
 * 检查是否应该启用 WebSocket
 * 默认禁用 — 需要显式配置 VITE_WEBSOCKET_ENABLED=true 才启用
 */
const shouldEnableWebSocket = (): boolean => {
  const wsEnabled = import.meta.env.VITE_WEBSOCKET_ENABLED || import.meta.env.VITE_ENABLE_WEBSOCKET
  // 只有显式设置为 true/1 才启用，其他所有情况（未配置/false/其他值）均禁用
  return wsEnabled === 'true' || wsEnabled === '1'
}

/**
 * 创建一个降级的 WebSocket 服务（不实际连接）
 */
class NoOpWebSocketService {
  connect(): Promise<boolean> {
    logger.info('WebSocket: WebSocket is disabled, using no-op service')
    return Promise.resolve(false)
  }

  disconnect() {}

  send(): boolean {
    logger.warn('WebSocket: WebSocket is disabled, cannot send message')
    return false
  }

  onMessage(): () => void {
    return () => {}
  }

  onBatchMessage(): () => void {
    return () => {}
  }

  subscribe(): () => void {
    return () => {}
  }

  unsubscribe() {}

  getIsConnected(): boolean {
    return false
  }

  getConnectionId(): string {
    return 'no-op'
  }

  on(): () => void {
    return () => {}
  }
}

// 创建全局WebSocket服务实例 — 从 VITE_BACKEND_URL 动态推导 WS 地址
const _backendUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000').replace(/^https?/, 'ws')
const wsUrl = import.meta.env.VITE_WS_URL || `${_backendUrl}/api/v1/ws`

export const wsService = shouldEnableWebSocket()
  ? new WebSocketService({
      url: wsUrl,
      autoReconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      batchProcessing: true,
      batchInterval: 100,
    })
  : new NoOpWebSocketService() as unknown as WebSocketService

// 导出便捷方法
export const connectWebSocket = async () => {
  return await wsService.connect()
}

export const disconnectWebSocket = () => {
  wsService.disconnect()
}

export const sendWebSocketMessage = (message: any) => {
  return wsService.send(message)
}

export const onWebSocketMessage = (handler: MessageHandler) => {
  return wsService.onMessage(handler)
}

export const subscribeToChannel = (channel: string, handler: MessageHandler) => {
  return wsService.subscribe(channel, handler)
}

export const unsubscribeFromChannel = (channel: string) => {
  wsService.unsubscribe(channel)
}
