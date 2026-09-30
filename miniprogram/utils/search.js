/**
 * 搜索管理工具
 */

const HISTORY_KEY = 'rmfood_search_history'
const MAX_HISTORY = 20
const config = require('../config/api')

class SearchManager {
  constructor() {
    this.history = []
    this._loadHistory()
  }

  _loadHistory() {
    try {
      const data = wx.getStorageSync(HISTORY_KEY)
      this.history = data ? JSON.parse(data) : []
    } catch (e) {
      this.history = []
    }
  }

  _saveHistory() {
    wx.setStorageSync(HISTORY_KEY, JSON.stringify(this.history))
  }

  addHistory(keyword) {
    if (!keyword || keyword.trim() === '') return
    
    this.history = this.history.filter(h => h !== keyword.trim())
    this.history.unshift(keyword.trim())
    
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY)
    }
    
    this._saveHistory()
  }

  getHistory() {
    return this.history
  }

  clearHistory() {
    this.history = []
    this._saveHistory()
  }

  async search(keyword, options = {}) {
    this.addHistory(keyword)
    
    try {
      const response = await wx.request({
        url: `${config.baseUrl}/search`,
        method: 'POST',
        data: { keyword, ...options }
      })
      
      if (response.data.success) {
        return response.data.data
      }
    } catch (e) {
      throw e
    }
  }

  async getHotSearches() {
    try {
      const response = await wx.request({
        url: `${config.baseUrl}/search/hot`
      })
      
      if (response.data.success) {
        return response.data.data || []
      }
    } catch (e) {
      return ['枸杞', '黄芪', '人参', '当归', '红枣']
    }
  }
}

module.exports = new SearchManager()
