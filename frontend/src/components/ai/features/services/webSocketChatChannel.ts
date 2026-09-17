/**
 * WebSocketChatChannel — WebSocket 实时消息通道（带自动重连）
 *
 * 参照 DeepSeek Harness WebSocket 设计：
 * - 断线后指数退避重连（1s → 2s → 4s → ... → 30s）
 * - 重连期间消息排队，恢复后批量补发
 * - 心跳保活防止 NAT/代理超时断开
 *
 * @version 1.0.0
 */

import { logger } from '@/utils/safeLogger'

export type WSMessageType = 'message:sending' | 'message:received' | 'message:error' | 'auth:required'
export interface WSMessage<T = unknown> {
  type: WSMessageType
  payload: T
  seq?: number
}

export interface WebSocketOptions {
  baseUrl: string
  reconnectBaseDelayMs?: number
  reconnectMaxDelayMs?: number
  heartbeatIntervalMs?: number
  maxQueueSize?: number
  onMessage?: (type: WSMessageType, payload: unknown) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  onClose?: (code: number, reason: string) => void
}

const DEFAULTS = {
  reconnectBaseDelayMs: 1000,
  reconnectMaxDelayMs: 30_000,
  heartbeatIntervalMs: 25_000,
  maxQueueSize: 50,
}

export class WebSocketChatChannel {
  private ws: WebSocket | null = null
  private options: Required<WebSocketOptions>
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private messageQueue: Array<WSMessage> = []
  private isReady = false
  private listeners = new Map<WSMessageType, Set<(payload: unknown) => void>>()

  constructor(options: WebSocketOptions) {
    this.options = { ...DEFAULTS, ...options } as Required<WebSocketOptions>
    this.start()
  }

  /** 建立连接 */
  start(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.close(false)
    this.connect()
  }

  /** 主动断开 */
  stop(): void {
    this.close(true)
  }

  /** 发送消息（排队如果未连接） */
  send(type: WSMessageType, payload: unknown): void {
    const msg: WSMessage = { type, payload, seq: Date.now() }
    if (this.isReady && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    } else {
      if (this.messageQueue.length >= this.options.maxQueueSize) {
        this.messageQueue.shift() // 丢弃最老的
      }
      this.messageQueue.push(msg)
      logger.debug('[WS] 消息已排队:', type)
    }
  }

  /** 注册消息监听 */
  on(type: WSMessageType, handler: (payload: unknown) => void): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type)!.add(handler)
    return () => this.listeners.get(type)?.delete(handler)
  }

  /** 订阅所有消息类型 */
  subscribe(handler: (type: WSMessageType, payload: unknown) => void): () => void {
    const wrapper = (type: WSMessageType, payload: unknown) => handler(type, payload)
    this.listeners.set('', new Set([wrapper as any]))
    return () => this.listeners.delete('')
  }

  /** 获取排队消息数 */
  get queueSize(): number {
    return this.messageQueue.length
  }

  /** 获取连接状态 */
  get connected(): boolean {
    return this.isReady && this.ws?.readyState === WebSocket.OPEN
  }

  // ── 内部实现 ──

  private connect(): void {
    const wsUrl = `${this.options.baseUrl.replace('http', 'ws')}chat/stream`
    logger.info('[WS] 尝试连接:', wsUrl)

    try {
      this.ws = new WebSocket(wsUrl)
    } catch (e) {
      logger.warn('[WS] WebSocket 创建失败，计划重连:', e)
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      logger.info('[WS] 连接已建立')
      this.isReady = true
      this.reconnectAttempt = 0
      this.options.onOpen?.()
      this.startHeartbeat()
      this.flushQueue()
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage
        this.dispatch(msg.type, msg.payload)
        this.options.onMessage?.(msg.type, msg.payload)
      } catch (e) {
        logger.warn('[WS] 消息解析失败:', e)
      }
    }

    this.ws.onclose = (event) => {
      logger.warn(`[WS] 连接关闭: code=${event.code} reason=${event.reason}`)
      this.isReady = false
      this.stopHeartbeat()
      this.options.onClose?.(event.code, event.reason ?? '')
      if (!event.wasClean) this.scheduleReconnect()
    }

    this.ws.onerror = (event) => {
      logger.error('[WS] 连接错误:', event)
      this.options.onError?.(event)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    const delay = Math.min(
      this.options.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempt),
      this.options.reconnectMaxDelayMs,
    )
    logger.info(`[WS] 将在 ${delay}ms 后重连 (attempt=${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectAttempt++
      this.connect()
    }, delay)
  }

  private flushQueue(): void {
    if (this.messageQueue.length === 0) return
    const queue = [...this.messageQueue]
    this.messageQueue = []
    for (const msg of queue) {
      this.ws?.send(JSON.stringify(msg))
    }
    logger.info(`[WS] 已补发 ${queue.length} 条排队消息`)
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.isReady && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: '__heartbeat__', seq: Date.now() }))
      }
    }, this.options.heartbeatIntervalMs)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private close(abort: boolean): void {
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      if (abort) this.ws.close(1000, 'manual stop')
      else this.ws.close(1011, 'internal error')
      this.ws = null
    }
    this.isReady = false
  }

  private dispatch(type: WSMessageType, payload: unknown): void {
    this.listeners.get(type)?.forEach(fn => { try { fn(payload) } catch (e) { logger.error('[WS] listener error:', e) } })
    this.listeners.get('')?.forEach(fn => { try { (fn as any)(type, payload) } catch (e) { logger.error('[WS] wildcard listener error:', e) } })
  }

  destroy(): void {
    this.close(true)
    this.listeners.clear()
    this.messageQueue = []
  }
}

// 全局单例
let _channel: WebSocketChatChannel | null = null

export function getWebSocketChannel(): WebSocketChatChannel | null {
  return _channel
}

export function initWebSocket(options: Partial<WebSocketOptions>): void {
  if (_channel) _channel.destroy()
  _channel = new WebSocketChatChannel({ baseUrl: '/api/v1/', ...options })
  logger.info('[WS] WebSocket 通道已初始化')
}

export function destroyWebSocket(): void {
  _channel?.destroy()
  _channel = null
}

export default WebSocketChatChannel
