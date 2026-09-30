// pages/profile/history/index.js
Page({
  data: {
    history: []
  },
  onLoad() {
    this.loadHistory()
  },
  loadHistory() {
    const history = wx.getStorageSync('search_history') || []
    this.setData({ history })
  }
})
