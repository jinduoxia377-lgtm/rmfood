/**
 * 统一API调用工具
 * 集成错误处理、重试、缓存
 */

const request = require('./api')
const errorHandler = require('./error_handler')
const cache = require('./cache_manager')
const config = require('../config/api')

class ApiClient {
  constructor() {
    this.baseURL = config.baseUrl
    this.timeout = config.timeout
  }

  /**
   * 发送请求
   */
  async request(method, url, data = null, options = {}) {
    const { cache: useCache = false, retry = true } = options
    const cacheKey = `${method}:${url}`

    // 尝试从缓存获取
    if (useCache) {
      const cached = cache.get(cacheKey)
      if (cached) return cached
    }

    try {
      const result = await request.request({
        url: `${this.baseURL}${url}`,
        method,
        data,
        timeout: this.timeout,
        headers: {
          'Authorization': `Bearer ${wx.getStorageSync('rmfood_token') || ''}`
        }
      })

      // 缓存结果
      if (useCache) {
        cache.set(cacheKey, result)
      }

      return result
    } catch (error) {
      errorHandler.handle(error, `API:${method}:${url}`)
      throw error
    }
  }

  /**
   * GET请求
   */
  get(url, options = {}) {
    return this.request('GET', url, null, options)
  }

  /**
   * POST请求
   */
  post(url, data, options = {}) {
    return this.request('POST', url, data, options)
  }

  /**
   * PUT请求
   */
  put(url, data, options = {}) {
    return this.request('PUT', url, data, options)
  }

  /**
   * DELETE请求
   */
  delete(url, options = {}) {
    return this.request('DELETE', url, null, options)
  }
}

module.exports = new ApiClient()
