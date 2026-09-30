// 隐私政策页面逻辑
Page({
  data: {
    content: ''
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '隐私政策' })
  },

  onShareAppMessage() {
    return {
      title: 'RMFOOD 隐私政策',
      path: '/pages/index/index'
    }
  }
})
