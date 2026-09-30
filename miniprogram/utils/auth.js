/**
 * 用户认证管理工具
 */

const STORAGE_KEY = 'rmfood_user'
const TOKEN_KEY = 'rmfood_token'
const config = require('../config/api')

class AuthManager {
  getUser() {
    try {
      const userStr = wx.getStorageSync(STORAGE_KEY)
      return userStr ? JSON.parse(userStr) : null
    } catch (e) {
      return null
    }
  }

  getToken() {
    return wx.getStorageSync(TOKEN_KEY) || ''
  }

  isLoggedIn() {
    return !!this.getToken()
  }

  async login(code) {
    try {
      const response = await wx.request({
        url: `${config.baseUrl}/auth/login`,
        method: 'POST',
        data: { code }
      })
      
      if (response.data.success) {
        const { token, user } = response.data.data
        wx.setStorageSync(TOKEN_KEY, token)
        wx.setStorageSync(STORAGE_KEY, JSON.stringify(user))
        return { success: true, user }
      } else {
        throw new Error(response.data.message || '登录失败')
      }
    } catch (error) {
      return { success: false, error }
    }
  }

  logout() {
    wx.removeStorageSync(TOKEN_KEY)
    wx.removeStorageSync(STORAGE_KEY)
  }

  async getUserInfo() {
    const token = this.getToken()
    if (!token) return null
    
    try {
      const response = await wx.request({
        url: `${config.baseUrl}/auth/me`,
        headers: { Authorization: `Bearer ${token}` }
      })
      
      if (response.data.success) {
        wx.setStorageSync(STORAGE_KEY, JSON.stringify(response.data.data))
        return response.data.data
      }
    } catch (e) {
      this.logout()
    }
    return null
  }
}

module.exports = new AuthManager()
