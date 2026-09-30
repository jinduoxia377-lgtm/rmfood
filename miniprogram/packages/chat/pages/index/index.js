// packages/chat/pages/index/index.js
Page({
  data: {
    messages: []
  },
  onLoad() {},
  onSend(e) {
    const content = e.detail.value
    if (!content.trim()) return
    this.setData({
      messages: [...this.data.messages, { type: 'user', content }]
    })
  }
})
