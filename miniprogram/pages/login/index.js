/**
 * 登录页面
 */
const auth = require('../../utils/auth');

Page({
  data: {
    loading: false,
    agreed: false
  },
  
  onLoad() {
    if (auth.isLoggedIn()) {
      this.redirectHome();
    }
  },
  
  async handleLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意用户协议', icon: 'none' });
      return;
    }
    
    this.setData({ loading: true });
    
    try {
      const { code } = await wx.login();
      const result = await auth.login(code);
      
      if (result.success) {
        this.redirectHome();
      } else {
        throw result.error;
      }
    } catch (error) {
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  
  agreeChange(e) {
    this.setData({ agreed: e.detail.value.length > 0 });
  },
  
  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/index' });
  },
  
  goPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/index' });
  },
  
  redirectHome() {
    wx.navigateTo({ url:"/pages/index/index" });
  }
});
