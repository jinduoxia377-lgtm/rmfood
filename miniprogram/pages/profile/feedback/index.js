// 意见反馈页面
Page({
  data: {
    content: '',
    contact: '',
    category: '',
    categories: [
      { value: '', label: '请选择反馈类型' },
      { value: 'bug', label: '功能Bug' },
      { value: 'feature', label: '功能建议' },
      { value: 'ui', label: '界面体验' },
      { value: 'content', label: '内容问题' },
      { value: 'other', label: '其他' }
    ],
    submitting: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '意见反馈' })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  onContactInput(e) {
    this.setData({ contact: e.detail.value })
  },

  onCategoryChange(e) {
    this.setData({ category: e.detail.value })
  },

  submitFeedback() {
    const { content, contact, category } = this.data
    
    if (!content.trim()) {
      wx.showToast({ title: '请输入反馈内容', icon: 'none' })
      return
    }
    
    if (content.length < 10) {
      wx.showToast({ title: '反馈内容至少10个字', icon: 'none' })
      return
    }
    
    this.setData({ submitting: true })
    
    // 模拟提交（实际应调用API）
    setTimeout(() => {
      try {
        const records = wx.getStorageSync('feedback_records') || []
        records.unshift({
          content,
          contact,
          category,
          submittedAt: new Date().toISOString()
        })
        if (records.length > 20) records.pop()
        wx.setStorageSync('feedback_records', records)
      } catch (e) {
        console.error('保存反馈记录失败:', e)
      }
      
      this.setData({ submitting: false })
      wx.showToast({ title: '反馈已提交，感谢您的建议！', icon: 'success' })
      
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }, 800)
  },

  clearForm() {
    this.setData({ content: '', contact: '', category: '' })
  },

  onShareAppMessage() {
    return {
      title: 'RMFOOD - 意见反馈',
      path: '/pages/profile/feedback/index'
    }
  }
})
