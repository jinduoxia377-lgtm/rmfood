// 用户协议页面逻辑
Page({
  data: {
    content: ''
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '用户协议' })
  },

  onShareAppMessage() {
    return {
      title: 'RMFOOD 用户协议',
      path: '/pages/index/index'
    }
  }
})
