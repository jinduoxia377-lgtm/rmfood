/**
 * RMFOOD 小程序 - HTTP 请求模块
 * 增强版：支持拦截器、错误处理、重试机制
 */

const config = require('../config.js')

class Request {
  constructor() {
    this.baseUrl = config.baseUrl
    this.uploadUrl = config.uploadUrl
    this.debug = config.debug
    this.timeout = config.timeout
    
    // 拦截器
    this.interceptors = {
      request: [],
      response: []
    }
    
    // 重试配置
    this.retryCount = 3
    this.retryDelay = 1000
  }

  /**
   * 注册拦截器
   */
  use(options) {
    if (options.request) {
      this.interceptors.request.push(options.request)
    }
    if (options.response) {
      this.interceptors.response.push(options.response)
    }
  }

  /**
   * 执行请求拦截器
   */
  async runRequestInterceptors(requestConfig) {
    for (const interceptor of this.interceptors.request) {
      try {
        requestConfig = await interceptor({ ...requestConfig }) || requestConfig
      } catch (e) {
        console.warn('[Request] Request interceptor error:', e)
      }
    }
    return requestConfig
  }

  /**
   * 执行响应拦截器
   */
  async runResponseInterceptors(response) {
    for (const interceptor of this.interceptors.response) {
      try {
        response = await interceptor({ ...response }) || response
      } catch (e) {
        console.warn('[Request] Response interceptor error:', e)
      }
    }
    return response
  }

  /**
   * 核心请求方法
   */
  async request(options) {
    // 构建请求配置
    let requestConfig = await this.runRequestInterceptors({
      url: this.baseUrl + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        ...(options.header || {}),
        'X-Request-Source': 'miniprogram'
      },
      timeout: options.timeout || this.timeout
    })

    // 添加认证 Token
    const token = wx.getStorageSync('access_token')
    if (token) {
      requestConfig.header['Authorization'] = `Bearer ${token}`
    }

    // 执行请求（带重试）
    return this._requestWithRetry(requestConfig, options.retry ?? this.retryCount)
  }

  /**
   * 带重试的请求
   */
  async _requestWithRetry(config, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this._executeRequest(config)
        return await this.runResponseInterceptors(result)
      } catch (error) {
        // 4xx 错误不重试
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error
        }
        
        // 最后一次重试抛出错误
        if (i === retries - 1) {
          throw error
        }
        
        // 等待后重试
        await this._delay(this.retryDelay * Math.pow(2, i))
      }
    }
  }

  /**
   * 执行单次请求
   */
  _executeRequest(config) {
    return new Promise((resolve, reject) => {
      wx.request({
        ...config,
        success: (res) => {
          if (res.statusCode === 200) {
            // 业务错误处理
            if (res.data && res.data.code && res.data.code !== 200) {
              reject({
                statusCode: res.data.code,
                message: res.data.message || 'Business error',
                data: res.data
              })
            } else {
              resolve(res.data || res)
            }
          } else if (res.statusCode === 401) {
            // 未授权，清除 Token 并重试登录
            this._handleUnauthorized()
            reject({ statusCode: 401, message: 'Unauthorized' })
          } else {
            reject({
              statusCode: res.statusCode,
              message: res.data?.message || `HTTP ${res.statusCode}`
            })
          }
        },
        fail: (err) => {
          reject({
            statusCode: 0,
            message: err.errMsg || 'Network error'
          })
        }
      })
    })
  }

  /**
   * 处理未授权
   */
  _handleUnauthorized() {
    wx.removeStorageSync('access_token')
    wx.removeStorageSync('user_info')
    getApp().clearUserInfo()
    
    // 跳转到登录页
    wx.showModal({
      title: '登录已过期',
      content: '请重新登录',
      showCancel: false,
      success: () => {
        wx.reLaunch({ url: '/pages/profile/index/index' })
      }
    })
  }

  /**
   * 延迟函数
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ========== 快捷方法 ==========

  get(url, data, options = {}) {
    return this.request({ url, data, method: 'GET', ...options })
  }

  post(url, data, options = {}) {
    return this.request({ url, data, method: 'POST', ...options })
  }

  put(url, data, options = {}) {
    return this.request({ url, data, method: 'PUT', ...options })
  }

  delete(url, options = {}) {
    return this.request({ url, method: 'DELETE', ...options })
  }

  /**
   * 文件上传
   */
  async upload(url, filePath, formData = {}) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: this.uploadUrl + url,
        filePath: filePath,
        name: 'file',
        formData: formData,
        header: {
          'Authorization': `Bearer ${wx.getStorageSync('access_token') || ''}`
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (res.statusCode === 200) {
              resolve(data)
            } else {
              reject(data)
            }
          } catch (e) {
            reject({ message: 'Upload parse error' })
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  }
}

// 导出单例
module.exports = new Request()
