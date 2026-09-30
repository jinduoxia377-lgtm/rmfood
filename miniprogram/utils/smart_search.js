/**
 * RMFOOD 搜索增强系统
 * 提供智能搜索体验
 */

class SmartSearch {
  constructor() {
    this.history = []
    this.hotKeywords = []
    this.suggestions = []
    this.maxHistory = 10
  }

  /**
   * 初始化搜索
   */
  init() {
    this.loadHistory()
    this.loadHotKeywords()
  }

  /**
   * 加载搜索历史
   */
  loadHistory() {
    try {
      const history = wx.getStorageSync('search_history')
      if (history) {
        this.history = JSON.parse(history)
      }
    } catch (e) {
      console.error('[SmartSearch] Load history failed:', e)
    }
  }

  /**
   * 加载热词
   */
  loadHotKeywords() {
    try {
      const keywords = wx.getStorageSync('hot_keywords')
      if (keywords) {
        this.hotKeywords = JSON.parse(keywords)
      }
    } catch (e) {
      console.error('[SmartSearch] Load hot keywords failed:', e)
    }
  }

  /**
   * 保存搜索历史
   */
  saveHistory(query) {
    if (!query || query.trim() === '') return
    
    // 去重
    this.history = this.history.filter(h => h !== query)
    
    // 添加到开头
    this.history.unshift(query.trim())
    
    // 限制数量
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory)
    }
    
    wx.setStorageSync('search_history', JSON.stringify(this.history))
  }

  /**
   * 清除搜索历史
   */
  clearHistory() {
    this.history = []
    wx.removeStorageSync('search_history')
  }

  /**
   * 删除单条历史
   */
  deleteHistory(index) {
    this.history.splice(index, 1)
    wx.setStorageSync('search_history', JSON.stringify(this.history))
  }

  /**
   * 获取联想词
   */
  getSuggestions(query, limit = 5) {
    if (!query) return []
    
    // 这里可以调用后端API获取联想词
    // 暂时返回模拟数据
    const suggestions = [
      `${query}配方`,
      `${query}功效`,
      `${query}禁忌`,
      `如何食用${query}`,
      `${query}搭配`
    ]
    
    return suggestions.slice(0, limit)
  }

  /**
   * 搜索食材
   */
  searchIngredients(query, options = {}) {
    const {
      category = null,
      nature = null,
      flavor = null,
      limit = 20
    } = options
    
    // 实现搜索逻辑
    return []
  }

  /**
   * 搜索配方
   */
  searchFormulas(query, options = {}) {
    const {
      category = null,
      score = null,
      limit = 20
    } = options
    
    // 实现搜索逻辑
    return []
  }

  /**
   * 复合搜索
   */
  hybridSearch(query, options = {}) {
    const {
      types = ['ingredient', 'formula'],
      limit = 20
    } = options
    
    const results = {}
    
    if (types.includes('ingredient')) {
      results.ingredients = this.searchIngredients(query, options)
    }
    
    if (types.includes('formula')) {
      results.formulas = this.searchFormulas(query, options)
    }
    
    return results
  }

  /**
   * 搜索统计
   */
  getSearchStats() {
    return {
      totalSearches: this.history.length,
      recentQueries: this.history.slice(0, 5),
      hotKeywords: this.hotKeywords.slice(0, 10)
    }
  }

  /**
   * 清空数据
   */
  clearAll() {
    this.clearHistory()
    this.hotKeywords = []
  }
}

// 单例模式
let instance = null

export function getSmartSearch() {
  if (!instance) {
    instance = new SmartSearch()
  }
  return instance
}

export default SmartSearch
