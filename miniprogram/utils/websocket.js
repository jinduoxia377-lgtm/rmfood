/**
 * WebSocket 实时通信管理器
 * 支持AI对话、实时分析等功能
 */

class WebSocketManager {
  constructor() {
    this.ws = null
    this.url = ''
    this.isConnected = false
    this.reconnectTimer = null
    this.reconnectDelay = 1000
    this.maxReconnectDelay = 30000
    this.pongTimer = null
    this.messageQueue = []
    this.handlers = new Map()
  }

  /**
   * 连接WebSocket
   * @param {string} url - WebSocket地址
   */
  connect(url) {
    if (this.ws) {
      this.close()
    }

    this.url = url
    this.isConnected = false

    try {
      this.ws = wx.connectSocket({
        url: url,
        success: () => {
          console.log('[WebSocket] Connect successful')
        },
        fail: (err) => {
          console.error('[WebSocket] Connect failed:', err)
          this.reconnect()
        }
      })

      this.ws.onOpen(() => {
        console.log('[WebSocket] Connection opened')
        this.isConnected = true
        this.reconnectDelay = 1000
        
        // 发送队列中的消息
        this.flushMessageQueue()
        
        // 开始心跳
        this.startHeartbeat()
        
        // 触发事件
        this.trigger('open', {})
      })

      this.ws.onMessage((res) => {
        this.handleMessage(res.data)
      })

      this.ws.onError((err) => {
        console.error('[WebSocket] Error:', err)
        this.trigger('error', err)
      })

      this.ws.onClose(() => {
        console.log('[WebSocket] Connection closed')
        this.isConnected = false
        this.stopHeartbeat()
        this.trigger('close', {})
        
        // 自动重连
        this.reconnect()
      })
    } catch (error) {
      console.error('[WebSocket] Failed to connect:', error)
      this.reconnect()
    }
  }

  /**
   * 发送消息
   * @param {string|Object} data - 消息内容
   */
  send(data) {
    const message = typeof data === 'string' ? data : JSON.stringify(data)
    
    if (this.isConnected && this.ws) {
      this.ws.send({
        data: message,
        success: () => {
          console.log('[WebSocket] Message sent')
        },
        fail: (err) => {
          console.error('[WebSocket] Send failed:', err)
          this.trigger('error', err)
        }
      })
    } else {
      // 连接断开时加入队列
      this.messageQueue.push(message)
      console.log('[WebSocket] Message queued, count:', this.messageQueue.length)
    }
  }

  /**
   * 处理接收到的消息
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data)
      console.log('[WebSocket] Received:', message)
      
      // 触发对应事件
      if (message.type) {
        this.trigger(message.type, message.data || message)
      }
      
      // 触发通用事件
      this.trigger('message', message)
    } catch (error) {
      console.error('[WebSocket] Parse error:', error)
    }
  }

  /**
   * 注册事件处理器
   * @param {string} event - 事件名
   * @param {Function} handler - 处理函数
   */
  on(event, handler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event).push(handler)
  }

  /**
   * 移除事件处理器
   * @param {string} event - 事件名
   * @param {Function} handler - 处理函数
   */
  off(event, handler) {
    if (!this.handlers.has(event)) return
    
    const handlers = this.handlers.get(event)
    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
    }
  }

  /**
   * 触发事件
   */
  trigger(event, data) {
    if (!this.handlers.has(event)) return
    
    const handlers = this.handlers.get(event)
    handlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error(`[WebSocket] Handler error for ${event}:`, error)
      }
    })
  }

  /**
   * 开始心跳
   */
  startHeartbeat() {
    this.stopHeartbeat()
    
    this.pongTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ type: 'ping' })
      }
    }, 30000)
  }

  /**
   * 停止心跳
   */
  stopHeartbeat() {
    if (this.pongTimer) {
      clearInterval(this.pongTimer)
      this.pongTimer = null
    }
  }

  /**
   * 重连
   */
  reconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    
    const delay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
    this.reconnectDelay = delay
    
    console.log(`[WebSocket] Reconnecting in ${delay}ms...`)
    
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.url)
    }, delay)
  }

  /**
   * 刷新消息队列
   */
  flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift()
      this.send(message)
    }
  }

  /**
   * 关闭连接
   */
  close() {
    this.stopHeartbeat()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    
    this.isConnected = false
    this.messageQueue = []
    console.log('[WebSocket] Connection closed')
  }

  /**
   * 获取连接状态
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      queueSize: this.messageQueue.length,
      handlerCount: this.handlers.size
    }
  }
}

// 导出单例
const wsManager = new WebSocketManager()

module.exports = {
  getWebSocketManager: () => wsManager
}
