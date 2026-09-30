// pages/profile/index/index.js
Page({
  data: {
    userInfo: null
  },
  onLoad() {
    this.checkLogin()
  },
  checkLogin() {
    const userInfo = wx.getStorageSync('user_info')
    if (userInfo) {
      this.setData({ userInfo })
    }
  }
})
