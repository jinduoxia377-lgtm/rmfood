// 历史记录页逻辑
Page({
  data: {
    historyList: []
  },

  onLoad() {
    this.loadHistory()
  },

  loadHistory() {
    const cachedHistory = wx.getStorageSync('analysis_history') || []
    this.setData({ historyList: cachedHistory })
  },

  getScoreColor(score) {
    if (score >= 85) return '#4CAF50'
    if (score >= 70) return '#8BC34A'
    if (score >= 50) return '#FFC107'
    if (score >= 30) return '#FF9800'
    return '#F44336'
  }
})
