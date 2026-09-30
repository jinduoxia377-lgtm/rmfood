/**
 * RMFOOD 小程序 - 网络请求工具
 * 统一API调用，支持拦截器、重试、缓存
 */

const config = require('../config/api')
const logger = require('./logger')

class Request {
  constructor() {
    this.baseUrl = config.baseUrl
    this.timeout = config.timeout
    this.retryCount = config.retryCount
    this.retryDelay = config.retryDelay
    
    // 拦截器
    this.interceptors = {
      request: [],
      response: []
    }
    
    // 请求缓存
    this.cache = new Map()
    this.cacheDuration = 5 * 60 * 1000 // 5分钟
  }

  /**
   * 注册请求拦截器
   */
  useRequest(interceptor) {
    this.interceptors.request.push(interceptor)
  }

  /**
   * 注册响应拦截器
   */
  useResponse(interceptor) {
    this.interceptors.response.push(interceptor)
  }

  /**
   * 发送请求
   */
  async request(options) {
    const {
      url,
      method = 'GET',
      data = {},
      headers = {},
      cache = false,
      retry = true,
      timeout = this.timeout
    } = options

    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`
    console.log('[Request] baseURL:', this.baseUrl)
    console.log('[Request] fullUrl:', fullUrl)
    console.log('[Request] method:', method)

    // 检查缓存
    if (cache) {
      const cacheKey = `${method}:${fullUrl}:${JSON.stringify(data)}`
      const cached = this.getCache(cacheKey)
      if (cached) {
        logger.debug('Cache hit:', cacheKey)
        return cached
      }
    }

    // 构建请求配置
    const requestConfig = {
      url: fullUrl,
      method,
      data,
      timeout,
      header: {
        'Content-Type': 'application/json',
        'X-Request-Source': 'miniprogram',
        ...headers
      }
    }

    // 添加认证Token
    const token = wx.getStorageSync(config.tokenKey)
    if (token) {
      requestConfig.header['Authorization'] = `Bearer ${token}`
    }

    // 执行请求（带重试）
    const result = retry 
      ? await this._requestWithRetry(requestConfig)
      : await this._executeRequest(requestConfig)

    // 缓存结果
    if (cache) {
      const cacheKey = `${method}:${fullUrl}:${JSON.stringify(data)}`
      this.setCache(cacheKey, result)
    }

    return result
  }

  /**
   * 带重试的请求
   */
  async _requestWithRetry(config, retries = this.retryCount) {
    let lastError
    
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this._executeRequest(config)
        return result
      } catch (error) {
        lastError = error
        
        // 4xx错误不重试
        if (error.statusCode >= 400 && error.statusCode < 500) {
          throw error
        }
        
        // 最后一次重试失败则抛出
        if (i === retries - 1) {
          logger.error('Request failed after', retries, 'attempts:', error)
          throw error
        }
        
        // 指数退避重试
        const delay = this.retryDelay * Math.pow(2, i)
        logger.warn(`Retry ${i + 1}/${retries} in ${delay}ms`)
        await this._sleep(delay)
      }
    }
    
    throw lastError
  }

  /**
   * 执行单次请求
   */
  _executeRequest(config) {
    return new Promise((resolve, reject) => {
      wx.request({
        ...config,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // 业务错误处理 - 只检查标准的错误响应格式
            if (res.data && typeof res.data === 'object' && res.data.code && typeof res.data.code === 'number' && res.data.code !== 200) {
              reject({
                statusCode: res.data.code,
                message: res.data.message || 'Business error',
                data: res.data
              })
            } else {
              // 成功响应 - 直接返回数据
              resolve(res.data || res)
            }
          } else if (res.statusCode === 401) {
            // 未授权，清除Token并重试登录
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
          console.log('[Request] fail:', JSON.stringify(err))
          // 安全获取错误信息
          const errMsg = err && err.errMsg ? err.errMsg : (err && typeof err === 'object' ? JSON.stringify(err) : 'Network error')
          logger.error('Request failed:', errMsg)
          reject({
            statusCode: 0,
            message: errMsg
          })
        }
      })
    })
  }

  /**
   * 处理未授权
   */
  _handleUnauthorized() {
    wx.removeStorageSync(config.tokenKey)
    wx.removeStorageSync(config.userInfoKey)
    
    logger.warn('Token expired, clearing user session')
    
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
   * 缓存管理
   */
  getCache(key) {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() - item.timestamp > this.cacheDuration) {
      this.cache.delete(key)
      return null
    }
    
    return item.data
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  clearCache(key) {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
    }
  }

  /**
   * 延迟函数
   */
  _sleep(ms) {
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
  upload(url, filePath, formData = {}) {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync(config.tokenKey)
      
      wx.uploadFile({
        url: config.uploadUrl + url,
        filePath,
        name: 'file',
        formData,
        header: {
          'Authorization': `Bearer ${token || ''}`
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
          logger.error('Upload failed:', err.errMsg)
          reject(err)
        }
      })
    })
  }
}

// 导出单例
module.exports = new Request()
