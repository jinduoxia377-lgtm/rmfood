/**
 * WebSocket管理器
 * 支持自动重连、心跳检测、消息队列
 */

class WebSocketManager {
  constructor(options = {}) {
    this.url = options.url || '';
    this.token = options.token || '';
    this.ws = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.messageQueue = [];
    this.isReconnecting = false;
    
    this.onOpenCallbacks = [];
    this.onMessageCallbacks = [];
    this.onErrorCallbacks = [];
    this.onCloseCallbacks = [];
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `${this.url}?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isReconnecting = false;
      this._startHeartbeat();
      this._flushMessageQueue();
      this.onOpenCallbacks.forEach(cb => cb());
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessageCallbacks.forEach(cb => cb(data));
      } catch (e) {
        this.onErrorCallbacks.push(new Error('Invalid message'));
      }
    };

    this.ws.onerror = (error) => {
      this.onErrorCallbacks.forEach(cb => cb(error));
    };

    this.ws.onclose = (event) => {
      this._stopHeartbeat();
      this.onCloseCallbacks.forEach(cb => cb(event));
      
      if (!event.wasClean && !this.isReconnecting) {
        this._scheduleReconnect();
      }
    };
  }

  send(data) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      this.messageQueue.push(message);
    }
  }

  _flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(this.messageQueue.shift());
    }
  }

  _startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.isReconnecting = true;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  close() {
    this._stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event, callback) {
    const callbacks = {
      open: this.onOpenCallbacks,
      message: this.onMessageCallbacks,
      error: this.onErrorCallbacks,
      close: this.onCloseCallbacks
    };
    
    if (callbacks[event]) {
      callbacks[event].push(callback);
    }
  }

  off(event, callback) {
    const callbacks = {
      open: this.onOpenCallbacks,
      message: this.onMessageCallbacks,
      error: this.onErrorCallbacks,
      close: this.onCloseCallbacks
    };
    
    if (callbacks[event]) {
      callbacks[event] = callbacks[event].filter(cb => cb !== callback);
    }
  }
}

module.exports = WebSocketManager;
