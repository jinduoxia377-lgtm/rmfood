/**
 * AI对话管理工具
 */

const CHAT_HISTORY_KEY = 'rmfood_chat_history';
const MAX_HISTORY = 50;

class ChatManager {
  constructor() {
    this.messages = [];
    this.history = [];
    this.ws = null;
    this.reconnectTimer = null;
    this.onMessageCallbacks = [];
    this.onErrorCallbacks = [];
  }

  initWebSocket() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    const token = wx.getStorageSync('rmfood_token') || '';
    const url = `wss://api.rmfood.com/ws/chat?token=${token}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleMessage(data);
      } catch (e) {
        this._emitError('Invalid message format');
      }
    };

    this.ws.onerror = (error) => {
      this._emitError('WebSocket error');
    };

    this.ws.onclose = () => {
      this._scheduleReconnect();
    };
  }

  _handleMessage(data) {
    if (data.type === 'chat_response') {
      this.messages.push({
        role: 'assistant',
        content: data.content,
        timestamp: data.timestamp || Date.now()
      });
      
      this._emitMessage('assistant', data.content);
    }
  }

  async sendMessage(content) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.initWebSocket();
      await this._waitForConnection();
    }

    const message = {
      type: 'chat',
      content,
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(message));
    this.messages.push({ role: 'user', content, timestamp: message.timestamp });
    
    this._emitMessage('user', content);
    
    return new Promise((resolve) => {
      this.onMessageCallbacks.push({ role: 'assistant', resolve });
    });
  }

  _waitForConnection(timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const timer = setTimeout(() => reject(new Error('Connection timeout')), timeout);
      const check = setInterval(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          clearInterval(check);
          clearTimeout(timer);
          resolve();
        }
      }, 100);
    });
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.initWebSocket();
    }, 3000);
  }

  _emitMessage(role, content) {
    this.onMessageCallbacks.forEach(cb => {
      if (cb.role === role) cb.resolve(content);
    });
  }

  _emitError(error) {
    this.onErrorCallbacks.forEach(cb => cb(error));
  }

  onMessage(callback) {
    this.onMessageCallbacks.push(callback);
  }

  onError(callback) {
    this.onErrorCallbacks.push(callback);
  }

  getHistory() {
    return this.history;
  }

  clearHistory() {
    this.messages = [];
    this.history = [];
  }

  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = new ChatManager();
