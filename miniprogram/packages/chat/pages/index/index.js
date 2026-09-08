// AI对话页面逻辑 - 深度开发版
const app = getApp()
const api = require('../../../../utils/api.js')
const aiChat = require('../../../../utils/ai_chat.js')
const { showLoading, hideLoading, showError, showSuccess } = require('../../../../utils/helpers.js')
const { getWebSocketManager } = require('../../../../utils/websocket')
const { getMicroAnimationManager } = require('../../../../utils/micro_animation')

// 消息类型
const MSG_TYPE_TEXT = 'text'
const MSG_TYPE_FORMULA = 'formula'
const MSG_TYPE_IMAGE = 'image'
const MSG_TYPE_QUICK = 'quick'
const MSG_TYPE_TYPING = 'typing'

Page({
  data: {
    messages: [],
    inputValue: '',
    isTyping: false,
    scrollToView: '',
    statusBarHeight: 0,
    safeAreaBottom: 0,
    userInfo: null,
    sessionId: null,
    hasHistory: false,
    conversationTitle: '新对话',
    menuOpen: false,
    // 快速开始问题
    quickStarts: [
      { text: '我最近睡眠不好', icon: 'sleep' },
      { text: '我想改善脾胃虚弱', icon: 'digest' },
      { text: '长期熬夜眼睛干涩', icon: 'eye' },
      { text: '体质偏寒手脚冰凉', icon: 'cold' },
      { text: '想要增强免疫力', icon: 'immune' },
      { text: '辅助降尿酸', icon: 'urate' }
    ],
    messageCount: 0,
    maxHistory: 50
  },

  currentSessionId: null,
  conversationHistory: [],
  wsManager: null,
  isWsConnected: false,

  onLoad() {
    const systemInfo = wx.getWindowInfo()
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight,
      safeAreaBottom: systemInfo.safeArea?.bottom || 0
    })
    this.loadUserInfo()
    this.loadHistory()
    this.initSession()
    this.initWebSocket()
    this.initAnimations()
  },

  onShow() {
    this.scrollToBottom()
    this.reconnectWebSocket()
  },

  onHide() {
    this.saveCurrentSession()
    this.closeWebSocket()
  },

  onUnload() {
    this.clearSession()
    this.closeWebSocket()
  },

  /**
   * 初始化动效
   */
  initAnimations() {
    const manager = getMicroAnimationManager()
    manager.playEnterAnimation(this, '.welcome-section', 'slide-up', 200)
  },

  /**
   * 初始化WebSocket连接
   */
  initWebSocket() {
    try {
      this.wsManager = getWebSocketManager()
      const wsUrl = `${app.globalData.baseUrl.replace('http', 'ws')}/chat/ws`

      this.wsManager.on('open', () => {
        console.log('[Chat] WebSocket connected')
        this.setData({ isWsConnected: true })
        this.reconnectWebSocket()
      })

      this.wsManager.on('message', (data) => {
        this.handleWebSocketMessage(data)
      })

      this.wsManager.on('error', (err) => {
        console.error('[Chat] WebSocket error:', err)
        this.setData({ isWsConnected: false })
      })

      this.wsManager.on('close', () => {
        console.log('[Chat] WebSocket closed')
        this.setData({ isWsConnected: false })
      })

      this.wsManager.connect(wsUrl)
    } catch (error) {
      console.error('[Chat] Init WebSocket failed:', error)
    }
  },

  /**
   * 重连WebSocket
   */
  reconnectWebSocket() {
    if (this.wsManager && this.currentSessionId) {
      this.wsManager.send({
        type: 'reconnect',
        sessionId: this.currentSessionId
      })
    }
  },

  /**
   * 关闭WebSocket
   */
  closeWebSocket() {
    if (this.wsManager) {
      this.wsManager.close()
    }
  },

  /**
   * 处理WebSocket消息
   */
  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'typing':
        this.setData({ isTyping: true })
        break
      case 'message':
        this.addMessage('assistant', data.content, {
          type: data.formula ? MSG_TYPE_FORMULA : MSG_TYPE_TEXT,
          formula: data.formula
        })
        break
      case 'formula':
        this.addMessage('assistant', data.content, {
          type: MSG_TYPE_FORMULA,
          formula: data.formula
        })
        break
      case 'error':
        wx.showToast({ title: data.message || '发送失败', icon: 'none' })
        this.setData({ isTyping: false })
        break
      case 'connected':
        this.setData({ isWsConnected: true })
        break
      default:
        console.log('[Chat] Unknown message type:', data.type)
    }
  },

  /**
   * 通过WebSocket发送消息
   */
  sendViaWebSocket(content) {
    if (!this.wsManager || !this.isWsConnected) {
      return false
    }

    this.wsManager.send({
      type: 'message',
      content: content,
      sessionId: this.currentSessionId
    })

    return true
  },

  // 初始化会话
  async initSession() {
    try {
      const cachedSession = wx.getStorageSync('current_session_id')
      if (cachedSession) {
        this.currentSessionId = cachedSession
        this.setData({ hasHistory: true })
        await this.loadSessionHistory(cachedSession)
        return
      }
      await this.createNewSession()
    } catch (error) {
      console.error('初始化会话失败:', error)
      await this.createNewSession()
    }
  },

  // 创建新会话
  async createNewSession() {
    try {
      const res = await aiChat.createSession()
      this.currentSessionId = res.sessionId
      this.conversationHistory = []
      wx.setStorageSync('current_session_id', res.sessionId)
      this.addWelcomeMessage(res.welcomeMessage)
    } catch (error) {
      console.error('创建会话失败:', error)
      this.addWelcomeMessage('您好！我是RMFOOD AI食疗顾问。请告诉我您的健康目标或症状，我将为您制定个性化食疗方案。')
    }
  },

  // 加载会话历史
  async loadSessionHistory(sessionId) {
    try {
      const history = wx.getStorageSync('session_' + sessionId)
      if (history && history.length > 0) {
        this.setData({ 
          messages: history,
          hasHistory: true,
          messageCount: history.length
        })
        this.conversationHistory = history
      } else {
        await this.createNewSession()
      }
    } catch (error) {
      await this.createNewSession()
    }
  },

  // 加载用户信息
  loadUserInfo() {
    try {
      const userInfo = wx.getStorageSync('user_info') || app.globalData.userInfo
      if (userInfo) {
        this.setData({ userInfo })
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  },

  // 加载本地历史对话
  async loadHistory() {
    try {
      const historyList = wx.getStorageSync('chat_history') || []
      if (historyList.length > 0) {
        this.showHistoryReminder(historyList[0])
      }
    } catch (error) {
      console.error('加载历史失败:', error)
    }
  },

  // 显示历史对话提醒
  showHistoryReminder(session) {
    wx.showModal({
      title: '继续上次对话？',
      content: `上次对话：${session.title || '健康咨询'}`,
      confirmText: '继续',
      cancelText: '新对话',
      success: (res) => {
        if (res.confirm) {
          this.loadSessionHistory(session.session_id)
        } else {
          this.createNewSession()
        }
      }
    })
  },

  // 添加欢迎消息
  addWelcomeMessage(content) {
    this.addMessage('assistant', content, { type: MSG_TYPE_TEXT })
  },

  // 输入处理
  onInput(e) {
    this.setData({ 
      inputValue: e.detail.value,
      hasHistory: this.data.messages.length > 0
    })
  },

  // 发送消息
  async onSend() {
    const content = this.data.inputValue.trim()
    if (!content) return

    // 检查是否包含图片
    if (content.startsWith('[图片]')) {
      this.handleImageMessage(content)
      return
    }

    // 添加用户消息
    this.addMessage('user', content, { type: MSG_TYPE_TEXT })
    this.setData({ inputValue: '' })

    // 显示加载中
    this.setData({ isTyping: true })
    this.scrollToBottom()

    // 尝试通过WebSocket发送
    const wsSent = this.sendViaWebSocket(content)

    if (!wsSent) {
      // WebSocket不可用时，使用轮询方式
      await this.sendMessageToServer(content)
    } else {
      // WebSocket已发送，等待响应
      this.setData({ isTyping: false })
    }
  },

  /**
   * 通过服务器发送消息（备用方案）
   */
  async sendMessageToServer(content) {
    try {
      const result = await aiChat.sendMessage(content, this.onStreamChunk.bind(this))

      this.addMessage('assistant', result.reply, {
        type: result.formula ? MSG_TYPE_FORMULA : MSG_TYPE_TEXT,
        formula: result.formula,
        structured: result.structured
      })

      // 更新对话标题
      this.updateConversationTitle(content)

      // 保存对话
      this.saveCurrentSession()
    } catch (error) {
      console.error('发送消息失败:', error)
      this.addMessage('assistant', '抱歉，服务暂时不可用，请稍后重试。', { type: MSG_TYPE_TEXT })
    } finally {
      this.setData({ isTyping: false })
      this.scrollToBottom()
    }
  },

  // 流式输出回调
  onStreamChunk(chunk) {
    const messages = [...this.data.messages]
    const lastMsg = messages[messages.length - 1]
    if (lastMsg && lastMsg.role === 'assistant') {
      lastMsg.content += chunk
      this.setData({ messages })
      this.scrollToBottom()
    }
  },

  // 处理图片消息
  handleImageMessage(content) {
    const imagePath = content.replace('[图片] ', '')
    this.addMessage('user', '[图片]', { type: MSG_TYPE_IMAGE, imagePath })
    
    // 跳转到配料分析
    wx.navigateTo({
      url: `/packages/ingredient/pages/analysis/index?imagePath=${encodeURIComponent(imagePath)}`
    })
  },

  // 添加消息
  addMessage(role, content, options = {}) {
    const message = {
      id: ++this.data.messageCount,
      role,
      content,
      type: options.type || MSG_TYPE_TEXT,
      timestamp: new Date().toISOString(),
      formula: options.formula || null,
      structured: options.structured || null,
      imagePath: options.imagePath || null
    }
    
    const messages = [...this.data.messages]
    messages.push(message)
    
    // 限制消息数量
    if (messages.length > this.data.maxHistory) {
      messages.splice(0, messages.length - this.data.maxHistory)
    }
    
    this.setData({ 
      messages, 
      hasHistory: messages.length > 0,
      messageCount: messages.length
    })
    this.scrollToBottom()
  },

  // 更新对话标题
  updateConversationTitle(userMsg) {
    const title = userMsg.substring(0, 20) + (userMsg.length > 20 ? '...' : '')
    wx.setStorageSync('current_session_title', title)
  },

  // 快速开始
  quickStart(e) {
    const item = e.currentTarget.dataset.item
    this.setData({ inputValue: item.text })
    this.onSend()
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({ inputValue: `[图片] ${tempFilePath}` })
      }
    })
  },

  // 查看配方详情
  showFormulaDetail(e) {
    const formula = e.currentTarget.dataset.formula
    wx.navigateTo({
      url: `/packages/formulas/pages/detail/index?id=${formula.id}`
    })
  },

  // 清空对话
  clearChat() {
    wx.showModal({
      title: '清空对话',
      content: '确定要清空所有对话记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ 
            messages: [], 
            hasHistory: false,
            messageCount: 0 
          })
          this.clearSession()
          this.createNewSession()
        }
        this.toggleMenu()
      }
    })
  },

  // 新建对话
  newChat() {
    this.clearSession()
    this.createNewSession()
    this.toggleMenu()
  },

  // 保存当前会话
  async saveCurrentSession() {
    try {
      if (this.currentSessionId && this.data.messages.length > 0) {
        // 保存到本地
        const sessionData = {
          session_id: this.currentSessionId,
          title: wx.getStorageSync('current_session_title') || '新对话',
          messages: this.data.messages,
          updated_at: new Date().toISOString()
        }
        
        // 更新会话列表
        const historyList = wx.getStorageSync('chat_history') || []
        const existIndex = historyList.findIndex(s => s.session_id === this.currentSessionId)
        if (existIndex >= 0) {
          historyList[existIndex] = sessionData
        } else {
          historyList.unshift(sessionData)
        }
        
        // 限制历史记录数量
        if (historyList.length > 20) {
          historyList.splice(20)
        }
        
        wx.setStorageSync('chat_history', historyList)
        wx.setStorageSync('session_' + this.currentSessionId, this.data.messages)
        
        // 同步到后端
        try {
          await api.ai.saveSession(this.currentSessionId, this.data.messages)
        } catch (e) {
          console.error('同步到后端失败:', e)
        }
      }
    } catch (error) {
      console.error('保存会话失败:', error)
    }
  },

  // 清理会话
  clearSession() {
    this.currentSessionId = null
    wx.removeStorageSync('current_session_id')
    wx.removeStorageSync('current_session_title')
  },

  // 切换菜单
  toggleMenu() {
    this.setData({ menuOpen: !this.data.menuOpen })
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      this.setData({
        scrollToView: 'message-' + (this.data.messages.length - 1)
      })
    }, 100)
  },

  // 获取消息类型类名
  getMessageTypeClass(type) {
    const classes = {
      [MSG_TYPE_TEXT]: 'message-text',
      [MSG_TYPE_FORMULA]: 'message-formula',
      [MSG_TYPE_IMAGE]: 'message-image'
    }
    return classes[type] || 'message-text'
  },

  // 跳转到个人中心
  goToProfile() {
    wx.switchTab({ url: '/pages/profile/index/index' })
  },

  // 跳转到历史记录
  goToHistory() {
    this.toggleMenu()
    wx.navigateTo({ url: '/pages/profile/history/index' })
  },

  // 跳转到配方库
  goToFormulas() {
    this.toggleMenu()
    wx.navigateTo({ url: '/packages/formulas/pages/index/index' })
  },

  // 跳转到设置
  goToSettings() {
    this.toggleMenu()
    wx.navigateTo({ url: '/pages/settings/index' })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'RMFOOD - AI食疗顾问',
      path: '/packages/chat/pages/index/index',
      imageUrl: ''
    }
  }
})
