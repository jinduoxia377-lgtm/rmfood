/**
 * RMFOOD Mini Program - Authentication Module
 */

const request = require('./request.js')
const { showLoading, hideLoading, showSuccess, showError } = require('./helpers.js')

class Auth {
  constructor() {
    this.app = getApp()
  }

  /**
   * WeChat login
   */
  async login() {
    showLoading('Logging in...')

    try {
      const loginRes = await this.getWxLoginCode()
      const code = loginRes.code

      const res = await request.post('/wechat/login', { code })

      if (res) {
        this.saveUserInfo(res)
        showSuccess('Login successful')
        return res
      } else {
        throw new Error(res.message || 'Login failed')
      }
    } catch (error) {
      console.error('[Auth] Login error:', error)
      showError(error.message || 'Login failed, please retry')
      throw error
    } finally {
      hideLoading()
    }
  }

  /**
   * Get WeChat login code
   */
  getWxLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            resolve({ code: res.code })
          } else {
            reject(new Error('Get login code failed'))
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  }

  /**
   * Save user info
   */
  saveUserInfo(userInfo) {
    wx.setStorageSync('user_info', userInfo)
    this.app.globalData.userInfo = userInfo
  }

  /**
   * Get user info
   */
  getUserInfo() {
    return this.app.globalData.userInfo || wx.getStorageSync('user_info') || null
  }

  /**
   * Check if logged in
   */
  isLoggedIn() {
    return !!this.getUserInfo()
  }

  /**
   * Logout
   */
  logout() {
    wx.removeStorageSync('user_info')
    wx.removeStorageSync('access_token')
    this.app.globalData.userInfo = null
    this.app.globalData.accessToken = null
  }
}

module.exports = new Auth()