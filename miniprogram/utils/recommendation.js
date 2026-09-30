/**
 * RMFOOD 智能推荐系统
 * 基于用户行为的个性化推荐
 */

class RecommendationEngine {
  constructor() {
    this.userProfile = null
    this.behaviorHistory = []
    this.preferences = {}
  }

  /**
   * 初始化推荐引擎
   */
  init() {
    this.loadUserProfile()
    this.loadBehaviorHistory()
  }

  /**
   * 加载用户画像
   */
  loadUserProfile() {
    try {
      const profile = wx.getStorageSync('user_profile')
      if (profile) {
        this.userProfile = JSON.parse(profile)
      }
    } catch (e) {
      console.error('[RecommendationEngine] Load profile failed:', e)
    }
  }

  /**
   * 加载行为历史
   */
  loadBehaviorHistory() {
    try {
      const history = wx.getStorageSync('behavior_history')
      if (history) {
        this.behaviorHistory = JSON.parse(history)
      }
    } catch (e) {
      console.error('[RecommendationEngine] Load history failed:', e)
    }
  }

  /**
   * 记录用户行为
   */
  recordBehavior(behavior) {
    const record = {
      type: behavior.type,
      targetId: behavior.targetId,
      targetName: behavior.targetName,
      category: behavior.category,
      timestamp: Date.now(),
      score: behavior.score || this.calculateBehaviorScore(behavior)
    }

    this.behaviorHistory.push(record)
    
    // 只保留最近100条记录
    if (this.behaviorHistory.length > 100) {
      this.behaviorHistory = this.behaviorHistory.slice(-100)
    }

    this.saveBehaviorHistory()
    this.updatePreferences()
  }

  /**
   * 计算行为分数
   */
  calculateBehaviorScore(behavior) {
    const scores = {
      view: 1,
      search: 2,
      favorite: 5,
      collect: 5,
      share: 3,
      comment: 4,
      purchase: 10,
      complete: 8
    }
    return scores[behavior.type] || 1
  }

  /**
   * 更新用户偏好
   */
  updatePreferences() {
    const categoryScores = {}
    const tagScores = {}

    this.behaviorHistory.forEach(record => {
      // 类别统计
      if (record.category) {
        categoryScores[record.category] = (categoryScores[record.category] || 0) + record.score
      }
      
      // 标签统计
      if (record.tags) {
        record.tags.forEach(tag => {
          tagScores[tag] = (tagScores[tag] || 0) + record.score
        })
      }
    })

    // 更新偏好
    this.preferences = {
      categories: this.sortByScore(categoryScores),
      tags: this.sortByScore(tagScores),
      lastUpdate: Date.now()
    }

    this.savePreferences()
  }

  /**
   * 按分数排序
   */
  sortByScore(scoreObj) {
    return Object.entries(scoreObj)
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key)
  }

  /**
   * 推荐配方
   */
  recommendFormulas(limit = 10) {
    const { categories, tags } = this.preferences
    
    // 基于类别推荐
    const categoryMatches = this.searchByCategory(categories, limit)
    
    // 基于标签推荐
    const tagMatches = this.searchByTags(tags, limit)
    
    // 合并去重
    const combined = this.mergeRecommendations(categoryMatches, tagMatches)
    
    return combined.slice(0, limit)
  }

  /**
   * 搜索推荐
   */
  searchRecommendations(query, limit = 5) {
    // 基于搜索历史的联想
    const historyMatches = this.matchHistory(query)
    
    // 基于当前搜索的相关推荐
    const relatedMatches = this.searchRelated(query)
    
    return [...new Set([...historyMatches, ...relatedMatches])].slice(0, limit)
  }

  /**
   * 匹配搜索历史
   */
  matchHistory(query) {
    return this.behaviorHistory
      .filter(record => 
        record.targetName?.includes(query) ||
        record.category?.includes(query)
      )
      .slice(0, 3)
      .map(record => record.targetId)
  }

  /**
   * 搜索相关内容
   */
  searchRelated(query) {
    // 这里可以调用API获取相关内容
    return []
  }

  /**
   * 搜索相似配方
   */
  findSimilar(formulaId, limit = 5) {
    // 获取当前配方信息
    const currentFormula = this.findById(formulaId)
    if (!currentFormula) return []

    // 基于类别相似度
    const byCategory = this.findByCategory(currentFormula.category, limit)
    
    // 基于标签相似度
    const byTags = this.findByTags(currentFormula.tags, limit)
    
    // 排除当前配方
    return [...new Set([...byCategory, ...byTags])]
      .filter(id => id !== formulaId)
      .slice(0, limit)
  }

  /**
   * 根据类别搜索
   */
  searchByCategory(categories, limit) {
    // 实现配方搜索逻辑
    return []
  }

  /**
   * 根据标签搜索
   */
  searchByTags(tags, limit) {
    // 实现配方搜索逻辑
    return []
  }

  /**
   * 查找配方
   */
  findById(id) {
    // 实现配方查找逻辑
    return null
  }

  /**
   * 按类别查找
   */
  findByCategory(category, limit) {
    // 实现配方查找逻辑
    return []
  }

  /**
   * 按标签查找
   */
  findByTags(tags, limit) {
    // 实现配方查找逻辑
    return []
  }

  /**
   * 合并推荐结果
   */
  mergeRecommendations(a, b) {
    const map = new Map()
    
    a.forEach((item, index) => {
      map.set(item.id, { ...item, score: 10 - index })
    })
    
    b.forEach((item, index) => {
      if (map.has(item.id)) {
        map.get(item.id).score += 5 - index
      } else {
        map.set(item.id, { ...item, score: 5 - index })
      }
    })
    
    return Array.from(map.values())
      .sort((a, b) => b.score - a.score)
      .map(({ id, ...rest }) => ({ id, ...rest }))
  }

  /**
   * 保存行为历史
   */
  saveBehaviorHistory() {
    try {
      wx.setStorageSync('behavior_history', JSON.stringify(this.behaviorHistory))
    } catch (e) {
      console.error('[RecommendationEngine] Save history failed:', e)
    }
  }

  /**
   * 保存偏好
   */
  savePreferences() {
    try {
      wx.setStorageSync('user_preferences', JSON.stringify(this.preferences))
    } catch (e) {
      console.error('[RecommendationEngine] Save preferences failed:', e)
    }
  }

  /**
   * 清空数据
   */
  clear() {
    this.behaviorHistory = []
    this.preferences = {}
    wx.removeStorageSync('behavior_history')
    wx.removeStorageSync('user_preferences')
  }

  /**
   * 导出用户画像
   */
  exportProfile() {
    return {
      preferences: this.preferences,
      behaviorCount: this.behaviorHistory.length,
      lastActive: this.behaviorHistory[this.behaviorHistory.length - 1]?.timestamp
    }
  }
}

// 单例模式
let instance = null

export function getRecommendationEngine() {
  if (!instance) {
    instance = new RecommendationEngine()
  }
  return instance
}

export default RecommendationEngine
